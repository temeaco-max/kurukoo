/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A per-run path this contract OWNS, never one inherited from the environment.
// `.env` sets DB_PATH=tmp/kurukoo.sqlite and a running dev server exports it, so
// a `process.env.DB_PATH || …` fallback resolves to the developer's REAL
// database — and the rmSync below then deletes it before the first assertion
// runs. That is data loss, not a flaky test. Proven with a canary file.
const dbPath = `/tmp/kurukoo-commercial-convergence-${process.pid}-${Date.now()}.sqlite`;
try { fs.rmSync(dbPath, { force: true }); } catch {}
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DEV_AUTH = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'commercial-convergence-secret-0123456789';
process.env.DB_PATH = dbPath;
process.env.CREDIT_ECONOMY_ENABLED = 'true';

const { ensureCommercialSchema, recordCommercialEvent, getCommercialRevenueSummary, createUserAgentDelegation, listUserAgentDelegations, recordDonationOrOffering } = await import('../src/services/commercialLedger.js');
const { settleCommercialEventByKey } = await import('../src/services/commercialSettlement.js');

await ensureCommercialSchema();
const owner = '+2347000000991';
const provider = '+2347000000992';

const first = await recordCommercialEvent({ eventType:'subscription_charge', direction:'inbound', status:'settled', currency:'NGN', grossMinor:500, platformFeeMinor:500, payer:owner, payee:'KURUKOO', representedParty:owner, idempotencyKey:'test:subscription:1' });
const duplicate = await recordCommercialEvent({ eventType:'subscription_charge', direction:'inbound', status:'settled', currency:'NGN', grossMinor:500, platformFeeMinor:500, payer:owner, payee:'KURUKOO', representedParty:owner, idempotencyKey:'test:subscription:1' });
assert.equal(first, duplicate, 'commercial ledger must be idempotent');

const donation = await recordDonationOrOffering({ payer:owner, recipient:'agent_prayer_companion', amountMinor:300, currency:'NGN', agentId:'agent_prayer_companion', skill:'prayer', type:'donation', externalReference:'test-donation-1' });
assert.ok(donation > 0);

const delegation = await createUserAgentDelegation({ ownerPhone:owner, skill:'painter', instructions:'Only accept residential jobs within my service area. Ask me before discounts.', authority:{can_quote:true, max_commitment_minor:100000}, monthlyPriceMinor:1500, currency:'NGN', allowDonations:false });
assert.ok(delegation.delegationId && delegation.agentId);
const delegations = await listUserAgentDelegations(owner);
assert.equal(delegations.length, 1);
assert.equal(String(delegations[0].skill), 'painter');
assert.equal(Number(delegations[0].monthly_price_minor), 1500);

const summaryBefore = await getCommercialRevenueSummary();
assert.equal(summaryBefore.grossMinor, 800);
assert.equal(summaryBefore.platformFeesMinor, 500);

await settleCommercialEventByKey('test:subscription:1','stripe_test_1',{verified:true});
const summaryAfter = await getCommercialRevenueSummary();
assert.equal(summaryAfter.eventCount, summaryBefore.eventCount);

console.log(JSON.stringify({ ok:true, commercialLedger:{first,duplicate,donation}, delegation, summaryBefore, summaryAfter }, null, 2));
try { fs.rmSync(dbPath, { force: true }); } catch {}
