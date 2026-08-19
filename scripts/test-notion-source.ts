import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-notion-source-'));
process.env.DB_PATH = path.join(root, 'database.sqlite');
process.env.NODE_ENV = 'test';
process.env.KURUKOO_STORAGE_ENCRYPTION_KEY = 'notion-source-encryption-test-secret-0123456789abcdef';
process.env.KURUKOO_NOTION_CLIENT_ID = 'notion-client-id';
process.env.KURUKOO_NOTION_CLIENT_SECRET = 'notion-client-secret';
process.env.KURUKOO_NOTION_REDIRECT_URI = 'https://example.test/api/artifacts/notion/callback';
process.env.FF_TEST_NOTION = 'false';

const originalFetch = globalThis.fetch;
const { completeNotionConnection, getNotionConnectionStatus, revokeNotionConnection, searchNotion, startNotionConnection } = await import('../src/services/notionSourceService.js');
const { getDb } = await import('../src/database.js');

try {
  const ownerA = '+2348030003333'; const ownerB = '+2348030004444';
  const disabled = await getNotionConnectionStatus(ownerA);
  assert.equal(disabled.configured, true); assert.equal(disabled.enabled, false); assert.equal(disabled.connected, false);
  await assert.rejects(() => startNotionConnection(ownerA), (cause: any) => cause?.code === 'NOTION_FEATURE_DISABLED');

  process.env.FF_TEST_NOTION = 'true';
  const authorization = await startNotionConnection(ownerA);
  const oauth = new URL(authorization.authorizationUrl);
  assert.equal(oauth.origin + oauth.pathname, 'https://api.notion.com/v1/oauth/authorize');
  assert.equal(oauth.searchParams.get('owner'), 'user'); assert.equal(oauth.searchParams.get('client_id'), 'notion-client-id');
  assert.equal(oauth.searchParams.get('redirect_uri'), process.env.KURUKOO_NOTION_REDIRECT_URI); assert.equal(oauth.searchParams.get('response_type'), 'code'); assert.ok(oauth.searchParams.get('state'));

  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, method: init?.method || 'GET' });
    const headers = new Headers(init?.headers);
    if (url === 'https://api.notion.com/v1/oauth/token') {
      assert.equal(headers.get('authorization'), `Basic ${Buffer.from('notion-client-id:notion-client-secret').toString('base64')}`);
      assert.equal(headers.get('notion-version'), '2026-03-11');
      assert.deepEqual(JSON.parse(String(init?.body)), { grant_type: 'authorization_code', code: 'notion-code', redirect_uri: process.env.KURUKOO_NOTION_REDIRECT_URI });
      return new Response(JSON.stringify({ access_token: 'notion-access-token', refresh_token: 'notion-refresh-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url === 'https://api.notion.com/v1/search') {
      assert.equal(headers.get('authorization'), 'Bearer notion-access-token'); assert.equal(headers.get('notion-version'), '2026-03-11');
      const request = JSON.parse(String(init?.body)); assert.equal(request.query, 'project'); assert.equal(request.page_size, 25); assert.deepEqual(request.filter, { property: 'object', value: 'page', in_trash: false });
      return new Response(JSON.stringify({ results: [{ id: 'page-1', object: 'page', url: 'https://www.notion.so/page-1', last_edited_time: '2026-08-19T10:00:00.000Z', properties: { Title: { title: [{ plain_text: 'Private project notes' }] } } }], has_more: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url === 'https://api.notion.com/v1/oauth/revoke') {
      assert.equal(headers.get('authorization'), `Basic ${Buffer.from('notion-client-id:notion-client-secret').toString('base64')}`);
      assert.deepEqual(JSON.parse(String(init?.body)), { token: 'notion-access-token' });
      return new Response(JSON.stringify({ request_id: 'revoke-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Unexpected Notion request: ${url}`);
  }) as typeof fetch;

  assert.deepEqual(await completeNotionConnection(ownerA, String(oauth.searchParams.get('state')), 'notion-code'), { connected: true, provider: 'notion' });
  assert.equal((await getNotionConnectionStatus(ownerA)).connected, true);
  const result = await searchNotion(ownerA, 'project');
  assert.deepEqual(result, { provider: 'notion', query: 'project', hasMore: false, items: [{ id: 'page-1', object: 'page', title: 'Private project notes', lastEditedAt: '2026-08-19T10:00:00.000Z', url: 'https://www.notion.so/page-1' }] });
  await assert.rejects(() => searchNotion(ownerB, 'project'), (cause: any) => cause?.code === 'NOTION_NOT_CONNECTED');
  await assert.rejects(() => searchNotion(ownerA, 'x'.repeat(201)), (cause: any) => cause?.code === 'NOTION_QUERY_INVALID');

  const db = await getDb();
  const tokenStatement = db.prepare('SELECT access_token_encrypted, refresh_token_encrypted FROM artifact_storage_connections WHERE phone=? AND provider=?'); tokenStatement.bind([ownerA, 'notion']); assert.ok(tokenStatement.step()); const tokenRow = tokenStatement.getAsObject() as Record<string, unknown>; tokenStatement.free();
  assert.match(String(tokenRow.access_token_encrypted), /^v1\./); assert.doesNotMatch(String(tokenRow.access_token_encrypted), /notion-access-token/); assert.match(String(tokenRow.refresh_token_encrypted), /^v1\./);
  const auditStatement = db.prepare('SELECT phone, provider, source_hash, range_hash, status, row_count FROM external_source_reads WHERE phone=? AND provider=?'); auditStatement.bind([ownerA, 'notion']); assert.ok(auditStatement.step()); const audit = auditStatement.getAsObject() as Record<string, unknown>; auditStatement.free();
  assert.equal(audit.status, 'read'); assert.equal(audit.row_count, 1); assert.doesNotMatch(JSON.stringify(audit), /Private project notes|page-1|project/, 'Notion audit must retain hashes and counts, not source values, titles, or IDs.');
  assert.deepEqual(await revokeNotionConnection(ownerA), { revoked: true, providerRevocationConfirmed: true }); assert.equal((await getNotionConnectionStatus(ownerA)).connected, false);
  assert.ok(calls.some((call) => call.url === 'https://api.notion.com/v1/oauth/revoke'), 'Disconnect must attempt documented provider revocation without manufacturing confirmation.');
  console.log(JSON.stringify({ ok: true, assertions: ['notion_oauth_state', 'basic_token_exchange', 'encrypted_tokens', 'disabled_feature_gate', 'bounded_shared_search', 'owner_isolation', 'non_content_audit', 'explicit_revocation'] }));
} finally { globalThis.fetch = originalFetch; fs.rmSync(root, { recursive: true, force: true }); }
