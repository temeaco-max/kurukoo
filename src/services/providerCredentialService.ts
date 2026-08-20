import { getDb, saveDb } from '../database.js';
import { decryptData, encryptData } from './memoryProfile.js';

export const APPROVED_CREDENTIAL_PROVIDERS = ['gemini', 'groq', 'mistral', 'openrouter', 'stripe', 'whatsapp', 'telegram', 'resend', 'firebase'] as const;
export type ApprovedCredentialProvider = typeof APPROVED_CREDENTIAL_PROVIDERS[number];
export type ProviderCredentialStatus = 'active' | 'disabled' | 'revoked';
export type CredentialTestStatus = 'never_tested' | 'verified' | 'failed' | 'unavailable';

export interface ProviderCredentialSummary {
  provider: ApprovedCredentialProvider;
  status: ProviderCredentialStatus;
  maskedSecret: string | null;
  version: number;
  rotatedAt: string | null;
  lastVerifiedAt: string | null;
  lastTestStatus: CredentialTestStatus;
  lastTestMessage: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}
function validProvider(value: string): value is ApprovedCredentialProvider { return (APPROVED_CREDENTIAL_PROVIDERS as readonly string[]).includes(value); }
function maskSecret(secret: string | null): string | null { if (!secret) return null; const tail = secret.slice(-4); return `${'•'.repeat(Math.min(8, Math.max(4, secret.length - tail.length)))}${tail}`; }
function safeMessage(value: unknown): string { return String(value instanceof Error ? value.message : value || 'Provider test failed.').replace(/[A-Za-z0-9_\-]{20,}/g, '<redacted>').slice(0, 240); }

async function ensureSchema() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS provider_credentials (
    provider TEXT PRIMARY KEY,
    encrypted_secret TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    rotated_at TEXT,
    last_verified_at TEXT,
    last_test_status TEXT NOT NULL DEFAULT 'never_tested',
    last_test_message TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS provider_credential_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    version INTEGER,
    detail TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_provider_credential_audit_provider ON provider_credential_audit(provider, created_at DESC)`);
  saveDb();
}
async function audit(provider: ApprovedCredentialProvider, action: string, actorId: string, version: number | null, detail: Record<string, unknown> = {}) {
  const db = await getDb(); const safe = JSON.stringify(detail);
  db.run(`INSERT INTO provider_credential_audit (provider, action, actor_id, version, detail) VALUES (?, ?, ?, ?, ?)`, [provider, action, actorId.slice(0, 120), version, safe]);
  db.run(`INSERT INTO audit_logs (action, details) VALUES (?, ?)`, ['provider_credential_control', JSON.stringify({ provider, action, actorId: actorId.slice(0, 120), version, ...detail })]);
  saveDb();
}
function summaryFrom(row: any): ProviderCredentialSummary {
  const secret = row.encrypted_secret ? decryptData(String(row.encrypted_secret)) : null;
  return { provider: String(row.provider) as ApprovedCredentialProvider, status: String(row.status) as ProviderCredentialStatus, maskedSecret: maskSecret(secret), version: Number(row.version || 0), rotatedAt: row.rotated_at ? String(row.rotated_at) : null, lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null, lastTestStatus: String(row.last_test_status || 'never_tested') as CredentialTestStatus, lastTestMessage: row.last_test_message ? String(row.last_test_message) : null, updatedBy: row.updated_by ? String(row.updated_by) : null, updatedAt: row.updated_at ? String(row.updated_at) : null };
}
async function rowFor(provider: ApprovedCredentialProvider): Promise<any | null> { await ensureSchema(); const db = await getDb(); const stmt = db.prepare(`SELECT * FROM provider_credentials WHERE provider=?`); stmt.bind([provider]); const row = stmt.step() ? stmt.getAsObject() : null; stmt.free(); return row; }

export async function listProviderCredentials(): Promise<ProviderCredentialSummary[]> {
  await ensureSchema(); const db = await getDb(); const rows = db.exec(`SELECT * FROM provider_credentials ORDER BY provider`)[0]?.values || []; const columns = db.exec(`PRAGMA table_info(provider_credentials)`)[0]?.values?.map((item: any[]) => String(item[1])) || [];
  const records: ProviderCredentialSummary[] = rows.map((row: any[]) => summaryFrom(Object.fromEntries(columns.map((column: string, index: number) => [column, row[index]]))));
  const indexed = new Map<ApprovedCredentialProvider, ProviderCredentialSummary>(records.map(record => [record.provider, record]));
  return APPROVED_CREDENTIAL_PROVIDERS.map((provider): ProviderCredentialSummary => indexed.get(provider) || { provider, status: 'revoked', maskedSecret: null, version: 0, rotatedAt: null, lastVerifiedAt: null, lastTestStatus: 'never_tested', lastTestMessage: null, updatedBy: null, updatedAt: null });
}

export async function rotateProviderCredential(input: { provider: string; secret: string; actorId: string }): Promise<ProviderCredentialSummary> {
  if (!validProvider(input.provider)) throw new Error('Unsupported credential provider.');
  const secret = String(input.secret || '').trim(); if (secret.length < 8) throw new Error('A non-empty provider secret is required.');
  await ensureSchema(); const db = await getDb(); const previous = await rowFor(input.provider); const version = Number(previous?.version || 0) + 1;
  db.run(`INSERT INTO provider_credentials (provider, encrypted_secret, status, version, rotated_at, last_test_status, last_test_message, updated_by, updated_at) VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP, 'never_tested', NULL, ?, CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET encrypted_secret=excluded.encrypted_secret, status='active', version=excluded.version, rotated_at=CURRENT_TIMESTAMP, last_test_status='never_tested', last_test_message=NULL, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`, [input.provider, encryptData(secret), version, input.actorId.slice(0, 120)]);
  saveDb(); await audit(input.provider, 'rotated', input.actorId, version, { status: 'active' }); const row = await rowFor(input.provider); return summaryFrom(row);
}
export async function changeProviderCredentialStatus(input: { provider: string; status: Exclude<ProviderCredentialStatus, 'active'>; actorId: string }): Promise<ProviderCredentialSummary> {
  if (!validProvider(input.provider)) throw new Error('Unsupported credential provider.'); const previous = await rowFor(input.provider); if (!previous) throw new Error('Credential has not been configured.');
  const db = await getDb(); db.run(`UPDATE provider_credentials SET status=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE provider=?`, [input.status, input.actorId.slice(0, 120), input.provider]); saveDb(); await audit(input.provider, input.status, input.actorId, Number(previous.version || 0), { status: input.status }); const row = await rowFor(input.provider); return summaryFrom(row);
}

async function probe(provider: ApprovedCredentialProvider, secret: string): Promise<{ status: CredentialTestStatus; message: string }> {
  const request = (url: string, init: RequestInit = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (provider === 'gemini') { const result = await request(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(secret)}`); return result.ok ? { status: 'verified', message: 'Gemini credential verified.' } : { status: 'failed', message: `Gemini rejected the credential (HTTP ${result.status}).` }; }
  if (provider === 'groq') { const result = await request('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${secret}` } }); return result.ok ? { status: 'verified', message: 'Groq credential verified.' } : { status: 'failed', message: `Groq rejected the credential (HTTP ${result.status}).` }; }
  if (provider === 'mistral') { const result = await request('https://api.mistral.ai/v1/models', { headers: { Authorization: `Bearer ${secret}` } }); return result.ok ? { status: 'verified', message: 'Mistral credential verified.' } : { status: 'failed', message: `Mistral rejected the credential (HTTP ${result.status}).` }; }
  if (provider === 'openrouter') { const result = await request('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${secret}` } }); return result.ok ? { status: 'verified', message: 'OpenRouter credential verified.' } : { status: 'failed', message: `OpenRouter rejected the credential (HTTP ${result.status}).` }; }
  if (provider === 'stripe') { const result = await request('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${secret}` } }); return result.ok ? { status: 'verified', message: 'Stripe credential verified.' } : { status: 'failed', message: `Stripe rejected the credential (HTTP ${result.status}).` }; }
  if (provider === 'telegram') { const result = await request(`https://api.telegram.org/bot${encodeURIComponent(secret)}/getMe`); return result.ok ? { status: 'verified', message: 'Telegram credential verified.' } : { status: 'failed', message: `Telegram rejected the credential (HTTP ${result.status}).` }; }
  return { status: 'unavailable', message: `${provider} requires provider-specific connection metadata; no connection claim was made.` };
}
export async function testProviderCredential(input: { provider: string; actorId: string }): Promise<ProviderCredentialSummary> {
  if (!validProvider(input.provider)) throw new Error('Unsupported credential provider.'); const previous = await rowFor(input.provider); if (!previous || previous.status !== 'active' || !previous.encrypted_secret) throw new Error('An active credential is required for testing.');
  const secret = decryptData(String(previous.encrypted_secret)); let result: { status: CredentialTestStatus; message: string };
  try { result = await probe(input.provider, secret); } catch (error) { result = { status: 'failed', message: `Credential connection test failed: ${safeMessage(error)}` }; }
  const db = await getDb(); db.run(`UPDATE provider_credentials SET last_test_status=?, last_test_message=?, last_verified_at=CASE WHEN ?='verified' THEN CURRENT_TIMESTAMP ELSE last_verified_at END, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE provider=?`, [result.status, result.message, result.status, input.actorId.slice(0, 120), input.provider]); saveDb(); await audit(input.provider, 'connection_test', input.actorId, Number(previous.version || 0), { testStatus: result.status }); const row = await rowFor(input.provider); return summaryFrom(row);
}
export async function listProviderCredentialAudit(provider: string, limit = 50) {
  if (!validProvider(provider)) throw new Error('Unsupported credential provider.'); await ensureSchema(); const db = await getDb(); const stmt = db.prepare(`SELECT id, provider, action, actor_id, version, detail, created_at FROM provider_credential_audit WHERE provider=? ORDER BY id DESC LIMIT ?`); stmt.bind([provider, Math.max(1, Math.min(100, limit))]); const rows: any[] = []; while (stmt.step()) { const row = stmt.getAsObject() as any; rows.push({ id: Number(row.id), provider: String(row.provider), action: String(row.action), actorId: String(row.actor_id), version: Number(row.version || 0), detail: row.detail ? JSON.parse(String(row.detail)) : {}, createdAt: String(row.created_at) }); } stmt.free(); return rows;
}
