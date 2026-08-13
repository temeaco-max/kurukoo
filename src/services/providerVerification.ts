import { getDb, saveDb } from '../database.js';

export const PROVIDER_VERIFICATION_STATES = ['unverified', 'pending', 'verified', 'failed', 'expired', 'suspended'] as const;
export type ProviderVerificationState = typeof PROVIDER_VERIFICATION_STATES[number];

export interface ProviderVerification {
  phone: string;
  state: ProviderVerificationState;
  evidenceRef?: string;
  reviewedBy?: string;
  expiresAt?: string;
  reason?: string;
  updatedAt: string;
}

const STATE_SET = new Set<string>(PROVIDER_VERIFICATION_STATES);
function isState(value: unknown): value is ProviderVerificationState { return typeof value === 'string' && STATE_SET.has(value); }

export async function ensureProviderVerificationSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS provider_verifications (
    phone TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'unverified',
    evidence_ref TEXT,
    reviewed_by TEXT,
    expires_at TEXT,
    reason TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_provider_verifications_state ON provider_verifications(state, expires_at)`);
  saveDb();
}

function rowToVerification(row: Record<string, unknown>): ProviderVerification {
  return { phone: String(row.phone), state: isState(row.state) ? row.state : 'unverified', evidenceRef: row.evidence_ref ? String(row.evidence_ref) : undefined, reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined, expiresAt: row.expires_at ? String(row.expires_at) : undefined, reason: row.reason ? String(row.reason) : undefined, updatedAt: String(row.updated_at || '') };
}

/** Returns current lifecycle state. Expired records are downgraded atomically; no external KYC result is inferred. */
export async function getProviderVerification(phone: string): Promise<ProviderVerification> {
  await ensureProviderVerificationSchema();
  const db = await getDb();
  const statement = db.prepare('SELECT * FROM provider_verifications WHERE phone=?'); statement.bind([phone]);
  if (!statement.step()) { statement.free(); return { phone, state: 'unverified', updatedAt: '' }; }
  const verification = rowToVerification(statement.getAsObject() as Record<string, unknown>); statement.free();
  if (verification.state === 'verified' && verification.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()) return setProviderVerification(phone, 'expired', { reason: 'verification_expired' });
  return verification;
}

/** Admin or external-adapter boundary only. `verified` requires an evidence reference; a profile field alone is not KYC proof. */
export async function setProviderVerification(phone: string, state: ProviderVerificationState, options: { evidenceRef?: string; reviewedBy?: string; expiresAt?: string; reason?: string } = {}): Promise<ProviderVerification> {
  await ensureProviderVerificationSchema();
  if (!phone || !isState(state)) throw new Error('A valid provider verification state is required.');
  if (state === 'verified' && !options.evidenceRef) throw new Error('Verified provider status requires authoritative evidence.');
  const db = await getDb();
  db.run(`INSERT INTO provider_verifications(phone,state,evidence_ref,reviewed_by,expires_at,reason,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(phone) DO UPDATE SET state=excluded.state,evidence_ref=excluded.evidence_ref,reviewed_by=excluded.reviewed_by,expires_at=excluded.expires_at,reason=excluded.reason,updated_at=CURRENT_TIMESTAMP`, [phone, state, options.evidenceRef || null, options.reviewedBy || null, options.expiresAt || null, options.reason || null]);
  // The legacy discovery flag is a projection, not evidence. Only the verified lifecycle state enables it.
  db.run('UPDATE memory_profiles SET verified_provider=?, updated_at=CURRENT_TIMESTAMP WHERE phone=?', [state === 'verified' ? 1 : 0, phone]);
  saveDb();
  return getProviderVerification(phone);
}

export async function providerMayBeDiscovered(phone: string): Promise<boolean> {
  return (await getProviderVerification(phone)).state === 'verified';
}

/** Existing worker calls this bounded sweep; external KYC adapters remain responsible for supplying authoritative evidence. */
export async function expireDueProviderVerifications(limit = 100): Promise<number> {
  await ensureProviderVerificationSchema();
  const db = await getDb();
  const statement = db.prepare(`SELECT phone FROM provider_verifications WHERE state='verified' AND expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now') LIMIT ?`);
  statement.bind([Math.max(1, Math.min(500, Number(limit) || 100))]);
  const phones: string[] = []; while (statement.step()) phones.push(String(statement.getAsObject().phone)); statement.free();
  for (const phone of phones) await setProviderVerification(phone, 'expired', { reason: 'verification_expired' });
  return phones.length;
}
