import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-provider-coordination-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'provider_coordination_test_secret_with_32_characters';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const { ensureProviderVerificationSchema, setProviderVerification } = await import('../src/services/providerVerification.js');
const db = await getDb();
await ensureProviderVerificationSchema();
const customerPhone = '+2348010001001';
const providerPhone = '+2348010002002';

db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,verified_provider,provider_type,is_available) VALUES(?,?,?,?,?,?,?)`, [customerPhone, 'Pilot customer', 'Ikeja', 'ng', 0, 'human', 1]);
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,verified_provider,provider_type,is_available) VALUES(?,?,?,?,?,?,?)`, [providerPhone, 'Verified repair provider', 'Ikeja', 'ng', 0, 'human', 1]);
db.run(`INSERT OR REPLACE INTO skills(phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode,service_radius_km) VALUES(?,?,?,?,?,?,?,?)`, [providerPhone, 'phone_repairer', 1, 250000, 4.9, 12, 'mobile', 8]);
saveDb();
await setProviderVerification(providerPhone, 'verified', { evidenceRef: 'pilot-fixture:evidence:provider-001', reviewedBy: 'test' });

const sign = (payload: object) => jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const customerToken = sign({ phone: customerPhone, role: 'user' });
const providerToken = sign({ phone: providerPhone, role: 'user' });
const adminToken = sign({ username: 'pilot-admin', role: 'admin' });
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const created = await fetch(`${baseUrl}/api/chat/economic-requests`, { method: 'POST', headers: auth(customerToken), body: JSON.stringify({ skill: 'phone_repairer', requirements: { device: 'iPhone 12', issue: 'Cracked screen', location: 'Ikeja' } }) });
  assert.equal(created.status, 201, 'customer should create canonical request');
  const createBody = await created.json();
  const requestId = createBody.request.id as string;

  const invited = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/invite-providers`, { method: 'POST', headers: auth(customerToken), body: JSON.stringify({ max: 3 }) });
  const invitedBody = await invited.json();
  assert.equal(invited.status, 201, `owner should create internal provider invitations: ${JSON.stringify(invitedBody)}`);
  assert.equal(invitedBody.external_delivery_confirmed, false, 'internal notification fallback must not claim external delivery');
  assert.equal(invitedBody.invitations.length, 1, 'fixture should produce one eligible verified provider');
  const invitationId = invitedBody.invitations[0].id as string;

  const providerQueue = await fetch(`${baseUrl}/api/coordination/provider/invitations`, { headers: auth(providerToken) });
  assert.equal(providerQueue.status, 200, 'verified provider should read only its own queue');
  const providerQueueBody = await providerQueue.json();
  assert.equal(providerQueueBody.invitations[0].id, invitationId);
  assert.equal(providerQueueBody.invitations[0].request.requirements.device, 'iPhone 12');

  const badQuote = await fetch(`${baseUrl}/api/coordination/provider/invitations/${encodeURIComponent(invitationId)}/respond`, { method: 'POST', headers: auth(providerToken), body: JSON.stringify({ response: 'accepted', quoteMinor: 0, currency: 'NGN', idempotencyKey: 'bad-quote' }) });
  assert.equal(badQuote.status, 409, 'provider acceptance must include a positive whole-number quote');

  const accepted = await fetch(`${baseUrl}/api/coordination/provider/invitations/${encodeURIComponent(invitationId)}/respond`, { method: 'POST', headers: auth(providerToken), body: JSON.stringify({ response: 'accepted', quoteMinor: 300000, currency: 'NGN', note: 'Screen replacement available. Call +2348019999999.', idempotencyKey: 'provider-accept-1' }) });
  assert.equal(accepted.status, 200, 'provider can submit an explicit quote');
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.invitation.status, 'accepted');
  assert.match(String(acceptedBody.invitation.note), /\[redacted-phone\]/, 'provider note must redact phone-like PII');
  assert.equal(acceptedBody.external_delivery_confirmed, false);

  const responses = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/provider-responses`, { headers: auth(customerToken) });
  const responsesBody = await responses.json();
  assert.equal(responses.status, 200, `owner can review responses: ${JSON.stringify(responsesBody)}`);
  assert.equal(responsesBody.responses.length, 1);
  assert.equal(responsesBody.responses[0].quoteMinor, 300000);

  await setProviderVerification(providerPhone, 'suspended', { reason: 'pilot revalidation test' });
  const blockedSelection = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/select-provider`, { method: 'POST', headers: auth(customerToken), body: JSON.stringify({ invitationId }) });
  assert.equal(blockedSelection.status, 409, 'customer cannot select a provider after the provider verification lifecycle becomes suspended');
  assert.match(String((await blockedSelection.json()).error || ''), /evidence-verified provider/i);
  await setProviderVerification(providerPhone, 'verified', { evidenceRef: 'pilot-fixture:evidence:provider-002', reviewedBy: 'test' });

  const selected = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/select-provider`, { method: 'POST', headers: auth(customerToken), body: JSON.stringify({ invitationId }) });
  const selectedBody = await selected.json();
  assert.equal(selected.status, 200, `owner can select an accepted provider response: ${JSON.stringify(selectedBody)}`);
  assert.equal(selectedBody.request.status, 'quoted');
  assert.equal(selectedBody.request.quote.source, 'provider_submitted');
  assert.equal(selectedBody.payment_confirmed, false, 'selection cannot claim payment');

  const quoteAccepted = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/accept-provider-quote`, { method: 'POST', headers: auth(customerToken), body: '{}' });
  assert.equal(quoteAccepted.status, 200, 'owner can explicitly accept selected provider quote');
  const quoteAcceptedBody = await quoteAccepted.json();
  assert.equal(quoteAcceptedBody.request.status, 'awaiting_confirmation');
  assert.equal(quoteAcceptedBody.payment_confirmed, false, 'quote acceptance cannot claim payment or dispatch');

  const handoff = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/handoff`, { method: 'POST', headers: auth(customerToken), body: JSON.stringify({ reason: 'Need human assistance after provider quote.' }) });
  assert.equal(handoff.status, 201, 'customer may request operator handoff');
  const handoffBody = await handoff.json();
  assert.equal(handoffBody.operator_contacted, false, 'handoff request cannot claim an operator already intervened');

  const queue = await fetch(`${baseUrl}/api/coordination/admin/handoffs`, { headers: auth(adminToken) });
  assert.equal(queue.status, 200, 'admin can view the coordinator queue');
  const queueBody = await queue.json();
  assert.equal(queueBody.private_owner_identifiers, 'omitted');
  assert.equal(queueBody.handoffs[0].id, handoffBody.handoff.id);

  const claim = await fetch(`${baseUrl}/api/coordination/admin/handoffs/${encodeURIComponent(handoffBody.handoff.id)}`, { method: 'PATCH', headers: auth(adminToken), body: JSON.stringify({ status: 'claimed' }) });
  assert.equal(claim.status, 200, 'admin can claim a requested handoff');
  const resolve = await fetch(`${baseUrl}/api/coordination/admin/handoffs/${encodeURIComponent(handoffBody.handoff.id)}`, { method: 'PATCH', headers: auth(adminToken), body: JSON.stringify({ status: 'resolved' }) });
  assert.equal(resolve.status, 200, 'admin can resolve only a claimed handoff');

  const events = await fetch(`${baseUrl}/api/coordination/requests/${encodeURIComponent(requestId)}/events`, { headers: auth(customerToken) });
  assert.equal(events.status, 200, 'owner can inspect bounded coordination events');
  const eventNames = (await events.json()).events.map((event: any) => event.event);
  for (const expected of ['provider_invited', 'provider_accepted', 'provider_response_selected', 'provider_quote_accepted', 'operator_handoff_requested', 'operator_handoff_claimed', 'operator_handoff_resolved']) assert.ok(eventNames.includes(expected), `expected coordination event ${expected}`);
  console.log('Provider coordination loop regression passed: evidence-verified provider invitation, provider-owned quote, customer selection/acceptance, human handoff, internal-only delivery truthfulness, and no payment or dispatch fabrication.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
