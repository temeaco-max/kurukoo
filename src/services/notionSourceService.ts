import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { decryptStorageCredential, encryptStorageCredential, ensureStorageConnectionSchema } from './artifactService.js';
import { getFeatureFlagStatus } from './featureFlags.js';

const PROVIDER = 'notion';
const NOTION_VERSION = '2026-03-11';
const MAX_RESULTS = 25;
const MAX_QUERY_CHARS = 200;

type Connection = { phone: string; accessToken: string };
export type NotionConnectionStatus = { provider: 'notion'; configured: boolean; enabled: boolean; connected: boolean; featureFlagState: string; reason?: string };
export type NotionSearchItem = { id: string; object: 'page' | 'data_source'; title: string; lastEditedAt?: string; url?: string };
export type NotionSearchResult = { provider: 'notion'; items: NotionSearchItem[]; hasMore: boolean; query?: string };

function failure(code: string, message: string): Error & { code: string } { return Object.assign(new Error(message), { code }); }
function hash(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function requireOwner(value: string): string { const phone = String(value || '').trim(); if (!phone || phone.startsWith('anon_')) throw failure('NOTION_OWNER_REQUIRED', 'Notion sources require an authenticated owner.'); return phone; }
function sanitizeQuery(value: unknown): string { const query = String(value || '').trim().replace(/[\u0000-\u001F]/g, ' '); if (query.length > MAX_QUERY_CHARS) throw failure('NOTION_QUERY_INVALID', `Notion search terms may not exceed ${MAX_QUERY_CHARS} characters.`); return query; }
function config() {
  const clientId = String(process.env.KURUKOO_NOTION_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.KURUKOO_NOTION_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.KURUKOO_NOTION_REDIRECT_URI || '').trim();
  const configured = Boolean(clientId && clientSecret && redirectUri);
  const feature = getFeatureFlagStatus(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', PROVIDER);
  return { clientId, clientSecret, redirectUri, configured, enabled: feature.enabled, available: configured && feature.enabled, featureFlagState: feature.status };
}
function basicAuthorization(current: ReturnType<typeof config>): string { return `Basic ${Buffer.from(`${current.clientId}:${current.clientSecret}`, 'utf8').toString('base64')}`; }
function plainTitle(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((part) => String((part as any)?.plain_text || '')).join('').trim();
}
function extractTitle(item: any): string {
  const properties = item?.properties || {};
  for (const property of Object.values(properties) as any[]) {
    const title = plainTitle(property?.title);
    if (title) return title;
  }
  return plainTitle(item?.title) || 'Untitled shared item';
}

async function ensureSchema() {
  const db = await ensureStorageConnectionSchema();
  db.run(`CREATE TABLE IF NOT EXISTS external_source_reads (
    id TEXT PRIMARY KEY, phone TEXT NOT NULL, provider TEXT NOT NULL, source_hash TEXT NOT NULL,
    range_hash TEXT NOT NULL, status TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0, error_code TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_external_source_reads_owner ON external_source_reads(phone, provider, created_at DESC)');
  saveDb();
  return db;
}
async function readConnection(phone: string): Promise<Connection | null> {
  const db = await ensureSchema();
  const statement = db.prepare('SELECT access_token_encrypted, status FROM artifact_storage_connections WHERE phone=? AND provider=? LIMIT 1');
  statement.bind([phone, PROVIDER]);
  const row = statement.step() ? statement.getAsObject() as Record<string, unknown> : null;
  statement.free();
  if (!row || String(row.status) !== 'active' || !row.access_token_encrypted) return null;
  try { return { phone, accessToken: decryptStorageCredential(String(row.access_token_encrypted)) }; }
  catch { db.run('UPDATE artifact_storage_connections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['reauthorization_required', phone, PROVIDER]); saveDb(); return null; }
}
async function audit(phone: string, query: string, status: 'read' | 'failed', count = 0, errorCode?: string): Promise<void> {
  const db = await ensureSchema();
  db.run('INSERT INTO external_source_reads (id, phone, provider, source_hash, range_hash, status, row_count, column_count, error_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), phone, PROVIDER, hash('shared-search'), hash(query || '*'), status, count, 0, errorCode || null]);
  saveDb();
}
function markReauthorization(phone: string): Promise<void> { return ensureSchema().then((db) => { db.run('UPDATE artifact_storage_connections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['reauthorization_required', phone, PROVIDER]); saveDb(); }); }

export async function getNotionConnectionStatus(phoneValue: string): Promise<NotionConnectionStatus> {
  const phone = requireOwner(phoneValue); const current = config(); const connection = current.available ? await readConnection(phone) : null;
  const reason = !current.configured ? 'Notion public OAuth deployment credentials are not configured.' : !current.enabled ? 'Notion is configured but disabled by feature flag; no workspace content can be read.' : connection ? undefined : 'No active Notion connection exists for this owner.';
  return { provider: PROVIDER, configured: current.configured, enabled: current.enabled, connected: Boolean(connection), featureFlagState: current.featureFlagState, ...(reason ? { reason } : {}) };
}

export async function startNotionConnection(phoneValue: string): Promise<{ authorizationUrl: string; expiresAt: string }> {
  const phone = requireOwner(phoneValue); const current = config();
  if (!current.configured) throw failure('NOTION_OAUTH_NOT_CONFIGURED', 'Notion connection requires a configured public OAuth client, secret, and exact callback URI.');
  if (!current.enabled) throw failure('NOTION_FEATURE_DISABLED', 'Notion sources are disabled until their feature flag is explicitly enabled.');
  const state = crypto.randomBytes(32).toString('base64url'); const expiresAt = Date.now() + 10 * 60_000; const db = await ensureSchema();
  db.run('DELETE FROM artifact_oauth_states WHERE expires_at < ?', [Date.now()]);
  db.run('INSERT INTO artifact_oauth_states (state_hash, phone, provider, expires_at) VALUES (?, ?, ?, ?)', [hash(state), phone, PROVIDER, expiresAt]); saveDb();
  const url = new URL('https://api.notion.com/v1/oauth/authorize');
  url.searchParams.set('owner', 'user'); url.searchParams.set('client_id', current.clientId); url.searchParams.set('redirect_uri', current.redirectUri); url.searchParams.set('response_type', 'code'); url.searchParams.set('state', state);
  return { authorizationUrl: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
}

export async function completeNotionConnection(phoneValue: string, state: string, code: string): Promise<{ connected: true; provider: 'notion' }> {
  const phone = requireOwner(phoneValue); const current = config();
  if (!current.configured) throw failure('NOTION_OAUTH_NOT_CONFIGURED', 'Notion OAuth is not configured.');
  if (!current.enabled) throw failure('NOTION_FEATURE_DISABLED', 'Notion sources are disabled by feature flag.');
  const db = await ensureSchema(); const stateHash = hash(String(state || ''));
  const statement = db.prepare('SELECT phone, expires_at FROM artifact_oauth_states WHERE state_hash=? AND provider=? LIMIT 1'); statement.bind([stateHash, PROVIDER]);
  const row = statement.step() ? statement.getAsObject() as Record<string, unknown> : null; statement.free();
  if (!row || String(row.phone) !== phone || Number(row.expires_at || 0) < Date.now()) throw failure('NOTION_OAUTH_STATE_INVALID', 'Notion authorization state is invalid or expired.');
  db.run('DELETE FROM artifact_oauth_states WHERE state_hash=?', [stateHash]); saveDb();
  const response = await fetch('https://api.notion.com/v1/oauth/token', { method: 'POST', headers: { Authorization: basicAuthorization(current), 'Content-Type': 'application/json', 'Notion-Version': NOTION_VERSION }, body: JSON.stringify({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: current.redirectUri }) });
  const token = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string };
  if (!response.ok || !token.access_token) throw failure('NOTION_OAUTH_EXCHANGE_FAILED', 'Notion authorization code exchange failed.');
  db.run(`INSERT INTO artifact_storage_connections (phone, provider, access_token_encrypted, refresh_token_encrypted, expires_at, status, updated_at) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    ON CONFLICT(phone, provider) DO UPDATE SET access_token_encrypted=excluded.access_token_encrypted, refresh_token_encrypted=excluded.refresh_token_encrypted, expires_at=excluded.expires_at, status='active', updated_at=CURRENT_TIMESTAMP`, [phone, PROVIDER, encryptStorageCredential(token.access_token), token.refresh_token ? encryptStorageCredential(token.refresh_token) : null, Number.MAX_SAFE_INTEGER]);
  saveDb(); return { connected: true, provider: PROVIDER };
}

export async function searchNotion(phoneValue: string, value: unknown): Promise<NotionSearchResult> {
  const phone = requireOwner(phoneValue); const query = sanitizeQuery(value);
  try {
    const connection = await readConnection(phone); if (!connection) throw failure('NOTION_NOT_CONNECTED', 'No active Notion connection exists for this owner.');
    const response = await fetch('https://api.notion.com/v1/search', { method: 'POST', headers: { Authorization: `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json', 'Notion-Version': NOTION_VERSION }, body: JSON.stringify({ ...(query ? { query } : {}), page_size: MAX_RESULTS, filter: { property: 'object', value: 'page', in_trash: false }, sort: { direction: 'descending', timestamp: 'last_edited_time' } }) });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok) { if (response.status === 401 || response.status === 403) await markReauthorization(phone); throw failure(response.status === 401 || response.status === 403 ? 'NOTION_REAUTHORIZATION_REQUIRED' : 'NOTION_SEARCH_FAILED', `Notion did not confirm shared source access (HTTP ${response.status}).`); }
    const items = (Array.isArray(payload.results) ? payload.results : []).slice(0, MAX_RESULTS).filter((item: any) => item?.object === 'page' || item?.object === 'data_source').map((item: any) => ({ id: String(item.id || ''), object: item.object === 'data_source' ? 'data_source' : 'page', title: extractTitle(item).slice(0, 500), ...(item.last_edited_time ? { lastEditedAt: String(item.last_edited_time) } : {}), ...(item.url ? { url: String(item.url).slice(0, 2_000) } : {}) })).filter((item: NotionSearchItem) => Boolean(item.id));
    await audit(phone, query, 'read', items.length); return { provider: PROVIDER, items, hasMore: Boolean(payload.has_more), ...(query ? { query } : {}) };
  } catch (cause) { const code = String((cause as { code?: string })?.code || 'NOTION_SEARCH_FAILED'); await audit(phone, query, 'failed', 0, code).catch(() => undefined); throw cause; }
}

export async function revokeNotionConnection(phoneValue: string): Promise<{ revoked: boolean; providerRevocationConfirmed: boolean }> {
  const phone = requireOwner(phoneValue); const connection = await readConnection(phone); if (!connection) return { revoked: false, providerRevocationConfirmed: false };
  const current = config(); let providerRevocationConfirmed = false;
  if (current.configured) {
    const response = await fetch('https://api.notion.com/v1/oauth/revoke', { method: 'POST', headers: { Authorization: basicAuthorization(current), 'Content-Type': 'application/json', 'Notion-Version': NOTION_VERSION }, body: JSON.stringify({ token: connection.accessToken }) }).catch(() => null);
    providerRevocationConfirmed = Boolean(response?.ok);
  }
  const db = await ensureSchema(); db.run('UPDATE artifact_storage_connections SET status=?, access_token_encrypted=NULL, refresh_token_encrypted=NULL, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['revoked', phone, PROVIDER]); saveDb();
  return { revoked: true, providerRevocationConfirmed };
}

export const __notionInternal = { version: () => NOTION_VERSION, maxResults: MAX_RESULTS };
