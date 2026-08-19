import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-sheets-source-'));
process.env.DB_PATH = path.join(root, 'database.sqlite');
process.env.NODE_ENV = 'test';
process.env.KURUKOO_STORAGE_ENCRYPTION_KEY = 'google-sheets-source-encryption-test-secret-0123456789abcdef';
process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_ID = 'sheets-client-id';
process.env.KURUKOO_GOOGLE_SHEETS_CLIENT_SECRET = 'sheets-client-secret';
process.env.KURUKOO_GOOGLE_SHEETS_REDIRECT_URI = 'https://example.test/api/artifacts/sheets/callback';
process.env.FF_TEST_GOOGLE_SHEETS = 'false';

const originalFetch = globalThis.fetch;
const { completeGoogleSheetsConnection, getGoogleSheetsConnectionStatus, readGoogleSheet, revokeGoogleSheetsConnection, startGoogleSheetsConnection } = await import('../src/services/googleSheetsSourceService.js');
const { getDb } = await import('../src/database.js');

try {
  const ownerA = '+2348030001111';
  const ownerB = '+2348030002222';
  const disabled = await getGoogleSheetsConnectionStatus(ownerA);
  assert.equal(disabled.configured, true);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.connected, false);
  assert.match(disabled.reason || '', /disabled by feature flag/i);
  await assert.rejects(() => startGoogleSheetsConnection(ownerA), (cause: any) => cause?.code === 'SHEETS_FEATURE_DISABLED');

  process.env.FF_TEST_GOOGLE_SHEETS = 'true';
  const authorization = await startGoogleSheetsConnection(ownerA);
  const oauthUrl = new URL(authorization.authorizationUrl);
  assert.equal(oauthUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/spreadsheets.readonly');
  assert.equal(oauthUrl.searchParams.get('access_type'), 'offline');
  assert.equal(oauthUrl.searchParams.get('redirect_uri'), process.env.KURUKOO_GOOGLE_SHEETS_REDIRECT_URI);
  assert.ok(oauthUrl.searchParams.get('state'));

  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET' });
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'sheets-access-token', refresh_token: 'sheets-refresh-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/')) {
      assert.match(String((init?.headers as Record<string, string>)?.Authorization || new Headers(init?.headers).get('authorization')), /Bearer sheets-access-token/);
      return new Response(JSON.stringify({ values: Array.from({ length: 202 }, (_, row) => Array.from({ length: 52 }, (_, column) => `${row}:${column}`)) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.startsWith('https://oauth2.googleapis.com/revoke')) return new Response('', { status: 200 });
    throw new Error(`Unexpected source request: ${url}`);
  }) as typeof fetch;

  const connected = await completeGoogleSheetsConnection(ownerA, String(oauthUrl.searchParams.get('state')), 'authorized-code');
  assert.deepEqual(connected, { connected: true, provider: 'google_sheets', scope: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
  const status = await getGoogleSheetsConnectionStatus(ownerA);
  assert.equal(status.connected, true);

  const spreadsheetId = 'sheet_identifier_1234567890';
  const source = await readGoogleSheet(ownerA, { spreadsheetId, range: 'Sheet1!A1:ZZ300' });
  assert.equal(source.provider, 'google_sheets');
  assert.equal(source.values.length, 200);
  assert.equal(source.values[0]?.length, 50);
  assert.equal(source.truncated, true);
  await assert.rejects(() => readGoogleSheet(ownerB, { spreadsheetId, range: 'Sheet1!A1' }), (cause: any) => cause?.code === 'SHEETS_NOT_CONNECTED');
  await assert.rejects(() => readGoogleSheet(ownerA, { spreadsheetId: 'bad id', range: 'Sheet1!A1' }), (cause: any) => cause?.code === 'SHEETS_SOURCE_ID_INVALID');

  const db = await getDb();
  const credential = db.prepare('SELECT access_token_encrypted, refresh_token_encrypted FROM artifact_storage_connections WHERE phone=? AND provider=?');
  credential.bind([ownerA, 'google_sheets']);
  assert.ok(credential.step(), 'Owner connection must be stored.');
  const credentialRow = credential.getAsObject() as Record<string, unknown>;
  credential.free();
  assert.match(String(credentialRow.access_token_encrypted), /^v1\./);
  assert.match(String(credentialRow.refresh_token_encrypted), /^v1\./);
  assert.doesNotMatch(String(credentialRow.access_token_encrypted), /sheets-access-token/);
  assert.doesNotMatch(String(credentialRow.refresh_token_encrypted), /sheets-refresh-token/);
  const audit = db.prepare('SELECT phone, provider, source_hash, range_hash, status, row_count, column_count, error_code FROM external_source_reads WHERE phone=? AND provider=? ORDER BY created_at DESC');
  audit.bind([ownerA, 'google_sheets']);
  assert.ok(audit.step(), 'A source-read audit record must be retained for the owner.');
  const auditRow = audit.getAsObject() as Record<string, unknown>;
  audit.free();
  assert.equal(auditRow.phone, ownerA);
  assert.equal(auditRow.provider, 'google_sheets');
  assert.equal(auditRow.status, 'read', 'A completed owner source read must retain audit metadata without source content.');
  assert.doesNotMatch(JSON.stringify(auditRow), /sheet_identifier|0:0/, 'Source audit must store hashes and metadata, not external IDs or cell content.');

  assert.equal(await revokeGoogleSheetsConnection(ownerA), true);
  assert.equal((await getGoogleSheetsConnectionStatus(ownerA)).connected, false);
  assert.ok(calls.some((call) => call.url.startsWith('https://oauth2.googleapis.com/revoke')), 'Revocation must request provider-side token revocation without treating its response as live source evidence.');
  console.log(JSON.stringify({ ok: true, assertions: ['sheets_readonly_scope', 'csrf_owner_state', 'encrypted_tokens', 'disabled_feature_gate', 'bounded_read', 'owner_isolation', 'non_content_audit', 'explicit_revocation'] }));
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(root, { recursive: true, force: true });
}
