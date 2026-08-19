import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb, saveDb } from '../database.js';
import { getFeatureFlagStatus } from './featureFlags.js';

export type ArtifactKind = 'voice' | 'image' | 'video' | 'document' | 'other';
export type ArtifactStorageProvider = 'google_drive' | 'kurukoo_managed';
export type ArtifactDurability = 'external_verified' | 'managed_fallback';

export interface ArtifactRecord {
  id: string;
  phone: string;
  kind: ArtifactKind;
  filename: string;
  mimeType: string;
  bytes: number;
  storageProvider: ArtifactStorageProvider;
  durability: ArtifactDurability;
  externalFileId?: string;
  externalUrl?: string;
  managedPath?: string;
  transcript?: string;
  transcriptStatus: 'not_requested' | 'pending' | 'available' | 'failed';
  createdAt: string;
}

type DriveConnection = {
  phone: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  status: 'active' | 'revoked' | 'reauthorization_required';
};

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const MAX_BYTES = Math.max(1_024, Math.min(35 * 1024 * 1024, Number(process.env.KURUKOO_ARTIFACT_MAX_BYTES) || 25 * 1024 * 1024));

function nowIso(): string { return new Date().toISOString(); }
function cleanFilename(value: unknown): string {
  const name = path.basename(String(value || 'artifact')).replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 160).trim();
  return name || 'artifact';
}
function cleanMime(value: unknown): string {
  const mime = String(value || 'application/octet-stream').trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime) ? mime.slice(0, 120) : 'application/octet-stream';
}
function kindForMime(mime: string): ArtifactKind {
  if (mime.startsWith('audio/')) return 'voice';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('pdf') || mime.includes('document') || mime.startsWith('text/')) return 'document';
  return 'other';
}
function keyMaterial(): Buffer {
  const source = String(process.env.KURUKOO_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY || process.env.JWT_SECRET || '').trim();
  if (source.length < 32) throw Object.assign(new Error('Artifact credential encryption is unavailable.'), { code: 'ARTIFACT_ENCRYPTION_UNAVAILABLE' });
  return crypto.createHash('sha256').update(source).digest();
}
export function encryptStorageCredential(value: string): string {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}
export function decryptStorageCredential(value: string): string {
  const [version, iv, tag, ciphertext] = String(value || '').split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw Object.assign(new Error('Stored artifact credential is invalid.'), { code: 'ARTIFACT_CREDENTIAL_INVALID' });
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

export async function ensureStorageConnectionSchema() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS artifact_storage_connections (
    phone TEXT NOT NULL, provider TEXT NOT NULL, access_token_encrypted TEXT, refresh_token_encrypted TEXT,
    expires_at INTEGER, status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(phone, provider)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS artifact_oauth_states (
    state_hash TEXT PRIMARY KEY, phone TEXT NOT NULL, provider TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  const oauthStateColumns = db.exec('PRAGMA table_info(artifact_oauth_states)')[0]?.values?.map((row: unknown[]) => String(row[1])) || [];
  if (!oauthStateColumns.includes('code_verifier_encrypted')) db.run('ALTER TABLE artifact_oauth_states ADD COLUMN code_verifier_encrypted TEXT');
  db.run(`CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY, phone TEXT NOT NULL, kind TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL,
    bytes INTEGER NOT NULL, storage_provider TEXT NOT NULL, durability TEXT NOT NULL, external_file_id TEXT,
    external_url TEXT, managed_path TEXT, transcript TEXT, transcript_status TEXT NOT NULL DEFAULT 'not_requested',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_artifacts_phone_created ON artifacts(phone, created_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_artifact_oauth_state_expiry ON artifact_oauth_states(expires_at)');
  saveDb();
  return db;
}

function driveConfig() {
  const clientId = String(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI || '').trim();
  const configured = Boolean(clientId && clientSecret && redirectUri);
  const feature = getFeatureFlagStatus(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'google_drive');
  return { clientId, clientSecret, redirectUri, configured, enabled: feature.enabled, available: configured && feature.enabled, featureFlagState: feature.status };
}
function stateHash(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function safeErrorCode(error: unknown): string { return String((error as { code?: string })?.code || 'ARTIFACT_STORAGE_FAILED').slice(0, 80); }

async function readConnection(phone: string): Promise<DriveConnection | null> {
  const db = await ensureStorageConnectionSchema();
  const stmt = db.prepare('SELECT access_token_encrypted, refresh_token_encrypted, expires_at, status FROM artifact_storage_connections WHERE phone=? AND provider=? LIMIT 1');
  stmt.bind([phone, 'google_drive']);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null; stmt.free();
  if (!row || String(row.status) !== 'active' || !row.access_token_encrypted || !row.refresh_token_encrypted) return null;
  try {
    return { phone, accessToken: decryptStorageCredential(String(row.access_token_encrypted)), refreshToken: decryptStorageCredential(String(row.refresh_token_encrypted)), expiresAt: Number(row.expires_at || 0), status: 'active' };
  } catch {
    db.run('UPDATE artifact_storage_connections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['reauthorization_required', phone, 'google_drive']); saveDb();
    return null;
  }
}

async function refreshDriveConnection(connection: DriveConnection): Promise<DriveConnection> {
  if (connection.expiresAt > Date.now() + 60_000) return connection;
  const config = driveConfig();
  if (!config.configured) throw Object.assign(new Error('Google Drive connection needs deployment OAuth configuration.'), { code: 'DRIVE_OAUTH_NOT_CONFIGURED' });
  if (!config.enabled) throw Object.assign(new Error('Google Drive persistence is disabled by feature flag.'), { code: 'DRIVE_FEATURE_DISABLED' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: connection.refreshToken, grant_type: 'refresh_token' }) });
  if (!response.ok) {
    const db = await ensureStorageConnectionSchema(); db.run('UPDATE artifact_storage_connections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['reauthorization_required', connection.phone, 'google_drive']); saveDb();
    throw Object.assign(new Error('Google Drive authorization must be renewed.'), { code: 'DRIVE_REAUTHORIZATION_REQUIRED' });
  }
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw Object.assign(new Error('Google Drive did not return an access token.'), { code: 'DRIVE_TOKEN_INVALID' });
  const expiresAt = Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000;
  const db = await ensureStorageConnectionSchema();
  db.run('UPDATE artifact_storage_connections SET access_token_encrypted=?, expires_at=?, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', [encryptStorageCredential(token.access_token), expiresAt, connection.phone, 'google_drive']); saveDb();
  return { ...connection, accessToken: token.access_token, expiresAt };
}

async function uploadToDrive(phone: string, filename: string, mimeType: string, data: Buffer): Promise<{ id: string; url?: string }> {
  const connection = await readConnection(phone);
  if (!connection) throw Object.assign(new Error('No active Google Drive connection exists for this owner.'), { code: 'DRIVE_NOT_CONNECTED' });
  const fresh = await refreshDriveConnection(connection);
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,name,mimeType,size', {
    method: 'POST', headers: { Authorization: `Bearer ${fresh.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(data.length) }, body: JSON.stringify({ name: filename, mimeType }),
  });
  const sessionUrl = init.headers.get('location');
  if (!init.ok || !sessionUrl) throw Object.assign(new Error('Google Drive did not create an upload session.'), { code: 'DRIVE_UPLOAD_INIT_FAILED' });
  const uploaded = await fetch(sessionUrl, { method: 'PUT', headers: { 'Content-Type': mimeType, 'Content-Length': String(data.length) }, body: data });
  if (!uploaded.ok) throw Object.assign(new Error('Google Drive did not confirm artifact persistence.'), { code: 'DRIVE_UPLOAD_FAILED' });
  const body = await uploaded.json() as { id?: string; webViewLink?: string };
  if (!body.id) throw Object.assign(new Error('Google Drive upload returned no file ID.'), { code: 'DRIVE_UPLOAD_UNVERIFIED' });
  return { id: body.id, url: body.webViewLink };
}

function managedDirectory(): string { return path.resolve(String(process.env.KURUKOO_MANAGED_ARTIFACT_STORAGE_DIR || path.join(process.cwd(), '.data', 'artifacts'))); }
async function uploadManaged(id: string, data: Buffer): Promise<string> {
  const dir = managedDirectory(); await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const target = path.join(dir, id);
  await fs.writeFile(target, data, { mode: 0o600 });
  const saved = await fs.stat(target); if (saved.size !== data.length) throw Object.assign(new Error('Managed artifact verification failed.'), { code: 'MANAGED_ARTIFACT_UNVERIFIED' });
  return target;
}

export async function getDriveConnectionStatus(phone: string): Promise<{ configured: boolean; enabled: boolean; connected: boolean; provider: 'google_drive'; scope: string; featureFlagState: string; reason?: string }> {
  const config = driveConfig();
  const connection = config.available ? await readConnection(phone) : null;
  const reason = !config.configured
    ? 'Google Drive OAuth deployment credentials are not configured.'
    : !config.enabled
      ? 'Google Drive persistence is configured but disabled by feature flag; managed owner-scoped storage remains active.'
      : connection ? undefined : 'No active Google Drive connection exists for this owner.';
  return { configured: config.configured, enabled: config.enabled, connected: Boolean(connection), provider: 'google_drive', scope: DRIVE_SCOPE, featureFlagState: config.featureFlagState, ...(reason ? { reason } : {}) };
}

export async function startGoogleDriveConnection(phone: string): Promise<{ authorizationUrl: string; expiresAt: string }> {
  const config = driveConfig();
  if (!config.configured) throw Object.assign(new Error('Google Drive connection is unavailable until its OAuth client, secret, and exact callback URI are configured.'), { code: 'DRIVE_OAUTH_NOT_CONFIGURED' });
  if (!config.enabled) throw Object.assign(new Error('Google Drive connection is disabled until its feature flag is explicitly enabled.'), { code: 'DRIVE_FEATURE_DISABLED' });
  const state = crypto.randomBytes(32).toString('base64url'); const expiresAt = Date.now() + 10 * 60_000;
  const db = await ensureStorageConnectionSchema(); db.run('DELETE FROM artifact_oauth_states WHERE expires_at < ?', [Date.now()]); db.run('INSERT INTO artifact_oauth_states (state_hash, phone, provider, expires_at) VALUES (?, ?, ?, ?)', [stateHash(state), phone, 'google_drive', expiresAt]); saveDb();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', config.redirectUri); url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', DRIVE_SCOPE); url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); url.searchParams.set('include_granted_scopes', 'true'); url.searchParams.set('state', state);
  return { authorizationUrl: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
}

export async function completeGoogleDriveConnection(phone: string, state: string, code: string): Promise<{ connected: true; provider: 'google_drive'; scope: string }> {
  const config = driveConfig(); if (!config.configured) throw Object.assign(new Error('Google Drive OAuth is not configured.'), { code: 'DRIVE_OAUTH_NOT_CONFIGURED' }); if (!config.enabled) throw Object.assign(new Error('Google Drive OAuth is disabled by feature flag.'), { code: 'DRIVE_FEATURE_DISABLED' });
  const db = await ensureStorageConnectionSchema(); const hash = stateHash(state); const stmt = db.prepare('SELECT phone, expires_at FROM artifact_oauth_states WHERE state_hash=? AND provider=? LIMIT 1'); stmt.bind([hash, 'google_drive']); const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null; stmt.free();
  if (!row || String(row.phone) !== phone || Number(row.expires_at || 0) < Date.now()) throw Object.assign(new Error('Google Drive authorization state is invalid or expired.'), { code: 'DRIVE_OAUTH_STATE_INVALID' });
  db.run('DELETE FROM artifact_oauth_states WHERE state_hash=?', [hash]); saveDb();
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }) });
  if (!response.ok) throw Object.assign(new Error('Google Drive authorization code exchange failed.'), { code: 'DRIVE_OAUTH_EXCHANGE_FAILED' });
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!token.access_token || !token.refresh_token || !String(token.scope || '').split(/\s+/).includes(DRIVE_SCOPE)) throw Object.assign(new Error('Google Drive did not grant the required offline file scope.'), { code: 'DRIVE_OAUTH_SCOPE_OR_REFRESH_MISSING' });
  const expiresAt = Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000;
  db.run(`INSERT INTO artifact_storage_connections (phone, provider, access_token_encrypted, refresh_token_encrypted, expires_at, status, updated_at) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    ON CONFLICT(phone, provider) DO UPDATE SET access_token_encrypted=excluded.access_token_encrypted, refresh_token_encrypted=excluded.refresh_token_encrypted, expires_at=excluded.expires_at, status='active', updated_at=CURRENT_TIMESTAMP`, [phone, 'google_drive', encryptStorageCredential(token.access_token), encryptStorageCredential(token.refresh_token), expiresAt]); saveDb();
  return { connected: true, provider: 'google_drive', scope: DRIVE_SCOPE };
}

export async function revokeGoogleDriveConnection(phone: string): Promise<boolean> {
  const connection = await readConnection(phone); const db = await ensureStorageConnectionSchema();
  if (!connection) return false;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.refreshToken)}`, { method: 'POST' }).catch(() => undefined);
  db.run('UPDATE artifact_storage_connections SET status=?, access_token_encrypted=NULL, refresh_token_encrypted=NULL, updated_at=CURRENT_TIMESTAMP WHERE phone=? AND provider=?', ['revoked', phone, 'google_drive']); saveDb();
  return true;
}

export async function createArtifact(input: { phone: string; filename: string; mimeType: string; data: Buffer; kind?: ArtifactKind; transcript?: string; transcriptStatus?: ArtifactRecord['transcriptStatus'] }): Promise<ArtifactRecord> {
  const phone = String(input.phone || '').trim(); if (!phone || phone.startsWith('anon_')) throw Object.assign(new Error('Artifact persistence requires an authenticated owner.'), { code: 'ARTIFACT_OWNER_REQUIRED' });
  const data = Buffer.from(input.data || []); if (!data.length || data.length > MAX_BYTES) throw Object.assign(new Error(`Artifact must contain data and may not exceed ${MAX_BYTES} bytes.`), { code: 'ARTIFACT_SIZE_INVALID' });
  const id = crypto.randomUUID(); const filename = cleanFilename(input.filename); const mimeType = cleanMime(input.mimeType); const kind = input.kind || kindForMime(mimeType);
  let storageProvider: ArtifactStorageProvider = 'kurukoo_managed'; let durability: ArtifactDurability = 'managed_fallback'; let externalFileId: string | undefined; let externalUrl: string | undefined; let managedPath: string | undefined;
  try { const drive = await uploadToDrive(phone, filename, mimeType, data); storageProvider = 'google_drive'; durability = 'external_verified'; externalFileId = drive.id; externalUrl = drive.url || `https://drive.google.com/open?id=${encodeURIComponent(drive.id)}`; }
  catch (error) {
    const code = safeErrorCode(error); if (code !== 'DRIVE_NOT_CONNECTED' && code !== 'DRIVE_OAUTH_NOT_CONFIGURED' && code !== 'DRIVE_FEATURE_DISABLED' && code !== 'DRIVE_REAUTHORIZATION_REQUIRED') throw error;
    managedPath = await uploadManaged(id, data);
  }
  const record: ArtifactRecord = { id, phone, kind, filename, mimeType, bytes: data.length, storageProvider, durability, externalFileId, externalUrl, managedPath, transcript: input.transcript?.slice(0, 20_000), transcriptStatus: input.transcriptStatus || 'not_requested', createdAt: nowIso() };
  const db = await ensureStorageConnectionSchema(); db.run('INSERT INTO artifacts (id, phone, kind, filename, mime_type, bytes, storage_provider, durability, external_file_id, external_url, managed_path, transcript, transcript_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [record.id, phone, kind, filename, mimeType, data.length, storageProvider, durability, externalFileId || null, externalUrl || null, managedPath || null, record.transcript || null, record.transcriptStatus, record.createdAt]); saveDb();
  return record;
}

function rowToArtifact(row: Record<string, unknown>): ArtifactRecord { return { id: String(row.id), phone: String(row.phone), kind: String(row.kind) as ArtifactKind, filename: String(row.filename), mimeType: String(row.mime_type), bytes: Number(row.bytes), storageProvider: String(row.storage_provider) as ArtifactStorageProvider, durability: String(row.durability) as ArtifactDurability, ...(row.external_file_id ? { externalFileId: String(row.external_file_id) } : {}), ...(row.external_url ? { externalUrl: String(row.external_url) } : {}), ...(row.managed_path ? { managedPath: String(row.managed_path) } : {}), ...(row.transcript ? { transcript: String(row.transcript) } : {}), transcriptStatus: String(row.transcript_status || 'not_requested') as ArtifactRecord['transcriptStatus'], createdAt: String(row.created_at) }; }
export async function listArtifacts(phone: string): Promise<ArtifactRecord[]> { const db = await ensureStorageConnectionSchema(); const stmt = db.prepare('SELECT * FROM artifacts WHERE phone=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200'); stmt.bind([phone]); const result: ArtifactRecord[] = []; while (stmt.step()) result.push(rowToArtifact(stmt.getAsObject() as Record<string, unknown>)); stmt.free(); return result; }
export async function getArtifact(phone: string, id: string): Promise<ArtifactRecord | null> { const db = await ensureStorageConnectionSchema(); const stmt = db.prepare('SELECT * FROM artifacts WHERE id=? AND phone=? AND deleted_at IS NULL LIMIT 1'); stmt.bind([id, phone]); const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null; stmt.free(); return row ? rowToArtifact(row) : null; }
export async function readManagedArtifact(phone: string, id: string): Promise<{ artifact: ArtifactRecord; data: Buffer } | null> { const artifact = await getArtifact(phone, id); if (!artifact?.managedPath) return null; try { return { artifact, data: await fs.readFile(artifact.managedPath) }; } catch { return null; } }
export async function setArtifactTranscript(phone: string, id: string, transcript: string | undefined, status: ArtifactRecord['transcriptStatus']): Promise<ArtifactRecord | null> { const current = await getArtifact(phone, id); if (!current) return null; const db = await ensureStorageConnectionSchema(); db.run('UPDATE artifacts SET transcript=?, transcript_status=? WHERE id=? AND phone=?', [transcript ? transcript.slice(0, 20_000) : null, status, id, phone]); saveDb(); return getArtifact(phone, id); }
export async function deleteArtifactReference(phone: string, id: string, deleteExternal = false): Promise<{ deleted: boolean; externalDeleted: boolean }> { const artifact = await getArtifact(phone, id); if (!artifact) return { deleted: false, externalDeleted: false }; let externalDeleted = false;
  if (deleteExternal && artifact.storageProvider === 'google_drive' && artifact.externalFileId) { const connection = await readConnection(phone); if (!connection) throw Object.assign(new Error('Google Drive must be connected before deleting its external file.'), { code: 'DRIVE_NOT_CONNECTED' }); const fresh = await refreshDriveConnection(connection); const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(artifact.externalFileId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${fresh.accessToken}` } }); if (!response.ok && response.status !== 404) throw Object.assign(new Error('Google Drive file deletion was not confirmed.'), { code: 'DRIVE_DELETE_FAILED' }); externalDeleted = true; }
  if (artifact.managedPath) await fs.rm(artifact.managedPath, { force: true }).catch(() => undefined);
  const db = await ensureStorageConnectionSchema(); db.run('UPDATE artifacts SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?', [id, phone]); saveDb(); return { deleted: true, externalDeleted }; }

export const __artifactInternal = { encryptSecret: encryptStorageCredential, decryptSecret: decryptStorageCredential, kindForMime, extractDriveScope: () => DRIVE_SCOPE };
