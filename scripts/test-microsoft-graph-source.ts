import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-ms-graph-'));
process.env.DB_PATH = path.join(root, 'database.sqlite'); process.env.NODE_ENV = 'test';
process.env.KURUKOO_STORAGE_ENCRYPTION_KEY = 'microsoft-source-encryption-test-secret-0123456789abcdef';
process.env.KURUKOO_MICROSOFT_CLIENT_ID = 'ms-client'; process.env.KURUKOO_MICROSOFT_CLIENT_SECRET = 'ms-secret'; process.env.KURUKOO_MICROSOFT_REDIRECT_URI = 'https://example.test/api/artifacts/microsoft/outlook/callback'; process.env.KURUKOO_MICROSOFT_TENANT = 'common';
process.env.FF_TEST_OUTLOOK = 'false'; process.env.FF_TEST_ONEDRIVE = 'false';

const originalFetch = globalThis.fetch;
const { __microsoftGraphInternal, completeMicrosoftConnection, getMicrosoftSourceStatus, listMicrosoftSource, revokeMicrosoftConnection, startMicrosoftConnection } = await import('../src/services/microsoftGraphSourceService.js');
const { getDb } = await import('../src/database.js');
try {
  const ownerA = '+2348030005555'; const ownerB = '+2348030006666';
  assert.deepEqual(__microsoftGraphInternal.scopes.outlook, ['openid', 'offline_access', 'Mail.ReadBasic']); assert.deepEqual(__microsoftGraphInternal.scopes.onedrive, ['openid', 'offline_access', 'Files.Read']);
  assert.equal((await getMicrosoftSourceStatus(ownerA, 'outlook')).enabled, false);
  await assert.rejects(() => startMicrosoftConnection(ownerA, 'outlook'), (error: any) => error?.code === 'MICROSOFT_FEATURE_DISABLED');
  process.env.FF_TEST_OUTLOOK = 'true'; process.env.FF_TEST_ONEDRIVE = 'true';
  const outlookAuth = await startMicrosoftConnection(ownerA, 'outlook'); const outlookUrl = new URL(outlookAuth.authorizationUrl);
  assert.equal(outlookUrl.pathname, '/common/oauth2/v2.0/authorize'); assert.equal(outlookUrl.searchParams.get('scope'), 'openid offline_access Mail.ReadBasic'); assert.equal(outlookUrl.searchParams.get('code_challenge_method'), 'S256'); assert.ok(outlookUrl.searchParams.get('state')); assert.ok(outlookUrl.searchParams.get('code_challenge'));
  const oneDriveAuth = await startMicrosoftConnection(ownerA, 'onedrive'); const oneDriveUrl = new URL(oneDriveAuth.authorizationUrl); assert.equal(oneDriveUrl.searchParams.get('scope'), 'openid offline_access Files.Read');
  const fetchCalls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); fetchCalls.push(url); const body = init?.body ? new URLSearchParams(String(init.body)) : null;
    if (url.endsWith('/oauth2/v2.0/token')) { assert.equal(body?.get('client_id'), 'ms-client'); assert.equal(body?.get('client_secret'), 'ms-secret'); assert.ok(['authorization_code', 'refresh_token'].includes(String(body?.get('grant_type')))); return new Response(JSON.stringify({ access_token: 'ms-access', refresh_token: 'ms-refresh', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
    if (url.startsWith('https://graph.microsoft.com/v1.0/me/messages')) { const parsed = new URL(url); assert.equal(parsed.searchParams.get('$top'), '25'); assert.equal(parsed.searchParams.get('$select'), 'id,subject,receivedDateTime,sender,webLink'); assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ms-access'); return new Response(JSON.stringify({ value: [{ id: 'mail-1', subject: 'Private receipt', receivedDateTime: '2026-08-19T10:00:00Z', sender: { emailAddress: { name: 'Vendor' } }, webLink: 'https://outlook.example/item' }], '@odata.nextLink': 'https://graph.example/next' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
    if (url.startsWith('https://graph.microsoft.com/v1.0/me/drive/root/children')) { const parsed = new URL(url); assert.equal(parsed.searchParams.get('$top'), '25'); assert.equal(parsed.searchParams.get('$select'), 'id,name,size,lastModifiedDateTime,folder,webUrl'); assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ms-access'); return new Response(JSON.stringify({ value: [{ id: 'file-1', name: 'Private file.pdf', lastModifiedDateTime: '2026-08-19T10:00:00Z', webUrl: 'https://onedrive.example/file' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
    throw new Error(`Unexpected Microsoft request: ${url}`);
  }) as typeof fetch;
  await completeMicrosoftConnection(ownerA, 'outlook', String(outlookUrl.searchParams.get('state')), 'outlook-code'); await completeMicrosoftConnection(ownerA, 'onedrive', String(oneDriveUrl.searchParams.get('state')), 'onedrive-code');
  const messages = await listMicrosoftSource(ownerA, 'outlook'); assert.equal(messages.items.length, 1); assert.equal(messages.items[0].title, 'Private receipt'); assert.equal(messages.hasMore, true);
  const files = await listMicrosoftSource(ownerA, 'onedrive'); assert.equal(files.items.length, 1); assert.equal(files.items[0].title, 'Private file.pdf'); assert.equal(files.hasMore, false);
  await assert.rejects(() => listMicrosoftSource(ownerB, 'outlook'), (error: any) => error?.code === 'MICROSOFT_NOT_CONNECTED');
  const db = await getDb(); const tokenStatement = db.prepare('SELECT access_token_encrypted, refresh_token_encrypted FROM artifact_storage_connections WHERE phone=? AND provider=?'); tokenStatement.bind([ownerA, 'microsoft_outlook']); assert.ok(tokenStatement.step()); const token = tokenStatement.getAsObject() as Record<string, unknown>; tokenStatement.free(); assert.match(String(token.access_token_encrypted), /^v1\./); assert.doesNotMatch(String(token.access_token_encrypted), /ms-access/);
  const auditStatement = db.prepare('SELECT provider, source_hash, range_hash, status FROM external_source_reads WHERE phone=? AND provider=?'); auditStatement.bind([ownerA, 'microsoft_outlook']); assert.ok(auditStatement.step()); const audit = auditStatement.getAsObject() as Record<string, unknown>; auditStatement.free(); assert.equal(audit.status, 'read'); assert.doesNotMatch(JSON.stringify(audit), /Private receipt|mail-1|Vendor/);
  assert.deepEqual(await revokeMicrosoftConnection(ownerA, 'outlook'), { revoked: true, providerRevocationConfirmed: false }); assert.equal((await getMicrosoftSourceStatus(ownerA, 'outlook')).connected, false); assert.ok(fetchCalls.some((url) => url.includes('/me/messages')) && fetchCalls.some((url) => url.includes('/me/drive/root/children')));
  console.log(JSON.stringify({ ok: true, assertions: ['separate_least_privilege_scopes', 'csrf_pkce_state', 'encrypted_tokens', 'disabled_feature_gates', 'bounded_outlook_read', 'bounded_onedrive_list', 'owner_isolation', 'non_content_audit', 'local_revocation_truth'] }));
} finally { globalThis.fetch = originalFetch; fs.rmSync(root, { recursive: true, force: true }); }
