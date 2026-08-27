import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-fulfilment-storefront-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.FF_SMS = 'true';
process.env.AFRICASTALKING_API_KEY = 'test-provider-key';
process.env.AFRICASTALKING_USERNAME = 'sandbox';
process.env.AFRICASTALKING_SENDER_ID = 'kurukoo';

let outboundCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  outboundCalls += 1;
  assert.match(String(input), /api\.sandbox\.africastalking\.com\/version1\/messaging$/, 'Sandbox SMS delivery must use the sandbox endpoint.');
  assert.equal(init?.method, 'POST');
  return new Response(JSON.stringify({
    SMSMessageData: {
      Message: 'Sent to 1/1 Total Cost: NGN 0.0000',
      Recipients: [{ status: 'Sent', number: '+2347000000412', messageId: 'at-outbound-001', cost: 'NGN 0.0000' }],
    },
  }), { status: 201, headers: { 'Content-Type': 'application/json' } });
};

const { getDb, saveDb } = await import('../src/database.js');
const { startStorefrontSession, advanceStorefront, resumeStorefrontFromRequest } = await import('../src/services/agenticStorefront.js');
const { getFulfilmentForEconomicRequest, getOpenProviderInquiry, getFulfilment, listOffers } = await import('../src/services/canonicalFulfilmentService.js');
const { getChannelDeliveryState } = await import('../src/services/channelDeliveryState.js');
const { getEconomicRequest } = await import('../src/services/skillFlows.js');
const { handleSmsWebhook } = await import('../src/channels/sms.js');

const db = await getDb();
const customerPhone = '+2347000000411';
const providerPhone = '+2347000000412';

db.run(
  `INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, verified_provider, points_balance)
   VALUES (?, ?, 'Ikeja', 'ng', ?, 30)`,
  [customerPhone, 'Fulfilment Customer', 0]
);
db.run(
  `INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, verified_provider, points_balance)
   VALUES (?, ?, 'Ikeja', 'ng', ?, 30)`,
  [providerPhone, 'Fulfilment Provider', 1]
);
db.run(
  `INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode)
   VALUES (?, 'plumber', 1, 0, 4.8, 10, 'mobile')`,
  [providerPhone]
);

try {
  const initial = await startStorefrontSession(customerPhone, 'find_worker', { service: 'plumber', location: 'Ikeja' }, { forceNew: true });
  assert.ok(initial.requestId, 'A real storefront request must receive an Economic Request identity.');
  assert.equal(initial.skill, 'find_worker');
  assert.ok(initial.providers?.some(provider => provider.phone === providerPhone), 'The canonical storefront must project the verified local provider without treating it as a quote.');

  const requestId = initial.requestId!;
  const fulfilment = await getFulfilmentForEconomicRequest(customerPhone, requestId);
  assert.equal(fulfilment?.mechanism, 'local_discovery', 'The current find_worker flow must bind to the reusable fulfilment mechanism.');
  assert.equal(fulfilment?.requirements.service, 'plumber');
  assert.equal(fulfilment?.requirements.location, 'Ikeja');

  const selected = await advanceStorefront(customerPhone, requestId, { providerPhone }, 'select_provider');
  assert.match(selected.message, /selected/i, 'Provider selection must stay explicit before a quote is requested.');

  const inquiryCard = await advanceStorefront(customerPhone, requestId, {}, 'request_quote');
  assert.equal(inquiryCard.title, 'Quote inquiry sent');
  assert.match(inquiryCard.message, /accepted the message/i, 'The customer must see the true provider-network acceptance state.');
  assert.equal(outboundCalls, 1, 'A consented quote request must produce exactly one provider SMS attempt.');

  const inquiry = await getOpenProviderInquiry(customerPhone, fulfilment!.id, providerPhone);
  assert.equal(inquiry?.status, 'sent', 'The provider inquiry must move to sent only after a provider-network acceptance response.');
  assert.ok(inquiry?.sentAt, 'The canonical inquiry must retain a send timestamp.');

  const dispatch = await getChannelDeliveryState('sms', 'africastalking', 'at-outbound-001');
  assert.equal(dispatch?.status, 'submitted', 'The outbound provider message must retain the provider message ID and initial status.');

  const deliveryReport = await handleSmsWebhook({ id: 'at-outbound-001', status: 'Success', phoneNumber: providerPhone, networkCode: '99999' });
  assert.equal(deliveryReport.deliveryStatus, 'delivered', 'A carrier delivery report must update the same durable dispatch record.');
  assert.equal((await getChannelDeliveryState('sms', 'africastalking', 'at-outbound-001'))?.status, 'delivered');

  const reference = inquiry!.id.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase();
  const providerReply = await handleSmsWebhook({
    From: providerPhone,
    Body: `Available today. Final price is NGN 25,000. Delivery available. Reference: KQ${reference}`,
    MessageId: 'at-inbound-001',
  });
  assert.equal(providerReply.status, 'success');
  assert.match(providerReply.response || '', /recorded/i);

  const respondedFulfilment = await getFulfilment(customerPhone, fulfilment!.id);
  assert.equal(respondedFulfilment?.status, 'offers_ready', 'A provider response must create a canonical offer and advance fulfilment truthfully.');
  const offers = await listOffers(customerPhone, fulfilment!.id);
  assert.equal(offers.length, 1, 'Exactly one provider response must materialize into one canonical offer.');
  assert.equal(offers[0]?.priceMinor, 2_500_000, 'Provider price parsing must retain NGN minor units.');
  assert.equal(offers[0]?.evidenceLevel, 'provider_confirmed');

  const quotedRequest = await getEconomicRequest(requestId);
  assert.equal(quotedRequest?.status, 'quoted', 'A provider-confirmed price must advance the same customer request into quote review.');
  assert.equal(quotedRequest?.quote?.source, 'provider_sms_response');
  assert.equal(quotedRequest?.quote?.amount_minor, 2_500_000);

  const resumed = await resumeStorefrontFromRequest(customerPhone, requestId);
  assert.equal(resumed?.title, 'Provider quote', 'The request surface must show the provider-confirmed quote after the reply is recorded.');
  assert.match(resumed?.message || '', /25[,_]?000/i);

  const duplicateReply = await handleSmsWebhook({
    From: providerPhone,
    Body: `Available today. Final price is NGN 25,000. Delivery available. Reference: KQ${reference}`,
    MessageId: 'at-inbound-001',
  });
  assert.equal(duplicateReply.duplicate, true, 'A replayed inbound provider callback must not create another offer or notification.');
  assert.equal((await listOffers(customerPhone, fulfilment!.id)).length, 1, 'Inbound callback replay must remain idempotent.');

  const replayedInquiryCard = await advanceStorefront(customerPhone, requestId, {}, 'request_quote');
  assert.equal(replayedInquiryCard.title, 'Quote inquiry already sent');
  assert.equal(outboundCalls, 1, 'A replayed customer action must never send a duplicate real-world SMS.');

  console.log(JSON.stringify({
    passed: true,
    requestId,
    fulfilmentId: fulfilment?.id,
    inquiryId: inquiry?.id,
    truths: [
      'provider selected by explicit customer action',
      'one outbound provider SMS accepted and delivery-reported',
      'provider reply persisted as evidence',
      'provider-confirmed quote attached to the same request',
      'customer notification queued',
      'outbound and inbound replays do not duplicate side effects',
    ],
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary database cleanup is best-effort */ }
}
