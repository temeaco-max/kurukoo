import { getDb, saveDb } from '../database.js';

/**
 * Trust Score calculation from Blueprint §15.1. The score is derived only from
 * records already owned by the canonical profile, skills and dispute services.
 * It is not evidence of identity, availability, or an escrow guarantee.
 */
export interface TrustScoreBreakdown {
  phone: string;
  avgRating: number;
  completedJobs: number;
  verifiedProvider: boolean;
  disputesLost: number;
  accountAgeDays: number;
  score: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateTrustScoreValue(input: Omit<TrustScoreBreakdown, 'phone' | 'score'>): number {
  const avgRating = Number.isFinite(input.avgRating) && input.avgRating > 0 ? clamp(input.avgRating, 1, 5) : 3;
  const completedJobs = Math.max(0, Number(input.completedJobs) || 0);
  const disputesLost = Math.max(0, Number(input.disputesLost) || 0);
  const accountAgeDays = Math.max(0, Number(input.accountAgeDays) || 0);
  return Number(clamp(
    5
      + ((avgRating - 3) * 0.5)
      + Math.min(completedJobs / 100, 1)
      + (input.verifiedProvider ? 0.5 : 0)
      - (disputesLost * 0.2)
      + Math.min(accountAgeDays / 365, 0.5),
    0,
    8,
  ).toFixed(2));
}

function accountAgeDays(createdAt: unknown): number {
  const timestamp = new Date(String(createdAt || '')).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 86_400_000) : 0;
}

function columnsFor(db: any, table: string): Set<string> {
  return new Set((db.exec(`PRAGMA table_info(${table})`)[0]?.values || []).map((row: any[]) => String(row[1])));
}

/** Ensure existing SQL.js files receive only additive trust-related migrations. */
export async function ensureTrustScoreSchema(): Promise<void> {
  const db = await getDb();
  const profileColumns = columnsFor(db, 'memory_profiles');
  if (!profileColumns.has('trust_score')) db.run('ALTER TABLE memory_profiles ADD COLUMN trust_score REAL DEFAULT 5.0');
  const disputeColumns = columnsFor(db, 'disputes');
  if (!disputeColumns.has('fault_party')) db.run('ALTER TABLE disputes ADD COLUMN fault_party TEXT');
  if (!disputeColumns.has('fault_phone')) db.run('ALTER TABLE disputes ADD COLUMN fault_phone TEXT');
  db.run(`CREATE TABLE IF NOT EXISTS trust_score_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, score REAL NOT NULL, breakdown_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trust_score_ledger_phone ON trust_score_ledger(phone, created_at DESC)`);
  saveDb();
}

async function calculateTrustScore(phone: string): Promise<TrustScoreBreakdown | null> {
  await ensureTrustScoreSchema();
  const db = await getDb();
  const profileStatement = db.prepare('SELECT created_at, verified_provider FROM memory_profiles WHERE phone=? LIMIT 1');
  profileStatement.bind([phone]);
  if (!profileStatement.step()) {
    profileStatement.free();
    return null;
  }
  const profile = profileStatement.getAsObject() as Record<string, unknown>;
  profileStatement.free();

  const statsStatement = db.prepare('SELECT COALESCE(AVG(rating), 0) AS avg_rating, COALESCE(SUM(jobs_completed), 0) AS completed_jobs FROM skills WHERE phone=?');
  statsStatement.bind([phone]);
  const stats = statsStatement.step() ? statsStatement.getAsObject() as Record<string, unknown> : {};
  statsStatement.free();

  const disputesStatement = db.prepare("SELECT COUNT(*) AS count FROM disputes WHERE status='resolved' AND fault_phone=?");
  disputesStatement.bind([phone]);
  const disputes = disputesStatement.step() ? disputesStatement.getAsObject() as Record<string, unknown> : {};
  disputesStatement.free();

  const breakdown: TrustScoreBreakdown = {
    phone,
    avgRating: Number(stats.avg_rating) > 0 ? clamp(Number(stats.avg_rating), 1, 5) : 3,
    completedJobs: Math.max(0, Number(stats.completed_jobs) || 0),
    verifiedProvider: Number(profile.verified_provider) === 1,
    disputesLost: Math.max(0, Number(disputes.count) || 0),
    accountAgeDays: accountAgeDays(profile.created_at),
    score: 5,
  };
  breakdown.score = calculateTrustScoreValue(breakdown);
  return breakdown;
}

export async function recalculateTrustScore(phone: string, reason = 'scheduled_recalculation'): Promise<TrustScoreBreakdown | null> {
  const breakdown = await calculateTrustScore(String(phone || '').trim());
  if (!breakdown) return null;
  const db = await getDb();
  db.run('UPDATE memory_profiles SET trust_score=?, updated_at=CURRENT_TIMESTAMP WHERE phone=?', [breakdown.score, breakdown.phone]);
  db.run('INSERT INTO trust_score_ledger(phone, score, breakdown_json, reason) VALUES (?, ?, ?, ?)', [breakdown.phone, breakdown.score, JSON.stringify({ avgRating: breakdown.avgRating, completedJobs: breakdown.completedJobs, verifiedProvider: breakdown.verifiedProvider, disputesLost: breakdown.disputesLost, accountAgeDays: Number(breakdown.accountAgeDays.toFixed(2)) }), String(reason || 'scheduled_recalculation').slice(0, 120)]);
  saveDb();
  return breakdown;
}

export async function listTrustScoreLedger(phone: string, limit = 25): Promise<Array<{ score: number; reason: string; createdAt: string; breakdown: Omit<TrustScoreBreakdown, 'phone' | 'score'> }>> {
  await ensureTrustScoreSchema();
  const db = await getDb();
  const statement = db.prepare('SELECT score, breakdown_json, reason, created_at FROM trust_score_ledger WHERE phone=? ORDER BY id DESC LIMIT ?');
  statement.bind([String(phone || '').trim(), Math.max(1, Math.min(100, Number(limit) || 25))]);
  const entries: Array<{ score: number; reason: string; createdAt: string; breakdown: Omit<TrustScoreBreakdown, 'phone' | 'score'> }> = [];
  while (statement.step()) { const row = statement.getAsObject() as Record<string, unknown>; try { entries.push({ score: Number(row.score), reason: String(row.reason), createdAt: String(row.created_at || ''), breakdown: JSON.parse(String(row.breakdown_json || '{}')) }); } catch { /* malformed historical evidence is ignored rather than trusted */ } }
  statement.free();
  return entries;
}

export async function recalculateAllTrustScores(): Promise<number> {
  await ensureTrustScoreSchema();
  const db = await getDb();
  const statement = db.prepare("SELECT phone FROM memory_profiles WHERE phone IS NOT NULL AND phone != ''");
  const phones: string[] = [];
  while (statement.step()) phones.push(String(statement.getAsObject().phone));
  statement.free();
  let updated = 0;
  for (const phone of phones) if (await recalculateTrustScore(phone)) updated += 1;
  return updated;
}

export async function getTrustScoreBreakdown(phone: string): Promise<TrustScoreBreakdown | null> {
  return calculateTrustScore(String(phone || '').trim());
}

/** Record a reviewed dispute outcome; unresolved or unassigned disputes remain neutral. */
export async function recordDisputeFault(disputeId: number, faultParty: 'buyer' | 'provider', faultPhone: string): Promise<void> {
  const phone = String(faultPhone || '').trim();
  if (!phone) throw new Error('A reviewed fault owner is required');
  await ensureTrustScoreSchema();
  const db = await getDb();
  db.run('UPDATE disputes SET fault_party=?, fault_phone=? WHERE id=?', [faultParty, phone, disputeId]);
  saveDb();
  await recalculateTrustScore(phone, 'reviewed_dispute_fault');
}
