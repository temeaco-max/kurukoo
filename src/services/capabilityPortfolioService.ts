import { getDb, saveDb } from '../database.js';
import { getEconomicCategory, getSkillRequirements, getSkillCapabilities, getKnownSkills } from './skillFlows.js';
import { ensureCapabilityPortfolioRegistration } from './capabilityPortfolioFoundation.js';
import { getProviderVerification } from './providerVerificationLifecycle.js';

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

ensureCapabilityPortfolioRegistration();

function table() {
  return `
    CREATE TABLE IF NOT EXISTS capability_portfolio (
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
    CREATE INDEX IF NOT EXISTS idx_capability_portfolio_skill ON capability_portfolio(skill, status, availability);
  `;
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
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function providerVerificationSnapshot(phone: string): Promise<{ verified: boolean; verificationState: string; verificationExpiresAt?: string }> {
  const db = await getDb();
  const profile = db.prepare('SELECT verified_provider FROM memory_profiles WHERE phone=? LIMIT 1');
  profile.bind([phone]);
  const row = profile.step() ? profile.getAsObject() as any : null;
  profile.free();
  const verification = await getProviderVerification(phone);
  const expiresAt = verification?.expiresAt ? new Date(verification.expiresAt) : null;
  const expired = Boolean(expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now());
  // `verified_provider` remains the canonical discovery gate. A verification
  // record adds provenance and expiry when available, but legacy verified
  // providers remain usable until migrated through the verified lifecycle.
  return {
    verified: Number(row?.verified_provider || 0) === 1 && !expired && (!verification || verification.state === 'verified'),
    verificationState: expired ? 'expired' : verification?.state || (Number(row?.verified_provider || 0) === 1 ? 'legacy_verified' : 'unverified'),
    verificationExpiresAt: verification?.expiresAt,
  };
}

async function reconcileFromCanonicalSources(phone: string) {
  const db = await ensureTable();
  const verification = await providerVerificationSnapshot(phone);
  const stmt = db.prepare('SELECT skill, confidence, is_available, operation_mode, service_radius_km FROM skills WHERE phone=?');
  stmt.bind([phone]);
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    const skill = String(row.skill || '').trim().toLowerCase();
    if (!skill) continue;
    const declaredAvailable = Number(row.is_available || 0) === 1;
    const status: CapabilityStatus = verification.verified ? (declaredAvailable ? 'active' : 'verified') : 'onboarding';
    const availability: CapabilityAvailability = verification.verified && declaredAvailable ? 'available' : 'offline';
    db.run(`
      INSERT INTO capability_portfolio (id,phone,skill,kind,status,availability,metadata_json)
      VALUES (?,?,?,'provider',?,?,?)
      ON CONFLICT(phone,skill,kind) DO UPDATE SET
        status=CASE WHEN capability_portfolio.status IN ('interested','onboarding','paused','suspended') THEN capability_portfolio.status ELSE excluded.status END,
        availability=CASE WHEN capability_portfolio.status IN ('paused','suspended') THEN 'offline' ELSE excluded.availability END,
        metadata_json=CASE
          WHEN json_valid(capability_portfolio.metadata_json) THEN json_set(capability_portfolio.metadata_json,'$.verification_state',?, '$.verification_expires_at', ?)
          ELSE excluded.metadata_json
        END,
        updated_at=CURRENT_TIMESTAMP
    `, [
      idFor(phone, skill, 'provider'),
      phone,
      skill,
      status,
      availability,
      JSON.stringify({ verification_state: verification.verificationState, verification_expires_at: verification.verificationExpiresAt || null }),
      verification.verificationState,
      verification.verificationExpiresAt || null,
    ]);
  }
  stmt.free();

  const profileStmt = db.prepare('SELECT is_contributor FROM memory_profiles WHERE phone=? LIMIT 1');
  profileStmt.bind([phone]);
  let contributor = false;
  if (profileStmt.step()) contributor = Number((profileStmt.getAsObject() as any).is_contributor || 0) === 1;
  profileStmt.free();
  if (contributor) {
    db.run(`
      INSERT INTO capability_portfolio (id,phone,skill,kind,status,availability,metadata_json)
      VALUES (?,?,'contributor','contributor','active','available','{}')
      ON CONFLICT(phone,skill,kind) DO UPDATE SET status='active',availability='available',updated_at=CURRENT_TIMESTAMP
    `, [idFor(phone, 'contributor', 'contributor'), phone]);
  }
  saveDb();
}

async function enrich(phone: string, rows: any[]): Promise<CapabilityPortfolioItem[]> {
  const db = await getDb();
  const pulse = new Set<string>();
  const pulseStmt = db.prepare(`SELECT DISTINCT skill FROM pulse_sessions WHERE phone=? AND active=1 AND expires_at>datetime('now')`);
  pulseStmt.bind([phone]);
  while (pulseStmt.step()) pulse.add(String((pulseStmt.getAsObject() as any).skill || ''));
  pulseStmt.free();

  const verification = await providerVerificationSnapshot(phone);
  const profileStmt = db.prepare('SELECT trust_score FROM memory_profiles WHERE phone=? LIMIT 1');
  profileStmt.bind([phone]);
  let trustScore = 5;
  if (profileStmt.step()) trustScore = Number((profileStmt.getAsObject() as any).trust_score || 5);
  profileStmt.free();

  return rows.map((row: any) => {
    const skill = String(row.skill);
    const kind = (row.kind || 'provider') as CapabilityKind;
    const status = (row.status || (verification.verified ? 'verified' : 'onboarding')) as CapabilityStatus;
    const allowedLivePulse = kind === 'provider' && verification.verified && status === 'active' && pulse.has(skill);
    const availability: CapabilityAvailability = allowedLivePulse ? 'live' : row.availability === 'available' && verification.verified && status === 'active' ? 'available' : 'offline';
    return {
      id: String(row.id),
      phone,
      skill,
      kind,
      status,
      availability,
      category: getEconomicCategory(skill),
      confidence: Number(row.confidence || 1),
      operationMode: String(row.operation_mode || 'stationary'),
      serviceRadiusKm: Number(row.service_radius_km || 10),
      isVerified: kind !== 'provider' || verification.verified,
      trustScore,
      metadata: { ...parseJson(row.metadata_json), verification_state: kind === 'provider' ? verification.verificationState : undefined, verification_expires_at: kind === 'provider' ? verification.verificationExpiresAt : undefined },
      activePulse: allowedLivePulse,
      requirements: getSkillRequirements(skill),
      capabilities: getSkillCapabilities(skill),
    };
  });
}

export async function listCapabilityPortfolio(phone: string): Promise<CapabilityPortfolioItem[]> {
  await reconcileFromCanonicalSources(phone);
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT p.id,p.skill,p.kind,p.status,p.availability,p.metadata_json,s.confidence,s.operation_mode,s.service_radius_km
    FROM capability_portfolio p
    LEFT JOIN skills s ON s.phone=p.phone AND s.skill=p.skill
    WHERE p.phone=?
    ORDER BY p.updated_at DESC,p.skill ASC
  `);
  stmt.bind([phone]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return enrich(phone, rows);
}

export async function ensureCapability(phone: string, skill: string, kind: CapabilityKind = 'provider', metadata: Record<string, unknown> = {}) {
  const normalized = String(skill || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 120);
  if (!normalized) throw new Error('A capability skill is required');
  await ensureTable();
  const db = await getDb();
  if (kind === 'provider') {
    const existingSkill = db.prepare('SELECT id FROM skills WHERE phone=? AND skill=? LIMIT 1');
    existingSkill.bind([phone, normalized]);
    const exists = existingSkill.step();
    existingSkill.free();
    if (!exists) db.run(`INSERT INTO skills (phone,skill,source,confidence,is_available,operation_mode) VALUES (?,?,'capability_portfolio',1,0,'stationary')`, [phone, normalized]);
  }
  if (kind === 'contributor') db.run('UPDATE memory_profiles SET is_contributor=1,updated_at=CURRENT_TIMESTAMP WHERE phone=?', [phone]);
  const existing = db.prepare('SELECT id FROM capability_portfolio WHERE phone=? AND skill=? AND kind=? LIMIT 1');
  existing.bind([phone, normalized, kind]);
  const hasExisting = existing.step();
  existing.free();
  if (!hasExisting) {
    db.run(`INSERT INTO capability_portfolio (id,phone,skill,kind,status,availability,metadata_json) VALUES (?,?,?,?, 'interested','offline',?)`, [idFor(phone, normalized, kind), phone, normalized, kind, JSON.stringify(metadata)]);
  } else if (Object.keys(metadata).length) {
    db.run('UPDATE capability_portfolio SET metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE phone=? AND skill=? AND kind=?', [JSON.stringify(metadata), phone, normalized, kind]);
  }
  saveDb();
  const item = (await listCapabilityPortfolio(phone)).find((entry) => entry.skill === normalized && entry.kind === kind);
  if (!item) throw new Error('Unable to create capability portfolio item');
  return item;
}

export async function setCapabilityState(phone: string, skill: string, patch: { status?: CapabilityStatus; availability?: CapabilityAvailability; metadata?: Record<string, unknown>; kind?: CapabilityKind }) {
  const kind = patch.kind || 'provider';
  const normalized = String(skill || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (patch.status === 'verified') throw new Error('Provider verification is an operator-governed state and cannot be self-asserted.');
  const current = await ensureCapability(phone, normalized, kind, patch.metadata || {});
  const db = await getDb();

  if (kind === 'provider') {
    const verification = await providerVerificationSnapshot(phone);
    const requestsAvailability = patch.availability === 'available' || patch.availability === 'live';
    if ((requestsAvailability || patch.status === 'active') && !verification.verified) {
      db.run(`UPDATE capability_portfolio SET status='onboarding',availability='offline',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [current.id]);
      saveDb();
      throw new Error('Provider verification is required before a capability can be made available.');
    }
    if (patch.availability === 'available' || patch.availability === 'live' || patch.availability === 'offline') {
      db.run('UPDATE skills SET is_available=? WHERE phone=? AND skill=?', [patch.availability === 'offline' ? 0 : 1, phone, normalized]);
    }
    if (patch.status === 'paused' || patch.status === 'suspended' || patch.availability === 'offline') {
      db.run('UPDATE skills SET is_available=0 WHERE phone=? AND skill=?', [phone, normalized]);
    }
    if (patch.status) db.run('UPDATE capability_portfolio SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [patch.status, current.id]);
  } else if (kind === 'contributor' && (patch.status === 'paused' || patch.availability === 'offline')) {
    db.run('UPDATE memory_profiles SET is_contributor=0,updated_at=CURRENT_TIMESTAMP WHERE phone=?', [phone]);
    if (patch.status) db.run('UPDATE capability_portfolio SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [patch.status, current.id]);
  } else if (patch.status) {
    db.run('UPDATE capability_portfolio SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [patch.status, current.id]);
  }

  if (patch.metadata) db.run('UPDATE capability_portfolio SET metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [JSON.stringify(patch.metadata), current.id]);
  saveDb();
  return (await listCapabilityPortfolio(phone)).find((entry) => entry.id === current.id)!;
}

export async function capabilityPortfolioSummary(phone: string) {
  const items = await listCapabilityPortfolio(phone);
  return {
    phone,
    total: items.length,
    active: items.filter((item) => ['active', 'verified'].includes(item.status)).length,
    live: items.filter((item) => item.availability === 'live').length,
    available: items.filter((item) => item.availability === 'available' || item.availability === 'live').length,
    contributor: items.filter((item) => item.kind === 'contributor').length,
    provider: items.filter((item) => item.kind === 'provider').length,
    skills: items.map((item) => item.skill),
    items,
  };
}

export function isKnownSkill(skill: string) {
  const normalized = skill.trim().toLowerCase().replace(/\s+/g, '_');
  return getKnownSkills().includes(normalized) || ['mobile_barber', 'barber', 'delivery_runner', 'prayer', 'life_admin', 'career', 'health_navigation', 'family_care', 'learning_tutor', 'home_household', 'finance_coach', 'grief_support', 'contributor'].includes(normalized);
}
