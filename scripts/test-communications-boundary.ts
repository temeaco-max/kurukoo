import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-communications-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = 'communications_boundary_test_secret_32_chars';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'communications-verify-token';
delete process.env.AFRICASTALKING_API_KEY;
delete process.env.AFRICASTALKING_USERNAME;
delete process.env.FCM_SERVICE_ACCOUNT_JSON;

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const {
  claimInboundChannelEvent,
  createCommunicationDelivery,
  updateCommunicationDelivery,
  updateDeliveryByProviderReference,
} = await import('../src/services/communicationDelivery.js');
const { dispatchDueCommunicationOutbox } = await import('../src/services/communicationOutbox.js');
const { handleSmsWebhook } = await import('../src/channels/sms.js');
const { isChannelConfigured } = await import('../src/channels/channelRegistry.js');
const { sendFcmPush } = await import('../src/services/pushNotifications.js');
const { getFcmDeviceToken } = await import('../src/services/memoryProfile.js');
const { upsertProfile } = await import('../src/routes/authRoutes.js');

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const { port } = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${port}`;
  const fcmOwnerPhone = '+2347000000898';
  const fcmOwnerToken = jwt.sign({ phone: fcmOwnerPhone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '5m' });
  const fcmDeviceToken = `fcm_${'A'.repeat(80)}`;
  await upsertProfile(fcmOwnerPhone, 'FCM Test Owner');

  try {
  assert.equal(isChannelConfigured('whatsapp'), false, 'absent verification prerequisites must keep WhatsApp unavailable publicly');
  process.env.WHATSAPP_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
  process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
  assert.equal(isChannelConfigured('whatsapp'), true, 'WhatsApp is available only after send and webhook-verification prerequisites are present');
  delete process.env.WHATSAPP_APP_SECRET;
  assert.equal(isChannelConfigured('whatsapp'), false, 'removing signature verification must remove public WhatsApp availability');
  process.env.WHATSAPP_APP_SECRET = 'test-app-secret';

  assert.equal(isChannelConfigured('sms'), false, 'SMS requires explicit delivery-report readiness before public availability');
  process.env.AFRICASTALKING_API_KEY = 'test-key';
  process.env.AFRICASTALKING_USERNAME = 'test-user';
  process.env.AFRICASTALKING_SMS_DELIVERY_REPORTS_ENABLED = 'true';
  process.env.AFRICASTALKING_WEBHOOK_TOKEN = 'communications-sms-callback-token';
  assert.equal(isChannelConfigured('sms'), true, 'SMS readiness requires delivery-report and protected callback prerequisites');
  delete process.env.AFRICASTALKING_API_KEY;
  delete process.env.AFRICASTALKING_USERNAME;
  delete process.env.AFRICASTALKING_SMS_DELIVERY_REPORTS_ENABLED;
  delete process.env.AFRICASTALKING_WEBHOOK_TOKEN;

  const first = await createCommunicationDelivery({
    phone: '+2347000000888',
    channel: 'sms',
    direction: 'outbound',
    purpose: 'provider_invitation',
    idempotencyKey: 'communication-test:provider-invitation:1',
    state: 'queued',
  });
  const duplicateIntent = await createCommunicationDelivery({
    phone: '+2347000000888',
    channel: 'sms',
    direction: 'outbound',
    purpose: 'provider_invitation',
    idempotencyKey: 'communication-test:provider-invitation:1',
    state: 'queued',
  });
  assert.equal(duplicateIntent.id, first.id, 'a repeated domain intent must reuse its canonical delivery record');

  const accepted = await updateCommunicationDelivery({
    id: first.id,
    state: 'accepted',
    providerReference: 'sms-provider-reference-1',
  });
  assert.equal(accepted?.state, 'accepted', 'provider API acceptance must be recorded distinctly from delivery');
  const delivered = await updateDeliveryByProviderReference({
    channel: 'sms',
    providerReference: 'sms-provider-reference-1',
    state: 'delivered',
  });
  assert.equal(delivered?.state, 'delivered', 'provider receipt must advance the same canonical delivery record');

  const inbound = await claimInboundChannelEvent({
    channel: 'sms',
    providerEventId: 'sms-inbound-event-1',
    payload: { id: 'sms-inbound-event-1', body: 'hello' },
    verificationState: 'not_supported',
    phone: '+2347000000889',
  });
  assert.equal(inbound.duplicate, false, 'the first provider event must be accepted');
  const repeatedInbound = await claimInboundChannelEvent({
    channel: 'sms',
    providerEventId: 'sms-inbound-event-1',
    payload: { id: 'sms-inbound-event-1', body: 'hello' },
    verificationState: 'not_supported',
    phone: '+2347000000889',
  });
  assert.equal(repeatedInbound.duplicate, true, 'a provider retry must not create a second inbound event');

  const sms = await handleSmsWebhook({ from: '+2347000000890', text: 'check balance', id: 'sms-unconfigured-inbound-1' });
  assert.equal(sms.status, 'success', 'the canonical conversation may persist an inbound SMS even without outbound transport');
  assert.equal(sms.deliveryState, 'queued', 'inbound processing must persist an outbound intent before any external transport attempt');
  const dispatch = await dispatchDueCommunicationOutbox();
  assert.equal(dispatch.not_configured, 1, 'the durable outbox must explicitly record an unconfigured SMS adapter without claiming delivery');
  const repeatedSms = await handleSmsWebhook({ from: '+2347000000890', text: 'check balance', id: 'sms-unconfigured-inbound-1' });
  assert.equal(repeatedSms.status, 'duplicate', 'a repeated inbound SMS event must not create a second conversation turn');

  const anonymousFcmRegistration = await fetch(`${baseUrl}/api/notifications/fcm-device`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: fcmDeviceToken }),
  });
  assert.equal(anonymousFcmRegistration.status, 401, 'device tokens must never be registered without an authenticated owner');
  const invalidFcmRegistration = await fetch(`${baseUrl}/api/notifications/fcm-device`, {
    method: 'PUT', headers: { Authorization: `Bearer ${fcmOwnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'invalid' }),
  });
  assert.equal(invalidFcmRegistration.status, 400, 'malformed device tokens must be rejected');
  const validFcmRegistration = await fetch(`${baseUrl}/api/notifications/fcm-device`, {
    method: 'PUT', headers: { Authorization: `Bearer ${fcmOwnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: fcmDeviceToken }),
  });
  assert.equal(validFcmRegistration.status, 204, 'an authenticated owner may register one bounded device token');
  assert.equal(await getFcmDeviceToken(fcmOwnerPhone), fcmDeviceToken, 'the token must stay bound to the authenticated owner');
  const fcmConsent = await fetch(`${baseUrl}/api/notifications/preferences/fcm`, {
    method: 'PUT', headers: { Authorization: `Bearer ${fcmOwnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: 'granted', purpose: 'push_notification' }),
  });
  assert.equal(fcmConsent.status, 200, 'push requires an explicit owner consent record');
  assert.equal(await sendFcmPush(fcmOwnerPhone, 'Deferred match', 'A provider is reviewing your request.', '/chat/'), false, 'outbox queueing must not claim FCM acceptance or delivery');
  const fcmDb = await getDb();
  const fcmOutboxPayload = String(fcmDb.exec(`SELECT o.payload_json FROM communication_outbox o JOIN communication_deliveries d ON d.id = o.delivery_id WHERE d.phone = '${fcmOwnerPhone}' AND d.channel = 'fcm'`)[0]?.values?.[0]?.[0] || '');
  assert.doesNotMatch(fcmOutboxPayload, new RegExp(fcmDeviceToken), 'device tokens must not be copied into durable outbox payloads');
  const fcmDispatch = await dispatchDueCommunicationOutbox();
  assert.equal(fcmDispatch.not_configured, 1, 'an unconfigured FCM adapter must retain the in-app fallback and record not_configured externally');
  const fcmRows = fcmDb.exec(`SELECT channel, state, provider_reference FROM communication_deliveries WHERE phone = '${fcmOwnerPhone}' AND channel = 'fcm'`)[0]?.values || [];
  assert.deepEqual(fcmRows, [['fcm', 'not_configured', null]], 'FCM must record an explicit unconfigured state, never a fabricated provider receipt');
  const mismatchedFcmRemoval = await fetch(`${baseUrl}/api/notifications/fcm-device`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${fcmOwnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: `${fcmDeviceToken}different` }),
  });
  assert.equal(mismatchedFcmRemoval.status, 204, 'withdrawal remains idempotent without exposing token ownership');
  assert.equal(await getFcmDeviceToken(fcmOwnerPhone), fcmDeviceToken, 'a mismatched withdrawal must not erase the current owner token');
  const validFcmRemoval = await fetch(`${baseUrl}/api/notifications/fcm-device`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${fcmOwnerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: fcmDeviceToken }),
  });
  assert.equal(validFcmRemoval.status, 204, 'the authenticated owner may withdraw its current device token');
  assert.equal(await getFcmDeviceToken(fcmOwnerPhone), null, 'successful withdrawal must remove the current owner token');

  const goodVerification = await fetch(`${baseUrl}/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=communications-verify-token&hub.challenge=challenge-123`);
  assert.equal(goodVerification.status, 200, 'WhatsApp callback handshake must require and accept the configured verification token');
  assert.equal(await goodVerification.text(), 'challenge-123');
  const invalidVerification = await fetch(`${baseUrl}/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123`);
  assert.equal(invalidVerification.status, 403, 'WhatsApp callback handshake must reject an invalid verification token');

  const db = await getDb();
  const categoryCount = Number(db.exec(`SELECT COUNT(*) AS count FROM service_categories`)[0]?.values?.[0]?.[0] || 0);
  const emergencyChoice = categoryCount + 2;
  const ussdResponse = await fetch(`${baseUrl}/api/ussd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '+2347000000891', text: String(emergencyChoice) }),
  });
  assert.equal(ussdResponse.status, 200);
  const ussdText = await ussdResponse.text();
  assert.match(ussdText, /does not contact emergency services/i, 'USSD must disclose its emergency boundary');
  assert.doesNotMatch(ussdText, /alerted with your location|triggered/i, 'USSD must not fabricate emergency dispatch or notification');

  console.log('Communications boundary regression passed');
  console.log('Verified: idempotent delivery records, durable outbox dispatch, receipt-driven states, owner-bound FCM registration/consent/fallback, protected channel readiness, unconfigured SMS truthfulness, WhatsApp handshake, and USSD non-dispatch language.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort cleanup */ }
}
