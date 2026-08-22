import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.KURUKOO_EXTERNAL_AUTO_ACTIVATE = 'false';
process.env.KURUKOO_AUTH_MAX_REQUESTS = '500';
process.env.JWT_SECRET = 'provider-message-delivery-test-secret-32';

const { app } = await import('../src/index.ts');
const { getDb, saveDb } = await import('../src/database.ts');

const suffix = crypto.randomUUID();
const customer = `provider_message_customer_${suffix}@example.com`;
const provider = `provider_message_provider_${suffix}@example.com`;
const unrelated = `provider_message_unrelated_${suffix}@example.com`;
const customerMessage = 'Customer: I will be ready at the agreed collection time.';
const providerMessage = 'Provider: Collection time confirmed.';
const tokenFor = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '15m' });

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const { port } = server.address() as AddressInfo;

async function api(phone: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${tokenFor(phone)}`, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) as any };
}

try {
  const created = await api(customer, '/api/provider-communication/sessions', {
    method: 'POST',
    body: JSON.stringify({ providerPhone: provider, economicRequestId: `provider-message-contract-${suffix}`, mode: 'webrtc_tracking' }),
  });
  assert.equal(created.status, 201);
  const session = created.body.session;
  assert.ok(session.id);
  assert.ok(session.conversationId, 'provider session must allocate a canonical conversation');

  const customerPost = await api(customer, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: 'POST', body: JSON.stringify({ content: customerMessage }),
  });
  assert.equal(customerPost.status, 201);
  assert.equal(customerPost.body.conversationId, session.conversationId);

  const providerTranscript = await api(provider, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/messages`);
  assert.equal(providerTranscript.status, 200);
  assert.ok(providerTranscript.body.messages.some((message: any) => message.content === customerMessage), 'provider must receive the customer message through the canonical session transcript');

  const providerPost = await api(provider, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: 'POST', body: JSON.stringify({ content: providerMessage }),
  });
  assert.equal(providerPost.status, 201);

  const customerTranscript = await api(customer, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/messages`);
  assert.equal(customerTranscript.status, 200);
  assert.ok(customerTranscript.body.messages.some((message: any) => message.content === customerMessage));
  assert.ok(customerTranscript.body.messages.some((message: any) => message.content === providerMessage), 'customer must receive the provider response through the canonical session transcript');

  const customerHistory = await api(customer, `/api/chat/history?conversationId=${encodeURIComponent(session.conversationId)}`);
  assert.equal(customerHistory.status, 200);
  assert.ok(customerHistory.body.messages.some((message: any) => message.content === customerMessage));
  assert.ok(customerHistory.body.messages.some((message: any) => message.content === providerMessage), 'customer-owned canonical history must contain the provider response');

  const unrelatedTranscript = await api(unrelated, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/messages`);
  assert.equal(unrelatedTranscript.status, 403);

  const ended = await api(customer, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/end`, { method: 'POST', body: '{}' });
  assert.equal(ended.status, 200);
  const closedWrite = await api(provider, `/api/provider-communication/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: 'POST', body: JSON.stringify({ content: 'This must not be persisted after the session ends.' }),
  });
  assert.equal(closedWrite.status, 409);

  console.log(JSON.stringify({ passed: true, sessionId: session.id, conversationId: session.conversationId }, null, 2));
} finally {
  const db = await getDb();
  db.run('DELETE FROM provider_communication_sessions WHERE customer_phone=? OR provider_phone=?', [customer, provider]);
  db.run('DELETE FROM messages WHERE phone=?', [customer]);
  db.run('DELETE FROM chat_conversations WHERE phone=?', [customer]);
  saveDb(true);
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
