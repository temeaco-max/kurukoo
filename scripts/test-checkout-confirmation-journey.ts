import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const workspace = read('views/workspace.ejs');
const client = read('public/js/kurukoo-workspace.js');
const style = read('public/css/kurukoo-workspace.css');
const cartRoutes = read('src/routes/cartRoutes.ts');
const economicRoutes = read('src/routes/economicRequestRouter.ts');

const requireSource = (source: string, fragment: string, label: string) =>
  assert.ok(source.includes(fragment), `${label}: missing ${fragment}`);
const forbidSource = (source: string, fragment: string, label: string) =>
  assert.ok(!source.includes(fragment), `${label}: unexpected ${fragment}`);

requireSource(workspace, 'data-cart-live', 'cart hydration owner');
requireSource(workspace, 'data-confirmation-live', 'confirmation hydration owner');
requireSource(workspace, 'data-workspace-fixture', 'visual fixture boundary');
requireSource(workspace, 'Price pending confirmation', 'truthful cart price state');
requireSource(workspace, 'No payment has been taken', 'truthful payment state');
requireSource(workspace, 'Continue in Chat', 'canonical chat return');

requireSource(client, "cartRequest('/api/cart')", 'owner-scoped cart read');
requireSource(client, "cartRequest('/api/cart/checkout'", 'canonical cart checkout');
requireSource(client, "cartRequest('/api/economic-requests')", 'owner-scoped confirmation list');
requireSource(client, '/participants`)', 'canonical provider evidence read');
requireSource(client, "body: JSON.stringify({ status: 'cancelled' })", 'canonical cancellation transition');
requireSource(client, "cancel.textContent = 'Confirm cancellation'", 'two-step cancellation');
requireSource(client, "'No payment has been taken'", 'client non-payment copy');
requireSource(client, "'Not claimed until the canonical lifecycle records it.'", 'no fabricated fulfilment');
requireSource(client, 'chatContinuationHref', 'request-specific Chat continuation');
requireSource(client, 'visualFixture', 'fixture preservation');
forbidSource(client, 'payment_started: true', 'fabricated payment state');
forbidSource(client, 'window.open(', 'unbounded external checkout redirect');

requireSource(cartRoutes, "router.get('/cart', authenticateUser", 'authenticated cart read');
requireSource(cartRoutes, "router.post('/cart/checkout', authenticateUser", 'authenticated checkout boundary');
requireSource(cartRoutes, 'items.length !== 1', 'one-offer audit boundary');
requireSource(cartRoutes, 'payment_started: false', 'cart route non-payment evidence');
requireSource(cartRoutes, 'startKnownOfferEconomicRequest', 'canonical request creation');
requireSource(cartRoutes, 'buyerPhone: phone', 'cart owner propagation');
forbidSource(cartRoutes, 'createStripePaymentIntent', 'cart does not bypass payment boundary');

requireSource(economicRoutes, "router.get('/:id', authenticateUser", 'authenticated request detail');
requireSource(economicRoutes, 'request.phone !== phone', 'owner isolation');
requireSource(economicRoutes, "customerAllowed = new Set<EconomicRequestStatus>(['awaiting_confirmation', 'reserved', 'cancelled', 'completed'])", 'bounded customer lifecycle actions');
requireSource(economicRoutes, 'A request must be fulfilled before the customer can complete it.', 'fail-closed fulfilment');

requireSource(style, '.checkout-detail-row', 'checkout detail styling');
requireSource(style, '.confirmation-metrics', 'confirmation state styling');
requireSource(style, '[data-confirmation-live] .workspace-actions', 'confirmation action grouping');
requireSource(style, '@media(max-width:560px)', 'mobile checkout and confirmation styling');

console.log('Checkout and confirmations journey contract passed: owner-scoped review, explicit request/payment evidence, cancellation confirmation, and return-to-Chat boundaries verified.');
