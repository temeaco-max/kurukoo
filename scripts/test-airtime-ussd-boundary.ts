import assert from 'node:assert/strict';
import { executeCanonicalCapabilityProposal } from '../src/services/canonicalCapabilityExecutor.js';
import { recordAirtimeCallback } from '../src/services/airtimeService.js';
import { handleUssdRequest } from '../src/ussd/menus.js';

const phone = `+234706${String(Date.now()).slice(-7)}`;
const prepared = await executeCanonicalCapabilityProposal({ capability: 'airtime', action: 'prepare', phone, arguments: { recipient: phone, amount: 1000, currency: 'NGN', network: 'MTN' }, idempotencyKey: `airtime-prepare-${phone}` });
assert.equal(prepared.status, 'completed');
assert.ok(prepared.canonicalObjectId);

const unconfirmed = await executeCanonicalCapabilityProposal({ capability: 'airtime', action: 'purchase', phone, canonicalObjectId: prepared.canonicalObjectId, idempotencyKey: `airtime-purchase-unconfirmed-${phone}` });
assert.equal(unconfirmed.status, 'confirmation_required');
const disabled = await executeCanonicalCapabilityProposal({ capability: 'airtime', action: 'purchase', phone, canonicalObjectId: prepared.canonicalObjectId, confirmationGranted: true, idempotencyKey: `airtime-purchase-disabled-${phone}` });
assert.equal(disabled.status, 'external_unavailable');

const callback = { transactionId: `callback-${Date.now()}`, status: 'Success', phoneNumber: phone, value: 'NGN 1000' };
assert.equal((await recordAirtimeCallback(callback)).duplicate, false);
assert.equal((await recordAirtimeCallback(callback)).duplicate, true);

const sessionId = `ussd-${Date.now()}`;
assert.match(await handleUssdRequest(phone, '', { sessionId }), /^CON Welcome to Kurukoo/);
assert.match(await handleUssdRequest(phone, '1', { sessionId }), /^CON How much airtime/);
assert.match(await handleUssdRequest(phone, '1*1000', { sessionId }), /^CON Buy NGN 1000\.00 airtime/);
assert.match(await handleUssdRequest(phone, '1*1000*2', { sessionId }), /^END Airtime purchase cancelled/);

console.log('Airtime and USSD boundary regression passed: confirmation, callback idempotency, and deterministic carrier-session flow.');
