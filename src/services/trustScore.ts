/**
 * KuruTrust score calculation — Blueprint §15.1.
 *
 * The raw score is backend-only. Public surfaces should expose human-readable
 * signals (rating, completed jobs, verification and response-time badges), not
 * this composite number.
 */
import { getDb, saveDb } from '../database.js';

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

export function calculateTrustScoreValue(input: {
  avgRating: number;
  completedJobs: number;
  verifiedProvider: boolean;
  disputesLost: number;
  accountAgeDays: number;
}): number {
  const avgRating = Number.isFinite(input.avgRating) && input.avgRating > 0 ? clamp(input.avgRating, 1, 5) : 3;
  const completedJobs = Math.max(0, Number(input.completedJobs) || 0);
  const disputesLost = Math.max(0, Number(input.disputesLost) || 0);
  const accountAgeDays = Math.max(0, Number(input.accountAgeDays) || 0);
  return Number(clamp(
    5.0
      + ((avgRating - 3.0) * 0.5)
      + Math.min(completedJobs / 100, 1.0)
      + (input.verifiedProvider ? 0.5 : 0)
      - (disputesLost * 0.2)
      + Math.min(accountAgeDays / 365, 0.5),
    0,
    8,
  ).toFixed(2));
}

function accountAgeDays(createdAt: unknown): number {
  const created = new Date(String(createdAt || '')).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, (Date.now() - created) / 86_400_000);
}

async function ensureTrustScoreSchema(): Promise<void> {
  const db = await getDb();
  const columns = (db.exec('PRAGMA table_info(memory_profiles)')[0]?.values || []).map((row: any[]) => String(row[1]));
  if (!columns.includes('trust_score')) {
    db.run('ALTER TABLE memory_profiles ADD COLUMN trust_score REAL DEFAULT 5.0');
    saveDb();
  }
  const disputeColumns = (db.exec('PRAGMA table_info(disputes)')[0]?.values || []).map((row: any[]) => String(row[1]));
  if (!disputeColumns.includes('fault_party')) {
    db.run('ALTER TABLE disputes ADD COLUMN fault_party TEXT');
    saveDb();
  }
}

async function calculate(phone: string): Promise<TrustScoreBreakdown | null> {
  await ensureTrustScoreSchema();
  const db = await getDb();

  const profileStmt = db.prepare('SELECT created_at, verified_provider FROM memory_profiles WHERE phone = ? LIMIT 1');
  profileStmt.bind([phone]);
  if (!profileStmt.step()) {
    profileStmt.free();
    return null;
  }
  const profile = profileStmt.getAsObject() as any;
  profileStmt.free();

  // Current Kurukoo stores provider rating/job aggregates on skills. Reuse that
  // canonical data instead of creating a parallel ratings table.
  const statsStmt = db.prepare(`
    SELECT COALESCE(AVG(rating), 0) AS avg_rating,
           COALESCE(SUM(jobs_completed), 0) AS completed_jobs
    FROM skills WHERE phone = ?
  `);
  statsStmt.bind([phone]);
  const stats = statsStmt.step() ? statsStmt.getAsObject() as any : { avg_rating: 0, completed_jobs: 0 };
  statsStmt.free();

  const avgRating = Number(stats.avg_rating) > 0 ? clamp(Number(stats.avg_rating), 1, 5) : 3;
  const completedJobs = Math.max(0, Number(stats.completed_jobs) || 0);
  const verifiedProvider = Number(profile.verified_provider) === 1;

  // Only an explicit provider fault outcome counts as a lost dispute. Historical
  // disputes without fault_party remain neutral rather than being guessed.
  const disputeStmt = db.prepare(`
    SELECT COUNT(*) AS count FROM disputes
    WHERE status = 'resolved' AND fault_party = ?
  `);
  disputeStmt.bind([phone]);
  const disputesLost = disputeStmt.step() ? Number((disputeStmt.getAsObject() as any).count || 0) : 0;
  disputeStmt.free();

  const ageDays = accountAgeDays(profile.created_at);
  const score = calculateTrustScoreValue({ avgRating, completedJobs, verifiedProvider, disputesLost, accountAgeDays: ageDays });

  return { phone, avgRating, completedJobs, verifiedProvider, disputesLost, accountAgeDays: ageDays, score };
}

export async function recalculateTrustScore(phone: string): Promise<TrustScoreBreakdown | null> {
  const breakdown = await calculate(String(phone || '').trim());
  if (!breakdown) return null;
  const db = await getDb();
  db.run('UPDATE memory_profiles SET trust_score = ? WHERE phone = ?', [breakdown.score, breakdown.phone]);
  saveDb();
  return breakdown;
}

export async function recalculateAllTrustScores(): Promise<number> {
  await ensureTrustScoreSchema();
  const db = await getDb();
  const stmt = db.prepare("SELECT phone FROM memory_profiles WHERE phone IS NOT NULL AND phone != ''");
  const phones: string[] = [];
  while (stmt.step()) phones.push(String((stmt.getAsObject() as any).phone));
  stmt.free();

  let updated = 0;
  for (const phone of phones) {
    if (await recalculateTrustScore(phone)) updated++;
  }
  return updated;
}

export async function getTrustScoreBreakdown(phone: string): Promise<TrustScoreBreakdown | null> {
  return calculate(String(phone || '').trim());
}

/** Record an explicit dispute outcome without exposing the raw Trust Score. */
export async function recordDisputeFault(disputeId: number, faultParty: 'buyer' | 'provider', phone: string): Promise<void> {
  await ensureTrustScoreSchema();
  const db = await getDb();
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone) throw new Error('fault party phone is required');
  db.run('UPDATE disputes SET fault_party = ? WHERE id = ?', [faultParty === 'provider' ? cleanPhone : 'buyer', disputeId]);
  saveDb();
  if (faultParty === 'provider') await recalculateTrustScore(cleanPhone);
}
