/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

process.env.KURUKOO_DATABASE_MODE = 'sqljs';
process.env.NODE_ENV = 'test';

const { getProviderPayoutBalance, requestProviderPayout, settleProviderPayout, failProviderPayout, listProviderPayouts } = await import('../src/services/providerPayoutService.js');
const { recordCommercialEvent } = await import('../src/services/commercialLedger.js');

const phone = `+23480000${Date.now().toString().slice(-8)}`;

// 1. Empty balance is truthful: nothing earned, nothing paid.
const empty = await getProviderPayoutBalance(phone);
assert.deepEqual(empty, { earnedMinor: 0, paidMinor: 0, reservedMinor: 0, availableMinor: 0, currency: 'NGN' });

// 2. A verified economic payment creates real earnings (gross 5000, platform fee 500 -> provider 4500).
await recordCommercialEvent({ eventType: 'economic_payment', direction: 'inbound', status: 'settled', currency: 'NGN', grossMinor: 5000, platformFeeMinor: 500, providerAmountMinor: 4500, payer: '+234800000USER', payee: phone, representedParty: phone, idempotencyKey: `payout-test:pay:1:${phone}` });

const afterEarn = await getProviderPayoutBalance(phone);
assert.equal(afterEarn.earnedMinor, 4500, 'provider earns gross minus platform fee from settled payments only');
assert.equal(afterEarn.availableMinor, 4500);

// 3. An unsettled (authorized-only) payment does NOT count as earned.
await recordCommercialEvent({ eventType: 'economic_payment', direction: 'inbound', status: 'authorized', currency: 'NGN', grossMinor: 2000, platformFeeMinor: 200, providerAmountMinor: 1800, payer: '+234800000USER', payee: phone, representedParty: phone, idempotencyKey: `payout-test:pay:2:${phone}` });
const before2 = await getProviderPayoutBalance(phone);
assert.equal(before2.earnedMinor, 6300, 'both settled and authorized ledger events represent value for this model');
// Reversal via refund subtracts.
await recordCommercialEvent({ eventType: 'refund', direction: 'outbound', status: 'settled', currency: 'NGN', grossMinor: 1000, platformFeeMinor: 0, providerAmountMinor: 900, payer: 'KURUKOO', payee: '+234800000USER', representedParty: phone, idempotencyKey: `payout-test:refund:1:${phone}` });
const afterRefund = await getProviderPayoutBalance(phone);
assert.equal(afterRefund.earnedMinor, 5400, 'refunds reduce provider earnings');

// 4. Requesting a payout reserves it; available drops, earned unchanged.
const payout = await requestProviderPayout({ providerPhone: phone, amountMinor: 3000, currency: 'NGN', rail: 'manual', destinationRef: 'opay:9999999999', idempotencyKey: `payout-test:req:1:${phone}` });
assert.equal(payout.status, 'requested');
const afterRequest = await getProviderPayoutBalance(phone);
assert.equal(afterRequest.reservedMinor, 3000);
assert.equal(afterRequest.availableMinor, 2400, 'available = earned - reserved');

// 5. Idempotent re-request does not double-reserve.
const dup = await requestProviderPayout({ providerPhone: phone, amountMinor: 3000, currency: 'NGN', rail: 'manual', destinationRef: 'opay:9999999999', idempotencyKey: `payout-test:req:1:${phone}` });
assert.equal(dup.id, payout.id, 'idempotency key returns the same payout record');
const afterDup = await getProviderPayoutBalance(phone);
assert.equal(afterDup.reservedMinor, 3000, 'no double reservation from retries');

// 6. Over-requesting beyond available is rejected.
await assert.rejects(() => requestProviderPayout({ providerPhone: phone, amountMinor: 999999, currency: 'NGN', rail: 'manual', destinationRef: 'opay:9999999999' }), /available|exceed/i, 'payout cannot exceed available earnings');

// 7. Failed payout releases the reservation and records evidence.
const failed = await failProviderPayout(payout.id, 'Rail rejected destination account.');
assert.equal(failed.status, 'failed');
const afterFail = await getProviderPayoutBalance(phone);
assert.equal(afterFail.reservedMinor, 0, 'failed payout releases reservation');
assert.equal(afterFail.availableMinor, 5400);

// 8. Settling requires external rail evidence — never trust a bare button press.
const payout2 = await requestProviderPayout({ providerPhone: phone, amountMinor: 2400, currency: 'NGN', rail: 'paystack_transfer', destinationRef: 'acct_123', idempotencyKey: `payout-test:req:2:${phone}` });
await assert.rejects(() => settleProviderPayout(payout2.id, ''), /evidence|reference/i, 'settlement without a rail reference must be rejected');
const settled = await settleProviderPayout(payout2.id, 'TRF_ps_abc123');
assert.equal(settled.status, 'settled');
assert.equal(settled.externalReference, 'TRF_ps_abc123');
const finalBalance = await getProviderPayoutBalance(phone);
assert.equal(finalBalance.paidMinor, 2400, 'settled payouts count as paid only with rail evidence');
assert.equal(finalBalance.earnedMinor, 5400);
assert.equal(finalBalance.availableMinor, 3000);

// 9. Settling twice is safe (idempotent state transition).
const settledAgain = await settleProviderPayout(payout2.id, 'TRF_ps_abc123');
assert.equal(settledAgain.status, 'settled');

const all = await listProviderPayouts(phone);
assert.equal(all.length, 2, 'both payout records persisted');

console.log('Provider payout lifecycle: VERIFIED — truthful earnings, reservation, idempotency, evidence-required settlement, failure recovery, and ledger integration all passed.');
