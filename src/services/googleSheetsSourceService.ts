import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { decryptStorageCredential, encryptStorageCredential, ensureStorageConnectionSchema } from './artifactService.js';
import { getFeatureFlagStatus } from './featureFlags.js';

const PROVIDER = 'google_sheets';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const MAX_ROWS = 200;
const MAX_COLUMNS = 50;
const MAX_CELL_CHARS = 2_000;

type Connection = {
  phone: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type GoogleSheetsConnectionStatus = {
  provider: 'google_sheets';
  scope: string;
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  featureFlagState: string;
  reason?: string;
};

export type GoogleSheetsReadResult = {
  provider: 'google_sheets';
  spreadsheetId: string;
  range: string;
  majorDimension: 'ROWS';
  values: Array<Array<string | number | boolean | null>>;
  truncated: boolean;
};

function error(code: string, message: string): Error & { code: string } { return Object.assign(new Error(message), { code }); }
function hash(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function owner(phone: string): string {
  const normalized = String(phone || '').trim();
  if (!normalized || normalized.startsWith('anon_')) throw error('SHEETS_OWNER_REQUIRED', 'Google Sheets sources require an authenticated owner.');
  return normalized;
}
function config() {
  const clientId = String(process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.KURUKOO_GOOGLE_SHEETS_REDIRECT_URI || '').trim();
  const configured = Boolean(clientId && clientSecret && redirectUri);
  const feature = getFeatureFlagStatus(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', PROVIDER);
  return { clientId, clientSecret, redirectUri, configured, enabled: feature.enabled, available: configured && feature.enabled, featureFlagState: feature.status };
}
function boundedSpreadsheetId(value: unknown): string {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(id)) throw error('SHEETS_SOURCE_ID_INVALID', 'A valid Google Sheets spreadsheet ID is required.');
  return id;
}
function boundedRange(value: unknown): string {
  const range = String(value || '').trim();
  if (!range || range.length > 256 || /[\u0000-\u001F]/.test(range)) throw error('SHEETS_RANGE_INVALID', 'Use a valid A1 range no longer than 256 characters.');
  return range;
}
function safeCell(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value ?? '').slice(0, MAX_CELL_CHARS);
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
  const statement = db.prepare('SELECT access_token_encrypted, refresh_token_encrypted, expires_at, status FROM artifact_storage_connections WHERE phone=? AND provider=? LIMIT 1');
  statement.bind([phone, PROVIDER]);
  const row = statement.step() ? statement.getAsObject() as Record<string, unknown> : null;
  statement.free();
  if (!row || String(row.status) !== 'active' || !row.access_token_encrypted || !row.refresh_token_encrypted) return null;
  try {
    return { phone, accessToken: decryptStorageCredential(String(row.access_token_encrypted)), refreshToken: decryptStorageCredential(String(row.refresh_token_encrypted)), expiresAt: Number(row.expires_at || 0) };
  } catch {
    db.run('UPDATE artifact_storage_connections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['reauthorization_required', phone, PROVIDER]);
    saveDb();
    return null;
  }
}

async function refresh(connection: Connection): Promise<Connection> {
  if (connection.expiresAt > Date.now() + 60_000) return connection;
  const current = config();
  if (!current.configured) throw error('SHEETS_OAUTH_NOT_CONFIGURED', 'Google Sheets OAuth deployment credentials are not configured.');
  if (!current.enabled) throw error('SHEETS_FEATURE_DISABLED', 'Google Sheets sources are disabled by feature flag.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: current.clientId, client_secret: current.clientSecret, refresh_token: connection.refreshToken, grant_type: 'refresh_token' })
  });
  if (!response.ok) {
    const db = await ensureSchema();
    db.run('UPDATE artifact_storage_connections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['reauthorization_required', connection.phone, PROVIDER]);
    saveDb();
    throw error('SHEETS_REAUTHORIZATION_REQUIRED', 'Google Sheets authorization must be renewed.');
  }
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw error('SHEETS_TOKEN_INVALID', 'Google Sheets did not return a usable access token.');
  const expiresAt = Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000;
  const db = await ensureSchema();
  db.run('UPDATE artifact_storage_connections SET access_token_encrypted=?, expires_at=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', [encryptStorageCredential(token.access_token), expiresAt, connection.phone, PROVIDER]);
  saveDb();
  return { ...connection, accessToken: token.access_token, expiresAt };
}

async function recordRead(phone: string, spreadsheetId: string, range: string, status: 'read' | 'failed', rows = 0, columns = 0, errorCode?: string): Promise<void> {
  const db = await ensureSchema();
  db.run('INSERT INTO external_source_reads (id, phone, provider, source_hash, range_hash, status, row_count, column_count, error_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), phone, PROVIDER, hash(spreadsheetId), hash(range), status, rows, columns, errorCode || null]);
  saveDb();
}

export async function getGoogleSheetsConnectionStatus(phoneValue: string): Promise<GoogleSheetsConnectionStatus> {
  const phone = owner(phoneValue);
  const current = config();
  const connection = current.available ? await readConnection(phone) : null;
  const reason = !current.configured
    ? 'Google Sheets OAuth deployment credentials are not configured.'
    : !current.enabled
      ? 'Google Sheets is configured but disabled by feature flag; no spreadsheet data can be read.'
      : connection ? undefined : 'No active Google Sheets connection exists for this owner.';
  return { provider: PROVIDER, scope: SHEETS_SCOPE, configured: current.configured, enabled: current.enabled, connected: Boolean(connection), featureFlagState: current.featureFlagState, ...(reason ? { reason } : {}) };
}

export async function startGoogleSheetsConnection(phoneValue: string): Promise<{ authorizationUrl: string; expiresAt: string }> {
  const phone = owner(phoneValue);
  const current = config();
  if (!current.configured) throw error('SHEETS_OAUTH_NOT_CONFIGURED', 'Google Sheets connection requires a configured OAuth client, secret, and exact callback URI.');
  if (!current.enabled) throw error('SHEETS_FEATURE_DISABLED', 'Google Sheets sources are disabled until their feature flag is explicitly enabled.');
  const state = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 10 * 60_000;
  const db = await ensureSchema();
  db.run('DELETE FROM artifact_oauth_states WHERE expires_at < ?', [Date.now()]);
  db.run('INSERT INTO artifact_oauth_states (state_hash, phone, provider, expires_at) VALUES (?, ?, ?, ?)', [hash(state), phone, PROVIDER, expiresAt]);
  saveDb();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', current.clientId);
  url.searchParams.set('redirect_uri', current.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SHEETS_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return { authorizationUrl: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
}

export async function completeGoogleSheetsConnection(phoneValue: string, state: string, code: string): Promise<{ connected: true; provider: 'google_sheets'; scope: string }> {
  const phone = owner(phoneValue);
  const current = config();
  if (!current.configured) throw error('SHEETS_OAUTH_NOT_CONFIGURED', 'Google Sheets OAuth is not configured.');
  if (!current.enabled) throw error('SHEETS_FEATURE_DISABLED', 'Google Sheets sources are disabled by feature flag.');
  const db = await ensureSchema();
  const statement = db.prepare('SELECT phone, expires_at FROM artifact_oauth_states WHERE state_hash=? AND provider=? LIMIT 1');
  statement.bind([hash(String(state || '')) , PROVIDER]);
  const row = statement.step() ? statement.getAsObject() as Record<string, unknown> : null;
  statement.free();
  if (!row || String(row.phone) !== phone || Number(row.expires_at || 0) < Date.now()) throw error('SHEETS_OAUTH_STATE_INVALID', 'Google Sheets authorization state is invalid or expired.');
  db.run('DELETE FROM artifact_oauth_states WHERE state_hash=?', [hash(state)]);
  saveDb();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: String(code || ''), client_id: current.clientId, client_secret: current.clientSecret, redirect_uri: current.redirectUri, grant_type: 'authorization_code' })
  });
  if (!response.ok) throw error('SHEETS_OAUTH_EXCHANGE_FAILED', 'Google Sheets authorization code exchange failed.');
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!token.access_token || !token.refresh_token || !String(token.scope || '').split(/\s+/).includes(SHEETS_SCOPE)) throw error('SHEETS_OAUTH_SCOPE_OR_REFRESH_MISSING', 'Google Sheets did not grant the required offline read-only scope.');
  const expiresAt = Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000;
  db.run(`INSERT INTO artifact_storage_connections (phone, provider, access_token_encrypted, refresh_token_encrypted, expires_at, status, updated_at) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    ON CONFLICT(phone, provider) DO UPDATE SET access_token_encrypted=excluded.access_token_encrypted, refresh_token_encrypted=excluded.refresh_token_encrypted, expires_at=excluded.expires_at, status='active', updated_at=CURRENT_TIMESTAMP`, [phone, PROVIDER, encryptStorageCredential(token.access_token), encryptStorageCredential(token.refresh_token), expiresAt]);
  saveDb();
  return { connected: true, provider: PROVIDER, scope: SHEETS_SCOPE };
}

export async function readGoogleSheet(phoneValue: string, input: { spreadsheetId: unknown; range: unknown }): Promise<GoogleSheetsReadResult> {
  const phone = owner(phoneValue);
  const spreadsheetId = boundedSpreadsheetId(input.spreadsheetId);
  const range = boundedRange(input.range);
  try {
    const connection = await readConnection(phone);
    if (!connection) throw error('SHEETS_NOT_CONNECTED', 'No active Google Sheets connection exists for this owner.');
    const fresh = await refresh(connection);
    const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
    url.searchParams.set('majorDimension', 'ROWS');
    url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${fresh.accessToken}` } });
    if (!response.ok) throw error('SHEETS_READ_FAILED', `Google Sheets did not confirm source access (HTTP ${response.status}).`);
    const payload = await response.json() as { values?: unknown };
    const sourceRows = Array.isArray(payload.values) ? payload.values : [];
    const truncated = sourceRows.length > MAX_ROWS || sourceRows.some((row) => Array.isArray(row) && row.length > MAX_COLUMNS);
    const values = sourceRows.slice(0, MAX_ROWS).map((row) => Array.isArray(row) ? row.slice(0, MAX_COLUMNS).map(safeCell) : []);
    const columns = values.reduce((max, row) => Math.max(max, row.length), 0);
    await recordRead(phone, spreadsheetId, range, 'read', values.length, columns);
    return { provider: PROVIDER, spreadsheetId, range, majorDimension: 'ROWS', values, truncated };
  } catch (cause) {
    const code = String((cause as { code?: string })?.code || 'SHEETS_READ_FAILED');
    await recordRead(phone, spreadsheetId, range, 'failed', 0, 0, code).catch(() => undefined);
    throw cause;
  }
}

export async function revokeGoogleSheetsConnection(phoneValue: string): Promise<boolean> {
  const phone = owner(phoneValue);
  const connection = await readConnection(phone);
  if (!connection) return false;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.refreshToken)}`, { method: 'POST' }).catch(() => undefined);
  const db = await ensureSchema();
  db.run('UPDATE artifact_storage_connections SET status=?, access_token_encrypted=NULL, refresh_token_encrypted=NULL, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['revoked', phone, PROVIDER]);
  saveDb();
  return true;
}

export const __googleSheetsInternal = { scope: () => SHEETS_SCOPE, maxRows: MAX_ROWS, maxColumns: MAX_COLUMNS };
