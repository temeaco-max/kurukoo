import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';

const dbPath = path.join(os.tmpdir(), `kurukoo-dispute-lifecycle-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'dispute-lifecycle-test-secret-that-is-long-enough';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
const { createEscrow, releaseEscrow } = await import('../src/services/escrow.js');
const { app } = await import('../src/index.ts');

const buyerPhone = '+2347000000201';
const otherPhone = '+2347000000202';
const providerPhone = '+2347000000203';
const requestId = 'completed-cooling-off-request';
const orderId = 'completed-cooling-off-order';
const buyerToken = jwt.sign({ phone: buyerPhone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
const otherToken = jwt.sign({ phone: otherPhone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });

function authorization(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

const db = await getDb();
for (const [phone, name, verified] of [
  [buyerPhone, 'Dispute Buyer', 0],
  [otherPhone, 'Other User', 0],
  [providerPhone, 'Dispute Provider', 1],
] as const) {
  db.run(
    `INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, verified_provider, points_balance)
     VALUES (?, ?, 'Ikeja', 'ng', ?, 30)`,
    [phone, name, verified],
  );
}

db.run(
  `INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode)
   VALUES (?, 'plumber', 1, 2000, 4.8, 12, 'mobile')`,
  [providerPhone],
);

await createEconomicRequest({
  id: requestId,
  phone: buyerPhone,
  skill: 'plumber',
  requirements: { location: 'Ikeja' },
});
await transitionEconomicRequest(requestId, 'awaiting_match');
await transitionEconomicRequest(requestId, 'matched', { providerPhone });
await transitionEconomicRequest(requestId, 'quoting');
await transitionEconomicRequest(requestId, 'quoted', { quote: { amount_minor: 250000, currency: 'NGN' } });
await transitionEconomicRequest(requestId, 'awaiting_confirmation');
await transitionEconomicRequest(requestId, 'reserved');
await transitionEconomicRequest(requestId, 'payment_pending');
await transitionEconomicRequest(requestId, 'paid');
await transitionEconomicRequest(requestId, 'in_fulfillment', { fulfillment: { order_id: orderId, payment_verified: true } });
await transitionEconomicRequest(requestId, 'fulfilled');
await transitionEconomicRequest(requestId, 'completed');

db.run(
  `INSERT INTO orders (id, phone, order_type, provider_phone, amount, status, idempotency_key)
   VALUES (?, ?, 'plumber', ?, 250000, 'delivered', 'completed-cooling-off-order')`,
  [orderId, buyerPhone, providerPhone],
);
const escrowId = await createEscrow(
  orderId,
  buyerPhone,
  providerPhone,
  250000,
  'Completed request cooling-off test',
  { verified: true, paymentReference: 'completed-cooling-off-payment' },
  24,
);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));

try {
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const escrowList = await fetch(`${base}/api/escrow?phone=${encodeURIComponent(buyerPhone)}`, {
    headers: authorization(buyerToken),
  });
  assert.equal(escrowList.status, 200, 'the mounted buyer escrow list must be reachable');
  const escrowRows = await escrowList.json() as Array<{ id: number; status: string }>;
  assert.equal(escrowRows.length, 1, 'buyer should receive only the linked escrow record');
  assert.equal(escrowRows[0].id, escrowId, 'buyer escrow listing must expose the linked escrow id');
  assert.equal(escrowRows[0].status, 'held', 'escrow must begin held during the cooling-off period');

  const foreignDispute = await fetch(`${base}/api/dispute/create`, {
    method: 'POST',
    headers: authorization(otherToken),
    body: JSON.stringify({ order_id: orderId, reason: 'Not this user’s order' }),
  });
  assert.equal(foreignDispute.status, 403, 'another authenticated user must not dispute the buyer’s order');
  assert.equal((await getEconomicRequest(requestId))?.status, 'completed', 'unauthorized dispute must not alter request state');
  assert.equal(String(db.exec(`SELECT status FROM escrow WHERE id = ?`, [escrowId])[0]?.values?.[0]?.[0]), 'held', 'unauthorized dispute must not alter escrow state');

  const bypassTransition = await fetch(`${base}/api/economic-requests/${requestId}/transition`, {
    method: 'POST',
    headers: authorization(buyerToken),
    body: JSON.stringify({ status: 'disputed' }),
  });
  assert.equal(bypassTransition.status, 403, 'customers must enter disputes through the escrow-freezing dispute boundary');

  const disputed = await fetch(`${base}/api/dispute/create`, {
    method: 'POST',
    headers: authorization(buyerToken),
    body: JSON.stringify({ order_id: orderId, reason: 'Completion issue during cooling-off' }),
  });
  assert.equal(disputed.status, 200, 'the buyer may dispute a completed request while escrow remains held');
  const disputedPayload = await disputed.json() as { disputeId: number; escrowFrozen: boolean; economicRequestId: string | null };
  assert.equal(disputedPayload.escrowFrozen, true, 'opening the dispute must freeze the held escrow');
  assert.equal(disputedPayload.economicRequestId, requestId, 'the dispute must identify the linked Economic Request');
  assert.equal((await getEconomicRequest(requestId))?.status, 'disputed', 'completed -> disputed must be recorded through the canonical lifecycle');
  assert.equal(String(db.exec(`SELECT status FROM escrow WHERE id = ?`, [escrowId])[0]?.values?.[0]?.[0]), 'disputed', 'escrow must be frozen in disputed state');
  assert.equal(String(db.exec(`SELECT status FROM orders WHERE id = ?`, [orderId])[0]?.values?.[0]?.[0]), 'disputed', 'the linked settlement order must also record the dispute state');
  assert.equal(await releaseEscrow(escrowId, { force: true }), false, 'a disputed escrow must not be releasable even with the internal force option');

  const duplicate = await fetch(`${base}/api/dispute/create`, {
    method: 'POST',
    headers: authorization(buyerToken),
    body: JSON.stringify({ order_id: orderId, reason: 'Repeat submission' }),
  });
  assert.equal(duplicate.status, 200, 'a duplicate dispute submission should be idempotent');
  const duplicatePayload = await duplicate.json() as { disputeId: number; escrowFrozen: boolean };
  assert.equal(duplicatePayload.disputeId, disputedPayload.disputeId, 'duplicate submissions must return the original open dispute');
  assert.equal(duplicatePayload.escrowFrozen, true, 'duplicate submissions must preserve the frozen escrow result');
  const disputeCount = Number(db.exec(`SELECT COUNT(*) FROM disputes WHERE phone = ? AND order_id = ?`, [buyerPhone, orderId])[0]?.values?.[0]?.[0]);
  const escrowCount = Number(db.exec(`SELECT COUNT(*) FROM escrow WHERE order_id = ?`, [orderId])[0]?.values?.[0]?.[0]);
  assert.equal(disputeCount, 1, 'duplicate submissions must not create additional dispute ledger rows');
  assert.equal(escrowCount, 1, 'dispute handling must not create additional escrow ledger rows');

  await assert.rejects(
    () => transitionEconomicRequest(requestId, 'paid'),
    /Invalid economic request transition: disputed -> paid/,
    'invalid transitions must remain rejected after the completed -> disputed policy correction',
  );
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort temporary database cleanup */ }
}

console.log('Dispute lifecycle integration checks passed');
console.log('Verified: completed cooling-off dispute, buyer ownership, escrow freeze/release block, transition enforcement, and idempotent dispute persistence.');
