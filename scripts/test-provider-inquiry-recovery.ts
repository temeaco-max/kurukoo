import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-provider-inquiry-recovery-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.MEMORY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.FF_SMS = 'true';
process.env.AFRICASTALKING_API_KEY = 'test-provider-key';
process.env.AFRICASTALKING_USERNAME = 'sandbox';
process.env.AFRICASTALKING_SENDER_ID = 'kurukoo';
process.env.KURUKOO_PROVIDER_INQUIRY_TIMEOUT_MINUTES = '5';

let sendMode: 'accepted' | 'rejected' | 'network_error' = 'accepted';
let outboundAttempts = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  outboundAttempts += 1;
  if (sendMode === 'network_error') throw new Error('simulated_socket_timeout');
  if (sendMode === 'rejected') return new Response(JSON.stringify({
    SMSMessageData: { Message: 'Rejected', Recipients: [{ status: 'Rejected', number: '+2347000000812', messageId: `at-rejected-${outboundAttempts}` }] },
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({
    SMSMessageData: { Message: 'Sent', Recipients: [{ status: 'Sent', number: '+2347000000812', messageId: `at-accepted-${outboundAttempts}` }] },
  }), { status: 201, headers: { 'Content-Type': 'application/json' } });
};

const { getDb, saveDb } = await import('../src/database.js');
const { startStorefrontSession, advanceStorefront, resumeStorefrontFromRequest } = await import('../src/services/agenticStorefront.js');
const { getFulfilmentForEconomicRequest, getLatestProviderInquiry, getFulfilment, listOffers } = await import('../src/services/canonicalFulfilmentService.js');
const { getChannelDeliveryState } = await import('../src/services/channelDeliveryState.js');
const { handleSmsWebhook } = await import('../src/channels/sms.js');
const { runProviderInquiryFollowUpPass } = await import('../src/services/providerInquiryFollowUpService.js');
const { getEconomicRequest } = await import('../src/services/skillFlows.js');
const { routeIntent } = await import('../src/services/legacyIntentRouter.js');
const { onboardNewUser } = await import('../src/services/progressiveOnboarding.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { getProfile } = await import('../src/services/memoryProfile.js');

const db = await getDb();
const customerPhone = '+2347000000811';
const providerPhone = '+2347000000812';
db.run(`INSERT INTO memory_profiles (phone, name, location, country, verified_provider, points_balance) VALUES (?, ?, 'Ikeja', 'ng', 0, 30)`, [customerPhone, 'Repair Customer']);
db.run(`INSERT INTO memory_profiles (phone, name, location, country, verified_provider, points_balance) VALUES (?, ?, 'Ikeja', 'ng', 1, 30)`, [providerPhone, 'Ikeja Phone Repair']);
db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode) VALUES (?, 'phone_repairer', 1, 0, 4.9, 12, 'stationary')`, [providerPhone]);

try {
  const firstTaskPhone = '+2347000000813';
  await onboardNewUser(firstTaskPhone);
  const firstTask = await processCanonicalChatTurn({ phone: firstTaskPhone, message: 'Find me a phone repair shop near me and arrange a repair for my iPhone 13. The screen is cracked and charging is intermittent. I need it today in Ikeja.', channel: 'web' });
  assert.equal(firstTask.cardData?.stage, 'catalog_match', 'A newly authenticated user’s first explicit repair request must bypass optional onboarding.');
  assert.ok(firstTask.cardData?.providers?.some((provider: any) => provider.phone === providerPhone));
  const identityCaptured = await processCanonicalChatTurn({ phone: firstTaskPhone, message: 'Ada Okafor', channel: 'web', conversationId: firstTask.conversationId });
  assert.equal(identityCaptured.cardData?.type, 'welcome', 'A name-only reply after an identity-gated provider choice must be captured as identity rather than treated as a new request.');
  assert.equal((await getProfile(firstTaskPhone, 'test'))?.name, 'Ada Okafor');
  assert.equal((await getEconomicRequest(firstTask.cardData?.requestId))?.status, 'requested', 'Capturing the required identity must preserve the exact active repair request.');

  const naturalLanguage = await routeIntent('Find me a phone repair shop near me and arrange a repair for my iPhone 13. The screen is cracked and charging is intermittent. I need it today in Ikeja.', customerPhone);
  const naturalCard = naturalLanguage.cardData as any;
  assert.equal(naturalLanguage.skill, 'repair');
  assert.equal(naturalCard?.stage, 'catalog_match', 'Clearly stated phone-repair details must reach bounded provider discovery without redundant clarification.');
  assert.ok(naturalCard?.providers?.some((provider: any) => provider.phone === providerPhone));

  const incomplete = await startStorefrontSession(customerPhone, 'repair', { device_or_asset: 'iPhone 13' }, { forceNew: true });
  assert.equal(incomplete.stage, 'slot_fill', 'Incomplete repair requests must ask only for missing essentials.');
  assert.ok(incomplete.actions?.some((action) => action.id === 'cancel'));

  const noProviders = await startStorefrontSession(customerPhone, 'find_worker', { service: 'locksmith', location: 'Ikeja' }, { forceNew: true });
  assert.equal(noProviders.stage, 'deferred', 'No-provider requests must remain truthful and durable rather than invent a match.');
  assert.match(noProviders.message, /No verified available provider matched/i);

  const request = await startStorefrontSession(customerPhone, 'repair', {
    device_or_asset: 'iPhone 13', issue: 'Cracked screen', location: 'Ikeja', urgency: 'today',
  }, { forceNew: true });
  assert.ok(request.requestId);
  const requestId = request.requestId!;

  const cancelled = await advanceStorefront(customerPhone, requestId, {}, 'cancel', 'decline-contact');
  assert.equal(cancelled.title, 'Cancelled', 'A user can decline contact before any external action.');
  assert.equal(outboundAttempts, 0, 'Declining contact must produce no external SMS.');

  const active = await startStorefrontSession(customerPhone, 'repair', {
    device_or_asset: 'iPhone 13', issue: 'Cracked screen', location: 'Ikeja', urgency: 'today',
  }, { forceNew: true });
  const activeRequestId = active.requestId!;
  await advanceStorefront(customerPhone, activeRequestId, { providerPhone }, 'select_provider', 'select-repair-provider');

  sendMode = 'rejected';
  const rejected = await advanceStorefront(customerPhone, activeRequestId, {}, 'request_quote', 'first-contact');
  assert.equal(rejected.title, 'Quote contact unavailable');
  assert.match(rejected.message, /could not contact/i);
  assert.equal(outboundAttempts, 1);

  sendMode = 'accepted';
  const retried = await advanceStorefront(customerPhone, activeRequestId, {}, 'request_quote', 'retry-after-provider-rejection');
  assert.equal(retried.title, 'Quote inquiry sent', 'A customer-approved retry is allowed only after explicit provider rejection.');
  assert.equal(outboundAttempts, 2, 'The retry must be a distinct, explicit contact attempt.');

  const fulfilment = await getFulfilmentForEconomicRequest(customerPhone, activeRequestId);
  assert.ok(fulfilment);
  const inquiry = await getLatestProviderInquiry(customerPhone, fulfilment!.id, providerPhone);
  assert.equal(inquiry?.status, 'sent');
  const messageId = 'at-accepted-2';
  await handleSmsWebhook({ id: messageId, status: 'Success', phoneNumber: providerPhone });
  assert.equal((await getChannelDeliveryState('sms', 'africastalking', messageId))?.status, 'delivered');

  const firstExpiry = await runProviderInquiryFollowUpPass({ now: new Date(Date.now() + 6 * 60_000).toISOString() });
  assert.equal(firstExpiry.markedNoResponse, 1, 'The deadline worker must record a provider non-response once.');
  const secondExpiry = await runProviderInquiryFollowUpPass({ now: new Date(Date.now() + 7 * 60_000).toISOString() });
  assert.equal(secondExpiry.markedNoResponse, 0, 'A repeated or restarted worker pass must not duplicate a no-response event.');

  const timedOut = await resumeStorefrontFromRequest(customerPhone, activeRequestId);
  assert.equal(timedOut?.title, 'Provider has not replied');
  assert.match(timedOut?.message || '', /No repair slot, availability, price, or booking has been confirmed/i);

  const malformed = await handleSmsWebhook({ From: providerPhone, Body: 'hello, please call me', MessageId: 'at-malformed-001' });
  assert.notEqual(malformed.status, 'provider_response_recorded', 'An inbound message without the inquiry reference must not be treated as provider evidence.');
  assert.equal((await listOffers(customerPhone, fulfilment!.id)).length, 0, 'Malformed provider text must not create an offer.');

  const lateReference = inquiry!.id.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase();
  const late = await handleSmsWebhook({ From: providerPhone, Body: `Available. Final price NGN 18,000. Reference KQ${lateReference}`, MessageId: 'at-late-response-001' });
  assert.equal(late.status, 'success');
  assert.equal(late.response, 'Provider response recorded.', 'A late, properly correlated provider response must repair the no-response state with real evidence.');
  assert.equal((await getFulfilment(customerPhone, fulfilment!.id))?.status, 'offers_ready');
  assert.equal((await listOffers(customerPhone, fulfilment!.id)).length, 1);

  const stale = await resumeStorefrontFromRequest(customerPhone, 'missing-request-id');
  assert.equal(stale, null, 'Stale or foreign request identifiers must not reveal or mutate a request.');
  assert.equal((await getEconomicRequest(activeRequestId))?.status, 'quoted', 'A provider-confirmed late reply must update the original durable request.');

  const networkRequest = await startStorefrontSession(customerPhone, 'repair', {
    device_or_asset: 'iPhone 14', issue: 'Battery failure', location: 'Ikeja', urgency: 'today',
  }, { forceNew: true });
  await advanceStorefront(customerPhone, networkRequest.requestId!, { providerPhone }, 'select_provider', 'select-network-provider');
  sendMode = 'network_error';
  const uncertain = await advanceStorefront(customerPhone, networkRequest.requestId!, {}, 'request_quote', 'network-uncertain');
  assert.equal(uncertain.title, 'Quote delivery needs review');
  const beforeReplay = outboundAttempts;
  const replayed = await advanceStorefront(customerPhone, networkRequest.requestId!, {}, 'request_quote', 'network-replay');
  assert.equal(replayed.title, 'Quote delivery needs review');
  assert.equal(outboundAttempts, beforeReplay, 'Network-uncertain delivery must not be retried automatically or by blind replay.');

  console.log(JSON.stringify({
    passed: true,
    assertions: [
      'missing information is clarified', 'no-provider state remains truthful', 'declined contact sends nothing',
      'explicit rejection permits an explicit retry', 'delivery is distinct from response', 'non-response is durable and idempotent',
      'malformed replies cannot become evidence', 'late referenced replies repair no-response truthfully',
      'stale requests fail closed', 'network uncertainty blocks duplicate contact',
    ],
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary cleanup is best-effort */ }
}
