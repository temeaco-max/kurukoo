/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import { getDb } from '../src/database.js';
import { upsertProfile } from '../src/routes/authRoutes.js';
import { createPlan } from '../src/services/pricingService.js';
import { upgradeSubscriptionAfterPayment } from '../src/services/subscriptionService.js';
import { getUserSubscriptionState } from '../src/services/subscriptionReadService.js';

const phone = `+234806${String(Date.now()).slice(-8)}`;
const otherPhone = `+234807${String(Date.now()).slice(-8)}`;
await upsertProfile(phone, 'Subscription Actor');
await upsertProfile(otherPhone, 'Other Subscription Actor');
await createPlan({ plan: 'MatrixPlus', country: 'ng', monthly_price_minor: 1500, currency: 'NGN', credits_per_month: 100, features: ['matrix-test'], active: 1 });

process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.FORCE_SANDBOX_SUBSCRIPTION = 'false';
const unpaid = await upgradeSubscriptionAfterPayment(phone, 'MatrixPlus', 'ng', { payment_ref: 'client-supplied-metadata-only' });
assert.equal(unpaid.success, false);
assert.equal(unpaid.payment_required, true);

process.env.FORCE_SANDBOX_SUBSCRIPTION = 'true';
const granted = await upgradeSubscriptionAfterPayment(phone, 'MatrixPlus', 'ng');
assert.equal(granted.success, true);
assert.equal(granted.tier, 'Matrixplus');
const db = await getDb();
const rows = db.exec('SELECT subscription_tier FROM memory_profiles WHERE phone = ?', [phone]);
assert.equal(String(rows[0].values[0][0]), 'Matrixplus');

const own = await getUserSubscriptionState(phone);
assert.equal(own.profile.subscriptionTier, 'Matrixplus');
assert.ok(own.billing, 'successful subscription must expose canonical recurring billing state');
assert.equal(own.billing?.tier, 'Matrixplus');
assert.equal(own.billingHistory.some((entry) => entry.event_type === 'subscription_charge' && entry.status === 'settled'), true);
const other = await getUserSubscriptionState(otherPhone);
assert.equal(other.billing, null, 'another identity must not see the owner billing state');
assert.equal(other.billingHistory.some((entry) => entry.external_reference === own.billingHistory[0]?.external_reference), false);

process.env.FORCE_SANDBOX_SUBSCRIPTION = 'false';
console.log('Subscription regression passed: payment boundary, explicit sandbox grant, persisted entitlement, owner-scoped billing read, and ledger history verified.');
