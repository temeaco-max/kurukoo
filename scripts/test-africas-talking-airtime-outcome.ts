import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-airtime-outcome-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'development';
process.env.FF_AIRTIME = 'true';
process.env.AFRICASTALKING_API_KEY = 'at-test-key';
process.env.AFRICASTALKING_USERNAME = 'sandbox';
process.env.AFRICASTALKING_AIRTIME_CALLBACK_TOKEN = 'airtime-callback-test-token';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'africas-talking-airtime-outcome-test-secret-0123456789';

const originalFetch = globalThis.fetch;
const submissions: any[] = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, init);
  assert.match(String(url), /api\.sandbox\.africastalking\.com\/version1\/airtime\/send$/, 'sandbox airtime activation must use Africa’s Talking sandbox endpoint');
  submissions.push({ url: String(url), init });
  const body = JSON.parse(String(init?.body));
  if (body.recipients?.[0]?.phoneNumber === '+2347000020202') {
    return new Response(JSON.stringify({ numSent: 0, responses: [{ phoneNumber: '+2347000020202', amount: 'NGN 80.00', status: 'Failed', requestId: 'None', errorMessage: 'Recipient unavailable' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ numSent: 1, responses: [{ phoneNumber: '+2347000020201', amount: 'NGN 80.00', status: 'Sent', requestId: 'ATQ-airtime-20201', errorMessage: 'None' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};

async function paidAirtimeRequest(id: string, phone: string) {
  const { createEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
  const request = await createEconomicRequest({ id, phone, skill: 'buy_airtime', requirements: { recipient_phone: '+2347000020201', amount_minor: 8000, currency: 'NGN' } });
  await transitionEconomicRequest(request.id, 'awaiting_match');
  await transitionEconomicRequest(request.id, 'matched', { providerPhone: 'AFRICASTALKING' });
  await transitionEconomicRequest(request.id, 'quoting');
  await transitionEconomicRequest(request.id, 'quoted', { providerPhone: 'AFRICASTALKING', quote: { amount_minor: 8000, currency: 'NGN', confirmed: true } });
  await transitionEconomicRequest(request.id, 'awaiting_confirmation');
  await transitionEconomicRequest(request.id, 'reserved');
  await transitionEconomicRequest(request.id, 'payment_pending');
  await transitionEconomicRequest(request.id, 'paid', { fulfillment: { payment_verified: true, payment_provider: 'test', payment_reference: `pay-${id}` } });
  return request;
}

try {
  const { getDb, saveDb } = await import('../src/database.js');
  const { getEconomicRequest } = await import('../src/services/skillFlows.js');
  const { airtimeAvailability, submitAirtimeActivation, recordAirtimeDeliveryReport } = await import('../src/services/africasTalkingAirtime.js');
  const db = await getDb();
  const owner = '+2347000020200';
  db.run(`INSERT INTO memory_profiles (phone,name,country,points_balance) VALUES (?,?, 'ng', ?)`, [owner, 'Airtime Buyer', 10]);

  const availability = airtimeAvailability();
  assert.equal(availability.available, true);
  assert.equal(availability.callbackProtected, true);

  const request = await paidAirtimeRequest('airtime-order-20201', owner);
  const accepted = await submitAirtimeActivation({ ownerPhone: owner, requestId: request.id, recipientPhone: '+2347000020201', amountMinor: 8000, currency: 'NGN', idempotencyKey: 'airtime-activation-20201' });
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.providerRequestId, 'ATQ-airtime-20201');
  assert.equal((await getEconomicRequest(request.id))?.status, 'in_fulfillment', 'provider acceptance must not be treated as customer delivery');
  assert.match(String(submissions[0].init?.headers && (submissions[0].init.headers as any)['Idempotency-Key']), /airtime-activation-20201/);

  const unauthenticated = await recordAirtimeDeliveryReport({ callbackToken: 'wrong', providerRequestId: 'ATQ-airtime-20201', recipientPhone: '+2347000020201', status: 'Success', value: 'NGN 80.00' });
  assert.equal(unauthenticated.accepted, false, 'unprotected callback claims cannot complete airtime');
  assert.equal((await getEconomicRequest(request.id))?.status, 'in_fulfillment');

  const mismatch = await recordAirtimeDeliveryReport({ callbackToken: process.env.AFRICASTALKING_AIRTIME_CALLBACK_TOKEN!, providerRequestId: 'ATQ-airtime-20201', recipientPhone: '+2347000020299', status: 'Success', value: 'NGN 80.00' });
  assert.equal(mismatch.accepted, false, 'callback evidence must match the requested recipient and value');

  const { app } = await import('../src/index.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  let delivered: any;
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const ownerToken = jwt.sign({ phone: owner, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
    const readiness = await fetch(`${base}/api/airtime/status`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(readiness.status, 200, 'authenticated users can inspect truthful airtime readiness');
    const badCallback = await fetch(`${base}/api/webhooks/africastalking/airtime`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-kurukoo-airtime-token': 'wrong' }, body: JSON.stringify({ requestId: 'ATQ-airtime-20201', phoneNumber: '+2347000020201', status: 'Success', value: 'NGN 80.00' }) });
    assert.equal(badCallback.status, 403, 'the callback route rejects uncorrelated or unauthenticated delivery claims');
    const callback = await fetch(`${base}/api/webhooks/africastalking/airtime`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-kurukoo-airtime-token': process.env.AFRICASTALKING_AIRTIME_CALLBACK_TOKEN! }, body: JSON.stringify({ requestId: 'ATQ-airtime-20201', phoneNumber: '+2347000020201', status: 'Success', value: 'NGN 80.00', description: 'Airtime Delivered Successfully' }) });
    assert.equal(callback.status, 200, 'a protected matching provider callback completes the shared airtime fulfillment evidence');
    delivered = await callback.json();
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  assert.equal(delivered.status, 'delivered');
  const fulfilled = await getEconomicRequest(request.id);
  assert.equal(fulfilled?.status, 'fulfilled');
  assert.equal((fulfilled?.fulfillment as any)?.airtime_status, 'delivery_confirmed');
  assert.equal((fulfilled?.fulfillment as any)?.airtime_delivery_evidence?.providerRequestId, 'ATQ-airtime-20201');
  const replay = await recordAirtimeDeliveryReport({ callbackToken: process.env.AFRICASTALKING_AIRTIME_CALLBACK_TOKEN!, providerRequestId: 'ATQ-airtime-20201', recipientPhone: '+2347000020201', status: 'Success', value: 'NGN 80.00' });
  assert.equal(replay.message, 'This final airtime status was already recorded.');

  const failedRequest = await paidAirtimeRequest('airtime-order-20202', owner);
  const failed = await submitAirtimeActivation({ ownerPhone: owner, requestId: failedRequest.id, recipientPhone: '+2347000020202', amountMinor: 8000, idempotencyKey: 'airtime-activation-20202' });
  assert.equal(failed.status, 'failed');
  assert.equal((await getEconomicRequest(failedRequest.id))?.status, 'paid', 'provider submission failure must not masquerade as fulfilled airtime or progress beyond the paid state');
  await assert.rejects(() => submitAirtimeActivation({ ownerPhone: owner, requestId: failedRequest.id, recipientPhone: '+2347000020202', amountMinor: 3000, idempotencyKey: 'invalid-minimum' }), /between NGN 50 and NGN 20,000/);

  saveDb(true);
  console.log(JSON.stringify({ passed: true, provider: 'africastalking', acceptedRequestId: request.id, providerRequestId: accepted.providerRequestId, finalStatus: fulfilled?.status, failureRecorded: failed.status }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  try { fs.rmSync(dbPath, { force: true }); } catch { /* isolated test cleanup is best-effort */ }
}
