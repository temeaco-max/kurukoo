/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'progressive-trust-test-secret-0123456789';
// Unconditional and per-run. `||` would inherit the ambient DB_PATH — `.env`
// sets tmp/kurukoo.sqlite and a running dev server exports it — so trusted
// devices and challenges from earlier runs would satisfy this run's assertions
// and the contract would stop being a gate.
process.env.DB_PATH = `/tmp/kurukoo-progressive-trust-${process.pid}-${Date.now()}.sqlite`;

const { registerTrustedDevice, getTrustedDeviceStatus, createTrustChallenge, getPendingTrustChallenges, approveTrustChallenge, denyTrustChallenge, listTrustedDevices, revokeTrustedDevice, recordChannelEvidence, recordLocationConsent, getProgressiveTrust } = await import('../src/services/progressiveTrustService.ts');

const phone = '+2348035550101';
const existingDevice = `test-existing-${Date.now()}`;
const newDevice = `test-new-${Date.now()}`;

await registerTrustedDevice({ phone, deviceId: existingDevice, credentialType: 'web', pushCapable: true });
const existingStatus = await getTrustedDeviceStatus(phone, existingDevice);
assert.equal(existingStatus.trusted, true);
assert.equal(existingStatus.pushCapable, true);

const challenge = await createTrustChallenge({ phone, targetDeviceId: newDevice, purpose: 'device_sign_in' });
assert.equal(challenge.alreadyTrusted, false);
assert.ok(challenge.id);
const pending = await getPendingTrustChallenges(phone);
assert.equal(pending.some((item: any) => item.id === challenge.id), true);

const denied = await approveTrustChallenge({ phone, challengeId: challenge.id, approverDeviceId: 'untrusted-device' });
assert.equal(denied.approved, false);
assert.equal(denied.reason, 'approver_device_not_trusted');

const approved = await approveTrustChallenge({ phone, challengeId: challenge.id, approverDeviceId: existingDevice });
assert.equal(approved.approved, true);

const newStatus = await getTrustedDeviceStatus(phone, newDevice);
assert.equal(newStatus.trusted, true);
assert.equal(newStatus.credentialType, 'push');

const denialTarget = `test-denial-${Date.now()}`;
const denialChallenge = await createTrustChallenge({ phone, targetDeviceId: denialTarget, purpose: 'device_sign_in' });
const deniedByTrustedDevice = await denyTrustChallenge({ phone, challengeId: denialChallenge.id, approverDeviceId: existingDevice });
assert.equal(deniedByTrustedDevice.denied, true);
const devices = await listTrustedDevices(phone);
assert.equal(devices.length, 2);
const revoked = await revokeTrustedDevice({ phone, deviceRecordId: devices.find((device: any) => device.label === 'Push-approved device')?.id || -1, currentDeviceId: existingDevice });
assert.equal(revoked.revoked, true);
assert.equal((await getTrustedDeviceStatus(phone, newDevice)).trusted, false);

await recordChannelEvidence({ phone, channel: 'whatsapp', evidenceType: 'verified_personal_linked_session_inbound', externalSubject: 'test-jid', sourceRef: 'test-message', consented: true });
await recordLocationConsent({ phone, purpose: 'find nearby providers', precision: 'coarse', area: 'Ibadan', expiresAt: new Date(Date.now() + 60_000).toISOString() });
const trust = await getProgressiveTrust(phone);
assert.equal(trust.trustedDevices, 1);
assert.equal(trust.channelEvidence[0]?.channel, 'whatsapp');
assert.equal(trust.activeLocationConsents, 1);

console.log(JSON.stringify({ ok: true, trustedDevices: trust.trustedDevices, channelEvidence: trust.channelEvidence.length, activeLocationConsents: trust.activeLocationConsents }));
