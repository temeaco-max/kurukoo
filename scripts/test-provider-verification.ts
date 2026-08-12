import assert from 'node:assert/strict';
import { upsertProfile } from '../src/routes/authRoutes.js';
import { getProviderVerification, providerMayBeDiscovered, setProviderVerification } from '../src/services/providerVerification.js';

const phone = `+234806${String(Date.now()).slice(-7)}`;
await upsertProfile(phone, 'Verification Test Provider');
assert.equal((await getProviderVerification(phone)).state, 'unverified', 'A profile must not imply provider verification');
assert.equal(await providerMayBeDiscovered(phone), false, 'Unverified providers cannot be exposed as verified discovery supply');
await assert.rejects(() => setProviderVerification(phone, 'verified'), /authoritative evidence/, 'Verified state must require external or reviewed evidence');
await setProviderVerification(phone, 'pending', { reason: 'awaiting_identity_review' });
assert.equal((await getProviderVerification(phone)).state, 'pending', 'Pending KYC must remain distinct from verified supply');
await setProviderVerification(phone, 'verified', { evidenceRef: 'provider_verification:reviewed_fixture', reviewedBy: 'admin_fixture', expiresAt: new Date(Date.now() + 60_000).toISOString() });
assert.equal(await providerMayBeDiscovered(phone), true, 'Only evidence-backed verified state enables discovery projection');
await setProviderVerification(phone, 'verified', { evidenceRef: 'provider_verification:expired_fixture', expiresAt: new Date(Date.now() - 1_000).toISOString() });
assert.equal((await getProviderVerification(phone)).state, 'expired', 'Expired evidence must downgrade provider verification safely');
assert.equal(await providerMayBeDiscovered(phone), false, 'Expired verification cannot remain discoverable as verified');
console.log('Provider verification lifecycle regression passed.');
