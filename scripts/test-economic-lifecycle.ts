import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-economic-lifecycle-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
const { createOpenIntention, getIntentionByEconomicRequestId } = await import('../src/services/deferredRequestService.js');
const { processDueDeferred } = await import('../src/services/backgroundWorkers.js');
const { createEscrow } = await import('../src/services/escrow.js');
const { runEscrowPass } = await import('../src/services/tradeEngine.js');
const { sendFcmPush } = await import('../src/services/pushNotifications.js');
const { handleSmsWebhook } = await import('../src/channels/sms.js');

const db = await getDb();
const customerPhone = '+2347000000101';
const providerPhone = '+2347000000102';

for (const [phone, name, verified] of [
  [customerPhone, 'Lifecycle Customer', 0],
  [providerPhone, 'Lifecycle Provider', 1],
] as const) {
  db.run(
    `INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, verified_provider, points_balance) VALUES (?, ?, 'Ikeja', 'ng', ?, 30)`,
    [phone, name, verified]
  );
}

db.run(
  `INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode)
   VALUES (?, 'plumber', 1, 0, 4.8, 10, 'mobile')`,
  [providerPhone]
);

const deferredRequestId = 'deferred-lifecycle-request';
await createEconomicRequest({
  id: deferredRequestId,
  phone: customerPhone,
  skill: 'plumber',
  requirements: { location: 'Ikeja' },
});
await transitionEconomicRequest(deferredRequestId, 'awaiting_match');
const intention = await createOpenIntention(customerPhone, 'plumber', JSON.stringify({ location: 'Ikeja' }), {
  skill: 'plumber',
  location: 'Ikeja',
  economicRequestId: deferredRequestId,
});

db.run(`UPDATE open_intentions SET next_check_at = datetime('now', '-1 minute') WHERE id = ?`, [intention.id]);
const deferredResult = await processDueDeferred();
const deferredRequest = await getEconomicRequest(deferredRequestId);
const deferredIntention = await getIntentionByEconomicRequestId(deferredRequestId);
assert.equal(deferredResult.matched, 1, 'due deferred request should find the verified provider');
assert.equal(deferredResult.quoted, 0, 'a provider without a listed rate must not create a quote');
assert.equal(deferredRequest?.status, 'matched', 'the linked request should record the provider match');
assert.equal(deferredRequest?.quote == null, true, 'the linked request must not contain a fabricated quote');
assert.equal(deferredIntention?.status, 'partially_matched', 'the open intention should remain open pending a real quote');

const orderId = 'settlement-lifecycle-order';
db.run(
  `INSERT INTO orders (id, phone, order_type, provider_phone, amount, status, idempotency_key)
   VALUES (?, ?, 'plumber', ?, 250000, 'delivered', 'settlement-lifecycle-order')`,
  [orderId, customerPhone, providerPhone]
);
const escrowId = await createEscrow(
  orderId,
  customerPhone,
  providerPhone,
  250000,
  'Lifecycle settlement test',
  { verified: true, paymentReference: 'test-payment-reference' },
  0
);

assert.equal(await runEscrowPass(), 1, 'a delivered escrow past cooling-off should release once');
const reward = db.exec(
  `SELECT amount, description FROM credit_transactions WHERE phone = ? AND description LIKE ?`,
  [providerPhone, `%[escrow_release:${escrowId}]%`]
)[0]?.values?.[0];
assert.equal(Number(reward?.[0]), 5, 'a completed job must use the bounded completion reward, not the monetary amount');
assert.match(String(reward?.[1]), /Job completion bonus/, 'the award must be recorded as a completion reward');
assert.equal(await runEscrowPass(), 0, 'a released escrow must not award points a second time');
const rewardCount = db.exec(
  `SELECT COUNT(*) AS count FROM credit_transactions WHERE phone = ? AND description LIKE ?`,
  [providerPhone, `%[escrow_release:${escrowId}]%`]
)[0]?.values?.[0]?.[0];
assert.equal(Number(rewardCount), 1, 'completion reward must remain idempotent');

db.run(`UPDATE memory_profiles SET fcm_token = 'test-device-token' WHERE phone = ?`, [customerPhone]);
assert.equal(
  await sendFcmPush(customerPhone, 'Lifecycle notification', 'A deferred request has a match.'),
  false,
  'an unconfigured push adapter must not report a simulated delivery'
);

const smsPhone = '+2347000000103';
const smsResult = await handleSmsWebhook({ from: '2347000000103', text: 'I need a plumber in Ikeja' });
assert.equal(smsResult.status, 'success', 'SMS webhook should complete through the shared channel handler');
const smsRequest = db.exec(
  `SELECT phone FROM economic_requests WHERE phone = ? ORDER BY created_at DESC LIMIT 1`,
  [smsPhone]
)[0]?.values?.[0]?.[0];
assert.equal(smsRequest, smsPhone, 'SMS routing must use the normalized channel identity for the Economic Request');

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary database cleanup is best-effort */ }

console.log('Economic lifecycle integration checks passed');
console.log('Verified: deferred re-match does not fabricate a quote, escrow release awards bounded idempotent points, and SMS uses the normalized Economic Request identity.');
