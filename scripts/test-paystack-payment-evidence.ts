import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-paystack-payment-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'development';
process.env.KURUKOO_PAY_PROVIDER = 'paystack';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_kurukoo_payment_evidence_contract';
process.env.KURUKOO_PAYSTACK_CALLBACK_URL = 'https://app.example.test/paystack/callback';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'paystack-payment-evidence-test-secret-0123456789';

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init?: RequestInit }> = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, init);
  calls.push({ url: String(url), init });
  if (String(url).includes('/transaction/initialize')) {
    return new Response(JSON.stringify({ status: true, message: 'Authorization URL created', data: { authorization_url: 'https://checkout.paystack.test/pay_ref_201', access_code: 'access_201', reference: 'pay_ref_201' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).includes('/transaction/verify/pay_ref_201')) {
    return new Response(JSON.stringify({ status: true, data: { id: 201, status: 'success', reference: 'pay_ref_201', amount: 560000, currency: 'NGN', paid_at: '2026-08-27T20:00:00.000Z', channel: 'card', gateway_response: 'Successful' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ status: false, message: 'unexpected request' }), { status: 500, headers: { 'content-type': 'application/json' } });
};

try {
  const { createPaystackTransaction, verifyPaystackTransaction, verifyPaystackWebhook, paystackStatus } = await import('../src/services/paystackPayment.js');
  const { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
  const { recordVerifiedEconomicPayment } = await import('../src/services/economicPaymentEvidence.js');
  const { getDb, saveDb } = await import('../src/database.js');

  const readiness = paystackStatus();
  assert.equal(readiness.configured, true);
  assert.equal(readiness.callbackReady, true);
  assert.match(readiness.settlementEvidence, /matching successful/i);

  const created = await createPaystackTransaction({ amountMinor: 560000, currency: 'NGN', email: 'buyer@example.test', economicRequestId: 'paystack-order-201', idempotencyKey: 'payment-evidence-201' });
  assert.equal(created.reference, 'pay_ref_201');
  assert.equal(created.status, 'authorization_pending');
  const initPayload = JSON.parse(String(calls[0].init?.body));
  assert.equal(initPayload.amount, '560000');
  assert.equal(initPayload.currency, 'NGN');
  assert.equal(initPayload.metadata.economic_request_id, 'paystack-order-201');
  assert.equal(initPayload.callback_url, 'https://app.example.test/paystack/callback');

  const verified = await verifyPaystackTransaction('pay_ref_201');
  assert.equal(verified.status, 'success');
  assert.equal(verified.amountMinor, 560000);
  assert.equal(verified.currency, 'NGN');

  const rawWebhook = Buffer.from(JSON.stringify({ event: 'charge.success', data: { id: 201, reference: 'pay_ref_201' } }));
  const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(rawWebhook).digest('hex');
  assert.equal(verifyPaystackWebhook(rawWebhook, signature)?.event, 'charge.success');
  assert.equal(verifyPaystackWebhook(rawWebhook, 'invalid'), null, 'unsigned or invalid webhooks cannot settle an outcome');

  const db = await getDb();
  const buyer = '+2347000030101';
  const provider = '+2347000030102';
  db.run(`INSERT INTO memory_profiles (phone,name,country,verified_provider,points_balance) VALUES (?,?, 'ng', ?, ?), (?,?,'ng',?,?)`, [buyer, 'Paystack Buyer', 0, 10, provider, 'Paystack Provider', 1, 10]);
  db.run(`INSERT INTO skills (phone,skill,is_available,hourly_rate,rating,jobs_completed) VALUES (?, 'order_food', 1, 560000, 4.9, 2)`, [provider]);

  const request = await createEconomicRequest({ id: 'paystack-order-201', phone: buyer, skill: 'order_food', requirements: { items: 'rice and chicken', location: 'Ikeja' } });
  await transitionEconomicRequest(request.id, 'awaiting_match');
  await transitionEconomicRequest(request.id, 'matched', { providerPhone: provider });
  await transitionEconomicRequest(request.id, 'quoting');
  await transitionEconomicRequest(request.id, 'quoted', { providerPhone: provider, quote: { amount_minor: 560000, currency: 'NGN', provider_name: 'Paystack Food Provider' } });

  const settlement = await recordVerifiedEconomicPayment({ requestId: request.id, provider: 'paystack', paymentReference: verified.reference, evidenceId: `verify:${verified.providerTransactionId}`, amountMinor: verified.amountMinor, currency: verified.currency, evidenceSource: 'provider_verify', metadata: { paystack_channel: verified.channel } });
  assert.equal(settlement.success, true);
  assert.equal(settlement.idempotent, false);
  assert.ok(settlement.escrowId);
  const paid = await getEconomicRequest(request.id);
  assert.equal(paid?.status, 'in_fulfillment');
  assert.equal((paid?.fulfillment as any)?.payment_provider, 'paystack');
  assert.equal((paid?.fulfillment as any)?.payment_reference, 'pay_ref_201');
  assert.equal((paid?.fulfillment as any)?.payment_verified, true);

  const replay = await recordVerifiedEconomicPayment({ requestId: request.id, provider: 'paystack', paymentReference: verified.reference, evidenceId: `verify:${verified.providerTransactionId}`, amountMinor: verified.amountMinor, currency: verified.currency, evidenceSource: 'provider_verify' });
  assert.equal(replay.idempotent, true, 'replayed provider verification cannot duplicate settlement');
  await assert.rejects(
    () => recordVerifiedEconomicPayment({ requestId: request.id, provider: 'paystack', paymentReference: 'different_reference', evidenceId: 'verify:wrong', amountMinor: verified.amountMinor, currency: verified.currency, evidenceSource: 'provider_verify' }),
    /different verified payment reference/i,
  );
  assert.equal(String(db.exec('SELECT status FROM escrow WHERE id=?', [settlement.escrowId!])[0]?.values?.[0]?.[0]), 'held');

  const { app } = await import('../src/index.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const token = jwt.sign({ phone: buyer, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const receiptResponse = await fetch(`${base}/api/payments/economic/${request.id}/receipt`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(receiptResponse.status, 200, 'the owner can retrieve a receipt only after verified payment evidence is recorded');
    const receiptPayload = await receiptResponse.json() as any;
    assert.equal(receiptPayload.receipt.provider, 'paystack');
    assert.equal(receiptPayload.receipt.paymentReference, 'pay_ref_201');
    const foreignToken = jwt.sign({ phone: '+2347000030199', role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
    const foreignReceipt = await fetch(`${base}/api/payments/economic/${request.id}/receipt`, { headers: { Authorization: `Bearer ${foreignToken}` } });
    assert.equal(foreignReceipt.status, 404, 'payment receipts remain owner-scoped');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  saveDb(true);
  console.log(JSON.stringify({ passed: true, provider: 'paystack', requestId: request.id, paymentReference: verified.reference, escrowId: settlement.escrowId, status: paid?.status }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  try { fs.rmSync(dbPath, { force: true }); } catch { /* isolated test cleanup is best-effort */ }
}
