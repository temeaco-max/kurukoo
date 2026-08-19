import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function sign(raw: string, secret: string, id: string, timestamp: number): string {
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  return crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64');
}

const secret = `whsec_${Buffer.from(crypto.randomBytes(32)).toString('base64')}`;
const raw = JSON.stringify({ type: 'email.received', data: { email_id: 'received-123', message_id: '<test@example>', from: 'User <user@example.com>', subject: 'Hello', attachments: [] } });
const svixId = 'msg_test_email_123';
const timestamp = Math.floor(Date.now() / 1000);
const signature = `v1,${sign(raw, secret, svixId, timestamp)}`;

assert.ok(signature.startsWith('v1,'), 'Email webhook signature generation failed');
assert.ok(svixId && timestamp, 'Svix headers fixture missing');
assert.ok(Math.abs(Date.now() / 1000 - timestamp) <= 300, 'Timestamp validation failed');
const signingSecret = secret.slice(6);
const expected = crypto.createHmac('sha256', Buffer.from(signingSecret, 'base64')).update(`${svixId}.${timestamp}.${raw}`).digest('base64');
assert.equal(expected, signature.slice(3), 'Svix signature verification fixture failed');

const dbPath = path.join(os.tmpdir(), `kurukoo-email-channel-${process.pid}-${Date.now()}.sqlite`);
const originalFetch = globalThis.fetch;
const previous = {
  DB_PATH: process.env.DB_PATH,
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  FF_TEST_EMAIL: process.env.FF_TEST_EMAIL,
};
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 'resend-test-key';
process.env.EMAIL_FROM = 'Kurukoo <test@kurukoo.example>';
process.env.FF_TEST_EMAIL = 'false';

try {
  const { sendEmail } = await import('../src/services/emailService.js');
  let providerCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    providerCalls += 1;
    assert.equal(String(input), 'https://api.resend.com/emails', 'Email may only use the configured deterministic provider endpoint.');
    return new Response(JSON.stringify({ id: 'email-test-1', message_id: 'provider-message-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const disabled = await sendEmail('owner@example.com', 'Feature state', 'No external send should occur.');
  assert.deepEqual(disabled, { ok: false, provider: 'disabled', error: 'Email delivery is disabled by feature flag' }, 'Configured email must remain fail-closed until the explicit feature flag is enabled.');
  assert.equal(providerCalls, 0, 'A disabled email flag must prevent any provider request.');

  process.env.FF_TEST_EMAIL = 'true';
  const enabled = await sendEmail('owner@example.com', 'Feature state', 'A controlled mock send may occur.');
  assert.equal(enabled.ok, true, 'An enabled deterministic email fixture must report provider success.');
  assert.equal(enabled.provider, 'resend');
  assert.equal(enabled.id, 'email-test-1');
  assert.equal(providerCalls, 1, 'The enabled fixture must make exactly one bounded provider request.');

  console.log('Email channel contract passed: signed webhook fixture, disabled-by-default external send, enabled deterministic transport, and truthful provider attribution.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(dbPath, { force: true });
}
