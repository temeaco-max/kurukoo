import { getDb, saveDb } from '../database.js';
import { getEconomicCategory, getSkillRequirements, getSkillCapabilities, getKnownSkills } from './skillFlows.js';

export type CapabilityKind = 'provider' | 'contributor' | 'native' | 'agent';
export type CapabilityStatus = 'discovered' | 'interested' | 'onboarding' | 'verified' | 'active' | 'paused' | 'suspended';
export type CapabilityAvailability = 'offline' | 'available' | 'live';

export interface CapabilityPortfolioItem {
  id: string;
  phone: string;
  skill: string;
  kind: CapabilityKind;
  status: CapabilityStatus;
  availability: CapabilityAvailability;
  category: string | null;
  confidence: number;
  operationMode: string;
  serviceRadiusKm: number;
  isVerified: boolean;
  trustScore: number;
  metadata: Record<string, unknown>;
  activePulse: boolean;
  requirements: ReturnType<typeof getSkillRequirements>;
  capabilities: ReturnType<typeof getSkillCapabilities>;
}

function table() {
  return `CREATE TABLE IF NOT EXISTS capability_portfolio (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    skill TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'provider',
    status TEXT NOT NULL DEFAULT 'discovered',
    availability TEXT NOT NULL DEFAULT 'offline',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, skill, kind)
  );
  CREATE INDEX IF NOT EXISTS idx_capability_portfolio_phone ON capability_portfolio(phone, updated_at);
  CREATE INDEX IF NOT EXISTS idx_capability_portfolio_skill ON capability_portfolio(skill, status, availability);`;
}

async function ensureTable() {
  const db = await getDb();
  db.run(table());
  return db;
}

function idFor(phone: string, skill: string, kind: CapabilityKind) {
  return `${kind}:${phone}:${skill}`.slice(0, 220);
}

function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try { return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, unknown>); } catch { return {}; }
}

async function enrich(phone: string, rows: any[]): Promise<CapabilityPortfolioItem[]> {
  const db = await getDb();
  const pulse = new Set<string>();
  const pulseStmt = db.prepare(`SELECT DISTINCT skill FROM pulse_sessions WHERE phone = ? AND active = 1 AND expires_at > datetime('now')`);
  pulseStmt.bind([phone]);
  while (pulseStmt.step()) pulse.add(String((pulseStmt.getAsObject() as any).skill || ''));
  pulseStmt.free();
  const profileStmt = db.prepare(`SELECT verified_provider, is_available, trust_score FROM memory_profiles WHERE phone = ? LIMIT 1`);
  profileStmt.bind([phone]);
  let verified = false; let available = false; let trustScore = 5;
  if (profileStmt.step()) { const row = profileStmt.getAsObject() as any; verified = Number(row.verified_provider || 0) === 1; available = Number(row.is_available || 0) === 1; trustScore = Number(row.trust_score || 5); }
  profileStmt.free();
  return rows.map((row: any) => {
    const skill = String(row.skill);
    const kind = (row.kind || 'provider') as CapabilityKind;
    const status = (row.status || (verified ? 'verified' : 'discovered')) as CapabilityStatus;
    const availability = pulse.has(skill) ? 'live' : row.availability === 'available' || available && status === 'active' ? 'available' : 'offline';
    return {
      id: String(row.id), phone, skill, kind, status, availability,
      category: getEconomicCategory(skill), confidence: Number(row.confidence || 1),
      operationMode: String(row.operation_mode || 'stationary'),
      serviceRadiusKm: Number(row.service_radius_km || 10),
      isVerified: verified || status === 'verified',
      trustScore,
      metadata: parseJson(row.metadata_json),
      activePulse: pulse.has(skill),
      requirements: getSkillRequirements(skill),
      capabilities: getSkillCapabilities(skill),
    };
  });
}

export async function listCapabilityPortfolio(phone: string): Promise<CapabilityPortfolioItem[]> {
  await ensureTable();
  const db = await getDb();
  const stmt = db.prepare(`SELECT p.id, p.skill, p.kind, p.status, p.availability, p.metadata_json, s.confidence, s.operation_mode, s.service_radius_km FROM capability_portfolio p LEFT JOIN skills s ON s.phone = p.phone AND s.skill = p.skill WHERE p.phone = ? ORDER BY p.updated_at DESC, p.skill ASC`);
  stmt.bind([phone]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return enrich(phone, rows);
}

export async function ensureCapability(phone: string, skill: string, kind: CapabilityKind = 'provider', metadata: Record<string, unknown> = {}): Promise<CapabilityPortfolioItem> {
  const normalized = String(skill || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 120);
  if (!normalized) throw new Error('A capability skill is required');
  await ensureTable();
  const db = await getDb();
  const existing = db.prepare(`SELECT id FROM capability_portfolio WHERE phone = ? AND skill = ? AND kind = ? LIMIT 1`);
  existing.bind([phone, normalized, kind]);
  const hasExisting = existing.step();
  existing.free();
  if (!hasExisting) {
    db.run(`INSERT INTO capability_portfolio (id, phone, skill, kind, status, availability, metadata_json) VALUES (?, ?, ?, ?, 'interested', 'offline', ?)` , [idFor(phone, normalized, kind), phone, normalized, kind, JSON.stringify(metadata)]);
  } else {
    db.run(`UPDATE capability_portfolio SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ? AND skill = ? AND kind = ?`, [JSON.stringify(metadata), phone, normalized, kind]);
  }
  saveDb();
  const portfolio = await listCapabilityPortfolio(phone);
  const item = portfolio.find(x => x.skill === normalized && x.kind === kind);
  if (!item) throw new Error('Unable to create capability portfolio item');
  return item;
}

export async function setCapabilityState(phone: string, skill: string, patch: { status?: CapabilityStatus; availability?: CapabilityAvailability; metadata?: Record<string, unknown>; kind?: CapabilityKind }) {
  const kind = patch.kind || 'provider';
  const current = await ensureCapability(phone, skill, kind, patch.metadata || {});
  const db = await getDb();
  if (patch.status) db.run(`UPDATE capability_portfolio SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [patch.status, current.id]);
  if (patch.availability) db.run(`UPDATE capability_portfolio SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [patch.availability, current.id]);
  if (patch.metadata) db.run(`UPDATE capability_portfolio SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [JSON.stringify(patch.metadata), current.id]);
  if (patch.status === 'active' || patch.availability === 'available' || patch.availability === 'live') db.run(`UPDATE capability_portfolio SET status = CASE WHEN status IN ('discovered','interested','onboarding') THEN 'active' ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [current.id]);
  saveDb();
  return (await listCapabilityPortfolio(phone)).find(x => x.id === current.id)!;
}

export async function capabilityPortfolioSummary(phone: string) {
  const items = await listCapabilityPortfolio(phone);
  return {
    phone,
    total: items.length,
    active: items.filter(x => ['active','verified'].includes(x.status)).length,
    live: items.filter(x => x.availability === 'live').length,
    available: items.filter(x => x.availability === 'available' || x.availability === 'live').length,
    contributor: items.filter(x => x.kind === 'contributor').length,
    provider: items.filter(x => x.kind === 'provider').length,
    skills: items.map(x => x.skill),
    items,
  };
}

export function isKnownSkill(skill: string) {
  const normalized = skill.trim().toLowerCase().replace(/\s+/g, '_');
  return getKnownSkills().includes(normalized) || ['prayer','life_admin','career','health_navigation','family_care','learning_tutor','home_household','finance_coach','grief_support'].includes(normalized);
}
