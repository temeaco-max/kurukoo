import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-vtpass-data-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'development';
process.env.FF_DATA_BUNDLE = 'true';
process.env.VTPASS_API_KEY = 'vt-test-key';
process.env.VTPASS_PUBLIC_KEY = 'vt-test-public-key';
process.env.VTPASS_ENV = 'sandbox';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; body: any }> = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, init);
  const body = JSON.parse(String(init?.body || '{}'));
  requests.push({ url: String(url), body });
  if (String(url).endsWith('/requery')) return new Response(JSON.stringify({ code: '000', response_description: 'TRANSACTION SUCCESSFUL', requestId: body.request_id, content: { transactions: { status: 'delivered', product_name: 'MTN Data', unique_element: body.request_id, amount: 1000, transactionId: 'VT-TX-1001' } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (body.billersCode === '2347000020202') return new Response(JSON.stringify({ code: '099', response_description: 'TRANSACTION FAILED', requestId: body.request_id, content: { transactions: { status: 'failed' } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ code: '001', response_description: 'TRANSACTION IN PROGRESS', requestId: body.request_id, content: { transactions: { status: 'pending', product_name: 'MTN Data', unique_element: body.billersCode, amount: 1000 } } }), { status: 200, headers: { 'content-type': 'application/json' } });
};

async function paidRequest(id: string, phone: string, recipientPhone: string) {
  const { createEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
  const request = await createEconomicRequest({ id, phone, skill: 'data_bundle', requirements: { recipient_phone: recipientPhone, network: 'mtn', variation_code: 'mtn-1gb', amount_minor: 100000, currency: 'NGN' } });
  await transitionEconomicRequest(request.id, 'awaiting_match');
  await transitionEconomicRequest(request.id, 'matched', { providerPhone: 'VTPASS' });
  await transitionEconomicRequest(request.id, 'quoting');
  await transitionEconomicRequest(request.id, 'quoted', { providerPhone: 'VTPASS', quote: { amount_minor: 100000, currency: 'NGN', confirmed: true } });
  await transitionEconomicRequest(request.id, 'awaiting_confirmation');
  await transitionEconomicRequest(request.id, 'reserved');
  await transitionEconomicRequest(request.id, 'payment_pending');
  await transitionEconomicRequest(request.id, 'paid', { fulfillment: { payment_verified: true, payment_provider: 'paystack', payment_reference: `pay-${id}` } });
  return request;
}

try {
  const { getEconomicRequest } = await import('../src/services/skillFlows.js');
  const { dataBundleAvailability, submitDataBundleActivation, requeryDataBundleActivation } = await import('../src/services/vtpassDataBundle.js');
  const owner = '+2347000020200';
  assert.equal(dataBundleAvailability().available, true);
  const request = await paidRequest('data-order-20201', owner, '+2347000020201');
  const activation = await submitDataBundleActivation({ ownerPhone: owner, requestId: request.id, recipientPhone: '+2347000020201', network: 'mtn', variationCode: 'mtn-1gb', amountMinor: 100000, idempotencyKey: 'data-activation-20201' });
  assert.equal(activation.status, 'processing');
  assert.equal((await getEconomicRequest(request.id))?.status, 'in_fulfillment');
  assert.equal(requests[0].body.serviceID, 'mtn-data');
  assert.equal(requests[0].body.variation_code, 'mtn-1gb');
  assert.equal(requests[0].body.billersCode, '2347000020201');
  const replay = await submitDataBundleActivation({ ownerPhone: owner, requestId: request.id, recipientPhone: '+2347000020201', network: 'mtn', variationCode: 'mtn-1gb', amountMinor: 100000, idempotencyKey: 'different-replay-key' });
  assert.equal(replay.providerRequestId, activation.providerRequestId);
  assert.equal(requests.length, 1, 'replay must not submit a second provider activation');
  const delivered = await requeryDataBundleActivation({ ownerPhone: owner, providerRequestId: activation.providerRequestId });
  assert.equal(delivered.status, 'delivered');
  assert.equal((await getEconomicRequest(request.id))?.status, 'fulfilled', 'only delivered provider evidence may fulfil the request');
  assert.equal((await getEconomicRequest(request.id))?.fulfillment?.data_bundle_delivery_evidence && (await getEconomicRequest(request.id))?.fulfillment?.data_bundle_delivery_evidence.provider, 'vtpass');

  const failedRequest = await paidRequest('data-order-20202', owner, '+2347000020202');
  const failed = await submitDataBundleActivation({ ownerPhone: owner, requestId: failedRequest.id, recipientPhone: '+2347000020202', network: 'mtn', variationCode: 'mtn-1gb', amountMinor: 100000, idempotencyKey: 'data-activation-20202' });
  assert.equal(failed.status, 'failed');
  assert.equal((await getEconomicRequest(failedRequest.id))?.status, 'paid', 'provider failure must not advance a paid request into fulfilment');

  const unverified = await paidRequest('data-order-20203', owner, '+2347000020203');
  await (await import('../src/services/skillFlows.js')).transitionEconomicRequest(unverified.id, 'paid', { fulfillment: { payment_verified: false } }).catch(() => undefined);
  await assert.rejects(() => submitDataBundleActivation({ ownerPhone: owner, requestId: unverified.id, recipientPhone: '+2347000020203', network: 'mtn', variationCode: 'mtn-1gb', amountMinor: 100000, idempotencyKey: 'data-activation-20203' }), /Verified payment is required/);
  console.log(JSON.stringify({ passed: true, provider: 'vtpass', acceptedRequestId: request.id, providerRequestId: activation.providerRequestId, finalStatus: (await getEconomicRequest(request.id))?.status, failureRecorded: failed.status }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  try { fs.rmSync(dbPath, { force: true }); } catch { /* isolated test cleanup is best-effort */ }
}
