import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-sms-callback-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.KURUKOO_MAGIC_LINK_AUTH = 'false';
process.env.FF_SMS = 'false';

const { app } = await import('../src/index.js');
const { getChannelDeliveryState, recordChannelDispatch } = await import('../src/services/channelDeliveryState.js');

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object', 'The local test server must bind to an ephemeral port.');
const base = `http://127.0.0.1:${address.port}`;

async function postDeliveryReport(pathname: string, messageId: string) {
  const form = new URLSearchParams({
    id: messageId,
    status: 'Success',
    phoneNumber: '+2347000000412',
    networkCode: '99999',
  });
  const response = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const json = await response.json();
  return { response, json };
}

try {
  await recordChannelDispatch({ channel: 'sms', provider: 'africastalking', providerMessageId: 'at-root-callback-001', phone: '+2347000000412', status: 'accepted' });
  const root = await postDeliveryReport('/webhook/sms', 'at-root-callback-001');
  assert.equal(root.response.status, 200, 'The configured root callback path must accept Africa’s Talking form submissions.');
  assert.equal(root.json.status, 'success');
  assert.equal(root.json.deliveryStatus, 'delivered');

  await recordChannelDispatch({ channel: 'sms', provider: 'africastalking', providerMessageId: 'at-api-callback-001', phone: '+2347000000412', status: 'accepted' });
  const api = await postDeliveryReport('/api/webhook/sms', 'at-api-callback-001');
  assert.equal(api.response.status, 200, 'The legacy API-prefixed callback path must remain supported.');
  assert.equal(api.json.status, 'success');
  assert.equal(api.json.deliveryStatus, 'delivered');

  const unrelated = await postDeliveryReport('/webhook/sms', 'at-unrelated-callback-001');
  assert.equal(unrelated.response.status, 200, 'Unrelated delivery reports are acknowledged without becoming a delivery claim.');
  assert.equal(unrelated.json.deliveryStatus, 'unknown');
  assert.equal(await getChannelDeliveryState('sms', 'africastalking', 'at-unrelated-callback-001'), null, 'An uncorrelated callback must not create durable delivery state.');

  console.log(JSON.stringify({ passed: true, routes: ['/webhook/sms', '/api/webhook/sms'], payload: 'form_urlencoded_delivery_report', protectsUncorrelatedDeliveryReports: true }, null, 2));
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary database cleanup is best-effort */ }
}
