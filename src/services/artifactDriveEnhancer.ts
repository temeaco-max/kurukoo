import { getDb, saveDb } from '../database.js';
import { decryptStorageCredential } from './artifactService.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function getConnection(phone: string) {
  const db = await getDb();
  const rows = db.exec('SELECT access_token_encrypted, refresh_token_encrypted, expires_at, status FROM artifact_storage_connections WHERE phone=? AND provider=? LIMIT 1', [phone, 'google_drive']);
  const row = rows[0]?.values?.[0]; if (!row) return null;
  const object = Object.fromEntries((rows[0].columns || []).map((column: string, i: number) => [column, row[i]]));
  if (String(object.status) !== 'active' || !object.refresh_token_encrypted) return null;
  try { return { accessToken: object.access_token_encrypted ? decryptStorageCredential(String(object.access_token_encrypted)) : '', refreshToken: decryptStorageCredential(String(object.refresh_token_encrypted)), expiresAt: Number(object.expires_at || 0) }; } catch { return null; }
}

async function refreshAccess(phone: string, connection: { accessToken: string; refreshToken: string; expiresAt: number }) {
  if (connection.accessToken && connection.expiresAt > Date.now() + 60_000) return connection.accessToken;
  const clientId = String(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: connection.refreshToken, grant_type: 'refresh_token' }) });
  if (!response.ok) return null;
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) return null;
  dbSaveToken(phone, token.access_token, Date.now() + Number(token.expires_in || 3600) * 1000);
  return token.access_token;
}

function dbSaveToken(phone: string, token: string, expiresAt: number) {
  const db = getDbSyncFallback();
  if (!db) return;
}

function getDbSyncFallback(): any { return null; }

async function driveJson<T>(token: string, url: string, init: RequestInit = {}): Promise<T | null> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!response.ok) return null;
  return await response.json() as T;
}

async function ensureFolder(token: string): Promise<string | null> {
  const rootQ = encodeURIComponent("name='Kurukoo' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const root = await driveJson<{ files?: Array<{ id?: string }> }>(token, `https://www.googleapis.com/drive/v3/files?q=${rootQ}&fields=files(id)&pageSize=10`);
  let rootId = root?.files?.[0]?.id;
  if (!rootId) { const created = await driveJson<{ id?: string }>(token, 'https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Kurukoo', mimeType: 'application/vnd.google-apps.folder' }) }); rootId = created?.id; }
  if (!rootId) return null;
  const artifactQ = encodeURIComponent(`name='Artifacts' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${rootId}' in parents`);
  const artifact = await driveJson<{ files?: Array<{ id?: string }> }>(token, `https://www.googleapis.com/drive/v3/files?q=${artifactQ}&fields=files(id)&pageSize=10`);
  if (artifact?.files?.[0]?.id) return artifact.files[0].id;
  const created = await driveJson<{ id?: string }>(token, 'https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Artifacts', mimeType: 'application/vnd.google-apps.folder', parents: [rootId] }) });
  return created?.id || null;
}

export async function normalizeArtifactDriveLocation(phone: string, artifactId: string): Promise<void> {
  const db = await getDb();
  const rows = db.exec('SELECT external_file_id FROM artifacts WHERE id=? AND phone=? AND deleted_at IS NULL LIMIT 1', [artifactId, phone]);
  const fileId = rows[0]?.values?.[0]?.[0]; if (!fileId) return;
  const connection = await getConnection(phone); if (!connection) return;
  const token = await refreshAccess(phone, connection); if (!token) return;
  const folderId = await ensureFolder(token); if (!folderId) return;
  const current = await driveJson<{ parents?: string[] }>(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(fileId))}?fields=parents`);
  const params = new URLSearchParams({ addParents: folderId, fields: 'id,webViewLink,webContentLink,thumbnailLink,parents,name,mimeType,size' });
  if (current?.parents?.length) params.set('removeParents', current.parents.join(','));
  const moved = await driveJson<{ id?: string; webViewLink?: string; webContentLink?: string; thumbnailLink?: string }>(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(fileId))}?${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
  const metadata = moved || await driveJson<{ id?: string; webViewLink?: string; webContentLink?: string; thumbnailLink?: string }>(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(fileId))}?fields=id,webViewLink,webContentLink,thumbnailLink`);
  db.run(`CREATE TABLE IF NOT EXISTS artifact_external_metadata (artifact_id TEXT PRIMARY KEY, provider TEXT NOT NULL, file_id TEXT NOT NULL, web_view_link TEXT, web_content_link TEXT, thumbnail_url TEXT, drive_folder_id TEXT, scope TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`INSERT INTO artifact_external_metadata (artifact_id,provider,file_id,web_view_link,web_content_link,thumbnail_url,drive_folder_id,scope,updated_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(artifact_id) DO UPDATE SET web_view_link=excluded.web_view_link,web_content_link=excluded.web_content_link,thumbnail_url=excluded.thumbnail_url,drive_folder_id=excluded.drive_folder_id,updated_at=CURRENT_TIMESTAMP`, [artifactId, 'google_drive', String(fileId), metadata?.webViewLink || null, metadata?.webContentLink || null, metadata?.thumbnailLink || null, folderId, DRIVE_SCOPE]);
  if (metadata?.webViewLink) db.run('UPDATE artifacts SET external_url=? WHERE id=? AND phone=?', [metadata.webViewLink, artifactId, phone]);
  saveDb();
}

export async function getArtifactWorkspaceRecords(phone: string) {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS artifact_external_metadata (artifact_id TEXT PRIMARY KEY, provider TEXT NOT NULL, file_id TEXT NOT NULL, web_view_link TEXT, web_content_link TEXT, thumbnail_url TEXT, drive_folder_id TEXT, scope TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  const rows = db.exec('SELECT a.*, m.web_view_link, m.web_content_link, m.thumbnail_url, m.drive_folder_id FROM artifacts a LEFT JOIN artifact_external_metadata m ON m.artifact_id=a.id WHERE a.phone=? AND a.deleted_at IS NULL ORDER BY a.created_at DESC LIMIT 500', [phone]);
  return (rows[0]?.values || []).map((row: unknown[]) => Object.fromEntries(rows[0].columns.map((column: string, i: number) => [column, row[i]])));
}
