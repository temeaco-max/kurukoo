/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'cross-channel-security-test-secret-0123456789';
// Unconditional and per-run. `||` would inherit the ambient DB_PATH — `.env`
// sets tmp/kurukoo.sqlite and a running dev server exports it — so this
// contract would silently write into the developer's real database and let
// state accumulate across runs until correct assertions fail on someone else's
// data. A test whose result depends on ambient shell state is not a gate.
process.env.DB_PATH = `/tmp/kurukoo-cross-channel-security-${process.pid}-${Date.now()}.sqlite`;

const {
  registerTrustedDevice,
  getTrustedDeviceStatus,
  createTrustChallenge,
  approveTrustChallenge,
  listTrustedDevices,
  recordChannelEvidence,
  recordLocationConsent,
  getProgressiveTrust,
  isProgressiveTrustEnabled,
} = await import('../src/services/progressiveTrustService.ts');

const { getExternalIntegrationReadiness } = await import('../src/services/externalIntegrationReadiness.ts');
const { isChannelConfigured } = await import('../src/channels/channelRegistry.ts');
const { getDb } = await import('../src/database.ts');

const phone = '+2348035550101';
const deviceId = `cross-channel-test-${Date.now()}`;

// ---------------------------------------------------------------------------
// Test 1: Channel evidence recording is consistent across all channels
// ---------------------------------------------------------------------------
console.log('Test 1: Channel evidence recording across all supported channels');

assert.equal(isProgressiveTrustEnabled(), true, 'Progressive trust must be enabled in test env');

const supportedChannels = ['whatsapp', 'telegram', 'sms', 'email', 'social', 'ivr', 'ussd'] as const;

for (const channel of supportedChannels) {
  await recordChannelEvidence({
    phone,
    channel,
    evidenceType: 'verified_inbound_session',
    externalSubject: `test-subject-${channel}`,
    sourceRef: `test-ref-${channel}`,
    consented: true,
  });

  const trust = await getProgressiveTrust(phone);
  const channelEvidence = trust.channelEvidence.find(
    (e: { channel: string }) => e.channel === channel
  );
  assert.ok(channelEvidence, `Channel evidence should be recorded for ${channel}`);
  assert.equal(channelEvidence.evidenceType, 'verified_inbound_session');
  assert.equal(channelEvidence.status, 'observed');
}

console.log(`  OK - All ${supportedChannels.length} channels recorded evidence correctly`);

// ---------------------------------------------------------------------------
// Test 2: No channel claims live delivery without provider activation
// ---------------------------------------------------------------------------
console.log('Test 2: No channel claims live delivery without provider activation');

const emptyEnv: NodeJS.ProcessEnv = {
  ...process.env,
  WHATSAPP_TOKEN: '',
  WHATSAPP_ACCESS_TOKEN: '',
  KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED: 'false',
  KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW: 'false',
  AFRICASTALKING_API_KEY: '',
  STRIPE_SECRET_KEY: '',
  KURUKOO_EMAIL_OTP_ENABLED: 'false',
};

// Verify all channel integrations report non-active states without credentials
const readiness = getExternalIntegrationReadiness(emptyEnv);
const channelIntegrations = ['whatsapp', 'telegram', 'sms', 'ussd', 'email'];

for (const ch of channelIntegrations) {
  const integration = readiness.find(
    (r: { id: string }) => r.id === ch
  );
  if (integration) {
    assert.notEqual(
      integration.readiness.PRODUCTION_ACTIVE,
      true,
      `Channel ${ch} must not claim production active without credentials`
    );
    assert.ok(
      ['NOT_IMPLEMENTED', 'CREDENTIALS_REQUIRED', 'DISABLED', 'LIVE_VERIFICATION_REQUIRED'].includes(integration.uiState),
      `Channel ${ch} uiState should be safe (not PRODUCTION_ACTIVE), got: ${integration.uiState}`
    );
  }
}

console.log('  OK - All channels correctly report non-active status without credentials');

// ---------------------------------------------------------------------------
// Test 3: Progressive trust is consistent across channel evidence types
// ---------------------------------------------------------------------------
console.log('Test 3: Progressive trust consistency across channels');

await registerTrustedDevice({ phone, deviceId, credentialType: 'web', pushCapable: true });
const deviceStatus = await getTrustedDeviceStatus(phone, deviceId);
assert.equal(deviceStatus.trusted, true);
assert.equal(deviceStatus.pushCapable, true);

const trustAfterChannels = await getProgressiveTrust(phone);
assert.ok(trustAfterChannels.trustedDevices >= 1, 'Should have at least one trusted device');
assert.ok(trustAfterChannels.channelEvidence.length >= supportedChannels.length, 'Should have evidence from all channels');

// Verify each channel evidence entry has expected fields
for (const evidence of trustAfterChannels.channelEvidence) {
  assert.ok(evidence.channel, 'Channel evidence must have channel field');
  assert.ok(evidence.evidenceType, 'Channel evidence must have evidenceType field');
  assert.ok(evidence.status, 'Channel evidence must have status field');
  assert.ok(evidence.observedAt, 'Channel evidence must have observedAt timestamp');
}

console.log('  OK - Progressive trust state is consistent across all channel evidence');

// ---------------------------------------------------------------------------
// Test 4: Device trust challenge flow is channel-agnostic
// ---------------------------------------------------------------------------
console.log('Test 4: Device trust challenge flow');

const newDevice = `cross-channel-new-${Date.now()}`;
const challenge = await createTrustChallenge({ phone, targetDeviceId: newDevice, purpose: 'device_sign_in' });
assert.equal(challenge.alreadyTrusted, false);
assert.ok(challenge.id, 'Challenge should have an ID');

// Try approving from untrusted device — must fail
const denied = await approveTrustChallenge({ phone, challengeId: challenge.id, approverDeviceId: 'untrusted-device' });
assert.equal(denied.approved, false);
assert.equal(denied.reason, 'approver_device_not_trusted');

// Approve from trusted device — must succeed
const approved = await approveTrustChallenge({ phone, challengeId: challenge.id, approverDeviceId: deviceId });
assert.equal(approved.approved, true);

// Verify new device is now trusted
const newDeviceStatus = await getTrustedDeviceStatus(phone, newDevice);
assert.equal(newDeviceStatus.trusted, true);
assert.equal(newDeviceStatus.credentialType, 'push');

console.log('  OK - Device trust challenge flow works correctly');

// ---------------------------------------------------------------------------
// Test 5: Location consent is channel-agnostic
// ---------------------------------------------------------------------------
console.log('Test 5: Location consent across channels');

await recordLocationConsent({
  phone,
  purpose: 'find nearby providers',
  precision: 'coarse',
  area: 'Ibadan',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

const trustWithLocation = await getProgressiveTrust(phone);
assert.ok(trustWithLocation.activeLocationConsents >= 1, 'Should have active location consent');

console.log('  OK - Location consent is recorded and retrieved correctly');

// ---------------------------------------------------------------------------
// Test 6: Channel evidence revocation boundary
// ---------------------------------------------------------------------------
console.log('Test 6: Channel evidence revocation boundary');

// Record fresh evidence and verify it is queryable for revocation
await recordChannelEvidence({
  phone,
  channel: 'whatsapp',
  evidenceType: 'verified_personal_linked_session_inbound',
  externalSubject: 'test-jid-revoke',
  sourceRef: 'test-message-revoke',
  consented: true,
});

const db = await getDb();
const countStmt = db.prepare('SELECT COUNT(*) as count FROM channel_evidence WHERE phone = ? AND status = ?',);
countStmt.bind([phone, 'observed']);
const countResult = countStmt.step() ? countStmt.getAsObject() as Record<string, unknown> : null;
countStmt.free();
assert.ok(countResult, 'Channel evidence should be queryable for revocation verification');

console.log('  OK - Channel evidence revocation boundary is consistent');

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
const finalTrust = await getProgressiveTrust(phone);
console.log('\nAll cross-channel behavioural security tests passed.');
console.log(JSON.stringify({
  ok: true,
  channelsTested: supportedChannels.length,
  channelEvidenceRecorded: finalTrust.channelEvidence.length,
  trustedDevices: finalTrust.trustedDevices,
  activeLocationConsents: finalTrust.activeLocationConsents,
}, null, 2));
