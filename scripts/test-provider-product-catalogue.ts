import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-provider-products-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = 'provider_product_catalogue_test_secret_32_chars';
process.env.KURUKOO_PRODUCT_CATALOGUE_SECRET = 'provider_product_catalogue_reference_secret';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const { ensureProviderVerificationSchema, setProviderVerification } = await import('../src/services/providerVerification.js');
const { getEconomicRequest } = await import('../src/services/skillFlows.js');
const { getEconomicRequestCoordination } = await import('../src/services/economicParticipants.js');
const { routeIntent } = await import('../src/services/intentRouter.js');

const providerPhone = '+2347000040101';
const buyerPhone = '+2347000040102';
const otherPhone = '+2347000040103';
const tokenFor = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '5m' });
const providerToken = tokenFor(providerPhone);
const buyerToken = tokenFor(buyerPhone);
const otherToken = tokenFor(otherPhone);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const { port } = server.address() as { port: number };
const baseUrl = `http://127.0.0.1:${port}`;

async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${url}`, init);
  return { response, body: await response.json().catch(() => ({})) as Record<string, any> };
}

try {
  await ensureProviderVerificationSchema();
  const db = await getDb();
  for (const [phone, name] of [[providerPhone, 'Catalogue Provider'], [buyerPhone, 'Catalogue Buyer'], [otherPhone, 'Catalogue Other']] as const) {
    db.run(`INSERT INTO memory_profiles (phone,name,location,country,provider_type,is_available) VALUES (?,?,'Ikeja','ng','human',1)`, [phone, name]);
  }
  db.run(`INSERT INTO skills (phone,skill,is_available) VALUES (?,'street_food_cart',1)`, [providerPhone]);
  saveDb(true);

  const anonymousWrite = await request('/api/profile/skills/street_food_cart/products', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: [] }),
  });
  assert.equal(anonymousWrite.response.status, 401, 'anonymous callers cannot manage a provider product list');
  const crossOwnerWrite = await request('/api/profile/skills/street_food_cart/products', {
    method: 'PUT', headers: { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ products: [] }),
  });
  assert.equal(crossOwnerWrite.response.status, 400, 'another account cannot alter a provider skill it does not own');

  const productWrite = await request('/api/profile/skills/street_food_cart/products', {
    method: 'PUT', headers: { Authorization: `Bearer ${providerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ products: [{ id: 'suya-combo', title: 'Suya combo', description: 'Grilled beef with onions', priceMinor: 2500, currency: 'NGN', availabilityNote: 'Provider will confirm preparation time.' }] }),
  });
  assert.equal(productWrite.response.status, 200, `provider may manage products on its own existing skill: ${JSON.stringify(productWrite.body)}`);
  assert.equal(productWrite.body.products?.[0]?.id, 'suya-combo', 'the canonical skill record retains the provider product id');

  const beforeVerification = await request('/api/economic-requests/catalogue/search?q=suya', { headers: { Authorization: `Bearer ${buyerToken}` } });
  assert.equal(beforeVerification.response.status, 200);
  assert.deepEqual(beforeVerification.body.listings, [], 'unverified provider products must never enter buyer matching');

  await setProviderVerification(providerPhone, 'verified', { evidenceRef: 'fixture:catalogue-provider', reviewedBy: 'catalogue_regression' });
  const anonymousSearch = await request('/api/economic-requests/catalogue/search?q=suya');
  assert.equal(anonymousSearch.response.status, 401, 'catalogue matching is not an unauthenticated inventory feed');
  const matched = await request('/api/economic-requests/catalogue/search?q=suya', { headers: { Authorization: `Bearer ${buyerToken}` } });
  assert.equal(matched.response.status, 200);
  assert.equal(matched.body.listings?.length, 1, 'evidence-verified available provider product should be matched');
  const listing = matched.body.listings?.[0];
  assert.ok(listing?.id && !String(listing.id).includes(providerPhone), 'buyer matching uses an opaque listing reference rather than provider/product database keys');
  assert.equal(listing.listingState, 'provider_listed', 'match language must disclose a provider listing rather than claimed stock');
  assert.match(String(matched.body.disclosure), /confirmation/i, 'catalogue search must disclose availability and final-price confirmation');

  const intent = await routeIntent('Show me a suya listing or offer', buyerPhone);
  assert.equal(intent.cardData?.type, 'agentic_storefront', 'explicit catalogue language reuses the existing storefront card');
  assert.equal((intent.cardData as any)?.providerProductListings?.[0]?.id, listing.id, 'chat projects the same verified catalogue listing');

  const anonymousStart = await request(`/api/economic-requests/catalogue/${encodeURIComponent(listing.id)}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(anonymousStart.response.status, 401, 'anonymous callers cannot start a request from a provider listing');
  const started = await request(`/api/economic-requests/catalogue/${encodeURIComponent(listing.id)}/start`, {
    method: 'POST', headers: { Authorization: `Bearer ${buyerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: '2 servings', deliveryRequired: true, deliveryLocation: 'Ikeja' }),
  });
  assert.equal(started.response.status, 201, `listing selection must create one canonical request: ${JSON.stringify(started.body)}`);
  const requestId = String(started.body.requestId || '');
  const economicRequest = await getEconomicRequest(requestId);
  assert.equal(economicRequest?.skill, 'product_sourcing', 'selection must reuse the canonical product-sourcing skill lifecycle');
  assert.equal(economicRequest?.requirements.product_listing_state, 'provider_listed', 'the immutable request snapshot preserves listing—not-stock—provenance');
  assert.equal(economicRequest?.requirements.delivery_required, 'yes', 'delivery remains request context, not a second ordering system');
  const coordination = await getEconomicRequestCoordination(requestId);
  assert.equal(coordination.offer?.originOfferId, listing.id, 'the request-scoped offer retains the opaque catalogue reference');
  assert.equal(coordination.offer?.status, 'available', 'the listed offer state never fabricates reservation or fulfilment');
  assert.equal(coordination.participants.some(participant => participant.role === 'seller' && participant.providerPhone === providerPhone), true, 'selection reuses the verified seller participant owner');

  const withdraw = await request('/api/profile/skills/street_food_cart/products', {
    method: 'PUT', headers: { Authorization: `Bearer ${providerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ products: [{ id: 'suya-combo', title: 'Suya combo', active: false }] }),
  });
  assert.equal(withdraw.response.status, 200);
  const afterWithdrawal = await request('/api/economic-requests/catalogue/search?q=suya', { headers: { Authorization: `Bearer ${buyerToken}` } });
  assert.deepEqual(afterWithdrawal.body.listings, [], 'withdrawn provider listings disappear from matching immediately');
  const staleStart = await request(`/api/economic-requests/catalogue/${encodeURIComponent(listing.id)}/start`, { method: 'POST', headers: { Authorization: `Bearer ${buyerToken}`, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(staleStart.response.status, 404, 'a withdrawn listing reference cannot create a request later');

  console.log('Provider product catalogue regression passed');
  console.log('Verified: owner-bound skill products, evidence-gated matching, opaque references, chat/storefront projection, canonical Economic Request/seller linkage, no stock or final-price fabrication, and immediate withdrawal.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* best effort */ }
}
