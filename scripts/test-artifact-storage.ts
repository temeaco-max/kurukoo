import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.data', `artifact-storage-test-${process.pid}`);
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'artifact-storage-test-secret-0123456789abcdef';
process.env.KURUKOO_STORAGE_ENCRYPTION_KEY = 'artifact-storage-encryption-test-secret-0123456789abcdef';
process.env.KURUKOO_MANAGED_ARTIFACT_STORAGE_DIR = root;
process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID = 'test-client-id';
process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET = 'test-client-secret';
process.env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI = 'https://example.test/api/artifacts/drive/callback';
process.env.FF_TEST_GOOGLE_DRIVE = 'true';

const originalFetch = globalThis.fetch;
const { completeGoogleDriveConnection, createArtifact, deleteArtifactReference, getArtifact, getDriveConnectionStatus, listArtifacts, readManagedArtifact, revokeGoogleDriveConnection, setArtifactTranscript, startGoogleDriveConnection } = await import('../src/services/artifactService.js');
const { getDb } = await import('../src/database.js');

let externalDeleteCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) return new Response('', { status: 200, headers: { Location: 'https://upload.test/session' } });
  if (url === 'https://upload.test/session') return new Response(JSON.stringify({ id: 'drive-test-file-1', webViewLink: 'https://drive.test/file/1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('https://www.googleapis.com/drive/v3/files/drive-test-file-1') && init?.method === 'DELETE') { externalDeleteCalls += 1; return new Response(null, { status: 204 }); }
  if (url.startsWith('https://oauth2.googleapis.com/revoke')) return new Response('', { status: 200 });
  throw new Error(`Unexpected fetch ${url}`);
}) as typeof fetch;

try {
  const phoneA = '+2348030001111'; const phoneB = '+2348030002222';
  const initial = await getDriveConnectionStatus(phoneA);
  assert.equal(initial.configured, true);
  assert.equal(initial.enabled, true);
  assert.equal(initial.connected, false);

  const authorization = await startGoogleDriveConnection(phoneA);
  const oauthUrl = new URL(authorization.authorizationUrl);
  assert.equal(oauthUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file');
  assert.equal(oauthUrl.searchParams.get('access_type'), 'offline');
  assert.ok(oauthUrl.searchParams.get('state'));
  await assert.rejects(() => completeGoogleDriveConnection(phoneB, oauthUrl.searchParams.get('state')!, 'test-code'), /state is invalid/i, 'OAuth state must be bound to its initiating owner.');

  const completed = await completeGoogleDriveConnection(phoneA, oauthUrl.searchParams.get('state')!, 'test-code');
  assert.equal(completed.connected, true);
  const connected = await getDriveConnectionStatus(phoneA);
  assert.equal(connected.connected, true);
  const db = await getDb();
  const connection = db.exec("SELECT access_token_encrypted, refresh_token_encrypted FROM artifact_storage_connections WHERE phone='+2348030001111' AND provider='google_drive'")[0]?.values?.[0] as string[] | undefined;
  assert.ok(connection?.[0] && connection?.[1]);
  assert.notEqual(connection?.[0], 'test-access-token', 'Drive access tokens must not be stored in plaintext.');
  assert.notEqual(connection?.[1], 'test-refresh-token', 'Drive refresh tokens must not be stored in plaintext.');

  const driveArtifact = await createArtifact({ phone: phoneA, filename: 'voice.webm', mimeType: 'audio/webm', data: Buffer.from('voice bytes'), kind: 'voice', transcriptStatus: 'pending' });
  assert.equal(driveArtifact.storageProvider, 'google_drive');
  assert.equal(driveArtifact.durability, 'external_verified');
  assert.equal(driveArtifact.externalFileId, 'drive-test-file-1');
  const withTranscript = await setArtifactTranscript(phoneA, driveArtifact.id, 'verified transcript', 'available');
  assert.equal(withTranscript?.transcript, 'verified transcript');
  assert.equal(withTranscript?.transcriptStatus, 'available');
  assert.equal(await getArtifact(phoneB, driveArtifact.id), null, 'A different owner must never read another owner’s artifact record.');
  assert.equal((await listArtifacts(phoneA)).some(item => item.id === driveArtifact.id), true);
  assert.equal((await listArtifacts(phoneB)).some(item => item.id === driveArtifact.id), false);
  const referenceOnly = await deleteArtifactReference(phoneA, driveArtifact.id, false);
  assert.deepEqual(referenceOnly, { deleted: true, externalDeleted: false });
  assert.equal(externalDeleteCalls, 0, 'Reference deletion must never delete a Drive file without explicit request.');

  const secondAuthorization = await startGoogleDriveConnection(phoneA);
  await completeGoogleDriveConnection(phoneA, new URL(secondAuthorization.authorizationUrl).searchParams.get('state')!, 'test-code');
  const externalDelete = await createArtifact({ phone: phoneA, filename: 'photo.jpg', mimeType: 'image/jpeg', data: Buffer.from('image bytes') });
  const deleted = await deleteArtifactReference(phoneA, externalDelete.id, true);
  assert.deepEqual(deleted, { deleted: true, externalDeleted: true });
  assert.equal(externalDeleteCalls, 1, 'External deletion must happen only after explicit owner request.');

  await revokeGoogleDriveConnection(phoneA);
  const fallback = await createArtifact({ phone: phoneA, filename: 'offline.txt', mimeType: 'text/plain', data: Buffer.from('managed bytes') });
  assert.equal(fallback.storageProvider, 'kurukoo_managed');
  assert.equal(fallback.durability, 'managed_fallback');
  const local = await readManagedArtifact(phoneA, fallback.id);
  assert.equal(local?.data.toString(), 'managed bytes');
  assert.equal(await readManagedArtifact(phoneB, fallback.id), null, 'Managed artifacts must also remain owner-scoped.');
  await deleteArtifactReference(phoneA, fallback.id);
  assert.equal(await getArtifact(phoneA, fallback.id), null);

  console.log(JSON.stringify({ ok: true, assertions: ['drive_file_scope', 'csrf_owner_state', 'encrypted_tokens', 'external_verified_upload', 'managed_fallback', 'owner_isolation', 'transcript_state', 'explicit_external_deletion'] }));
} finally {
  globalThis.fetch = originalFetch;
  await fs.rm(root, { recursive: true, force: true });
}
