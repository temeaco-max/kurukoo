import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-affiliate-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.JWT_SECRET = 'affiliate_lifecycle_test_secret_at_least_32_chars';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');

const token = (payload: Record<string, unknown>) => jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const userHeaders = (phone: string) => ({ Authorization: `Bearer ${token({ phone, role: 'user' })}`, 'Content-Type': 'application/json' });
const adminHeaders = { Authorization: `Bearer ${token({ username: 'affiliate-admin', role: 'admin' })}`, 'Content-Type': 'application/json' };

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const { port } = server.address() as { port: number };
const baseUrl = `http://127.0.0.1:${port}`;

async function json(pathname: string, init: RequestInit): Promise<{ response: Response; body: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  return { response, body: await response.json().catch(() => ({})) };
}

try {
  const anonymousOffers = await fetch(`${baseUrl}/api/affiliate/offers`);
  assert.equal(anonymousOffers.status, 401, 'affiliate offers require an authenticated Kurukoo identity for attributed, consented referral routing');

  const merchantCreate = await json('/api/admin/affiliate/merchants', {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({
      name: 'Example Merchant', websiteUrl: 'https://merchant.example.test/', countries: ['ng'], evidenceRef: 'operator-contract:merchant-1', status: 'active',
    }),
  });
  assert.equal(merchantCreate.response.status, 201, merchantCreate.body.error);
  const merchant = merchantCreate.body.merchant;
  assert.equal(merchant.status, 'active');

  const offerCreate = await json('/api/admin/affiliate/offers', {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({
      merchantId: merchant.id,
      title: 'Example partner offer',
      description: 'A disclosed external merchant referral for regression coverage.',
      externalUrl: 'https://merchant.example.test/offer/ref-123',
      country: 'ng',
      evidenceRef: 'operator-contract:offer-1',
      status: 'active',
    }),
  });
  assert.equal(offerCreate.response.status, 201, offerCreate.body.error);
  const offer = offerCreate.body.offer;
  assert.match(offer.disclosure, /Affiliate link/i, 'an affiliate offer must carry an explicit referral disclosure');
  assert.match(offer.disclosure, /not a Kurukoo verified provider/i, 'an affiliate offer must not inherit provider verification');

  const offers = await json('/api/affiliate/offers?country=ng', { method: 'GET', headers: userHeaders('+2347000000991') });
  assert.equal(offers.response.status, 200, offers.body.error);
  assert.equal(offers.body.offers.length, 1, 'only active evidence-backed country-compatible offers should be projected');
  assert.equal(offers.body.offers[0].id, offer.id);
  assert.match(offers.body.boundary, /not verified Kurukoo providers/i, 'the customer projection must carry the provider-separation boundary');

  const db = await getDb();
  const pointsBefore = Number(db.exec(`SELECT COUNT(*) FROM credit_transactions`)[0]?.values?.[0]?.[0] || 0);
  const visit = await fetch(`${baseUrl}/api/affiliate/offers/${encodeURIComponent(offer.id)}/visit`, { headers: userHeaders('+2347000000991'), redirect: 'manual' });
  assert.equal(visit.status, 302, 'a deliberate customer visit should redirect to the approved external merchant URL');
  assert.equal(visit.headers.get('location'), 'https://merchant.example.test/offer/ref-123');
  const clicks = db.exec(`SELECT owner_hash, destination_url FROM affiliate_click_events WHERE offer_id=?`, [offer.id])[0]?.values || [];
  assert.equal(clicks.length, 1, 'an authenticated visit should create one attributable click record');
  assert.notEqual(clicks[0][0], '+2347000000991', 'click attribution must retain a one-way owner hash rather than a raw phone number');
  assert.equal(clicks[0][1], 'https://merchant.example.test/offer/ref-123');
  const pointsAfterClick = Number(db.exec(`SELECT COUNT(*) FROM credit_transactions`)[0]?.values?.[0]?.[0] || 0);
  assert.equal(pointsAfterClick, pointsBefore, 'click attribution must not mint Points or imply customer payout');

  const conversionCreate = await json('/api/admin/affiliate/conversions', {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({
      merchantId: merchant.id, offerId: offer.id, externalConversionRef: 'merchant-conversion-001', commissionMinor: 375, currency: 'NGN', evidenceRef: 'merchant-settlement-report:001',
    }),
  });
  assert.equal(conversionCreate.response.status, 201, conversionCreate.body.error);
  assert.equal(conversionCreate.body.conversion.duplicate, false);
  const conversionRetry = await json('/api/admin/affiliate/conversions', {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({
      merchantId: merchant.id, offerId: offer.id, externalConversionRef: 'merchant-conversion-001', commissionMinor: 375, currency: 'NGN', evidenceRef: 'merchant-settlement-report:001',
    }),
  });
  assert.equal(conversionRetry.response.status, 200, conversionRetry.body.error);
  assert.equal(conversionRetry.body.conversion.duplicate, true, 'a repeated merchant conversion reference must not duplicate commercial evidence');

  const metrics = await json('/api/admin/affiliate/metrics', { method: 'GET', headers: adminHeaders });
  assert.equal(metrics.response.status, 200, metrics.body.error);
  assert.equal(metrics.body.metrics.merchants.active, 1);
  assert.equal(metrics.body.metrics.offers.active, 1);
  assert.equal(metrics.body.metrics.clicks, 1);
  assert.equal(metrics.body.metrics.conversions.confirmed, 1);
  assert.equal(metrics.body.metrics.confirmedCommissionMinor, 375, 'only confirmed merchant evidence contributes to affiliate commission metrics');
  assert.equal(metrics.body.metrics.currency, 'NGN');

  const commercial = await json('/api/admin/revenue', { method: 'GET', headers: adminHeaders });
  assert.equal(commercial.response.status, 200, commercial.body.error);
  assert.equal(commercial.body.metrics.affiliate.clicks, 1, 'commercial projection must source affiliate activity from canonical evidence');
  assert.equal(commercial.body.metrics.affiliate.confirmedCommissionMinor, 375, 'commercial projection must retain only confirmed commission evidence');
  assert.equal(commercial.body.metrics.subscriptions.collectionsStatus, 'not_configured', 'subscription records must not be treated as collected revenue');
  assert.match(commercial.body.metrics.pointsLeadActivity.boundary, /not fiat/i, 'Points lead activity must remain distinct from fiat revenue');

  const marketing = await json('/api/admin/marketing', { method: 'GET', headers: adminHeaders });
  assert.equal(marketing.response.status, 200, marketing.body.error);
  assert.equal(marketing.body.measuredAdImpressions, 0, 'configured aggregate placement evidence must report zero when no placement exposure exists');
  assert.equal(marketing.body.measuredAdClicks, 0, 'configured aggregate placement evidence must report zero when no placement click exists');

  const pointsAfterConversion = Number(db.exec(`SELECT COUNT(*) FROM credit_transactions`)[0]?.values?.[0]?.[0] || 0);
  assert.equal(pointsAfterConversion, pointsBefore, 'confirmed affiliate commission evidence must remain distinct from the Points economy');

  console.log('Affiliate lifecycle regression passed');
  console.log('Verified: evidence-backed merchants and offers, explicit disclosure, authenticated hashed click attribution, conversion idempotency, no provider/Points conflation, and evidence-only commercial metrics.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort cleanup */ }
}
