/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-stripe-payment-${process.pid}-${Date.now()}.sqlite`;

process.env.KURUKOO_PAY_PROVIDER = 'stripe';
process.env.STRIPE_SECRET_KEY = 'sk_test_adapter_contract';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_adapter_contract';
process.env.KURUKOO_TEST_STRIPE_SECRET_KEY = '';
process.env.KURUKOO_TEST_STRIPE_WEBHOOK_SECRET = '';
const { stripeStatus, verifyStripeWebhook } = await import('../src/services/stripePayment.js');
assert.equal(stripeStatus().configured, true, 'Stripe must report configured only when both server secrets and provider selection are present');
const payload = Buffer.from(JSON.stringify({ id: 'evt_contract_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_contract_1', status: 'succeeded', amount: 4500, currency: 'gbp', metadata: { economic_request_id: 'request_contract_1' } } } }));
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex');
const verified = verifyStripeWebhook(payload, `t=${timestamp},v1=${signature}`);
assert.equal(verified?.id, 'evt_contract_1', 'A valid Stripe raw-body signature must verify');
assert.equal(verified?.data.object?.metadata?.economic_request_id, 'request_contract_1', 'Only canonical request metadata is available for reconciliation');
assert.equal(verifyStripeWebhook(payload, `t=${timestamp},v1=invalid`), null, 'Invalid webhook signatures must fail closed');
const oldTimestamp = String(Math.floor(Date.now() / 1000) - 301);
const oldSignature = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!).update(`${oldTimestamp}.${payload.toString('utf8')}`).digest('hex');
assert.equal(verifyStripeWebhook(payload, `t=${oldTimestamp},v1=${oldSignature}`), null, 'Expired webhook signatures must fail closed');
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.KURUKOO_TEST_STRIPE_SECRET_KEY = '';
process.env.KURUKOO_TEST_STRIPE_WEBHOOK_SECRET = '';
assert.equal(stripeStatus().configured, false, 'Missing verification secret must disable the production adapter');
process.env.STRIPE_SECRET_KEY = 'CHANGE_ME_TO_A_REAL_SECRET';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_adapter_contract';
assert.equal(stripeStatus().configured, false, 'Placeholder payment credentials must disable the production adapter');
process.env.STRIPE_SECRET_KEY = 'sk_test_adapter_contract';
process.env.STRIPE_WEBHOOK_SECRET = 'CHANGE_ME_TO_A_REAL_WEBHOOK_SECRET';
assert.equal(stripeStatus().configured, false, 'Placeholder webhook credentials must disable the production adapter');
console.log('Stripe adapter contract passed: configured-only execution, raw-body signature verification, replay-window rejection, and request metadata integrity.');
