import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-supply-registry-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'provider_supply_registry_test_secret_with_32_chars';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const { setProviderVerification } = await import('../src/services/providerVerification.js');
const { find_worker } = await import('../src/services/find-worker.js');
const db = await getDb();
const claimantPhone = '+2348010013001';
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,provider_type,is_available) VALUES(?,?,?,?,?,?)`, [claimantPhone, 'Supply claimant', 'Ikeja', 'ng', 'business', 1]);
saveDb();

const sign = (payload: object) => jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const adminToken = sign({ username: 'supply-admin', role: 'admin' });
const claimantToken = sign({ phone: claimantPhone, role: 'user' });
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const denied = await fetch(`${baseUrl}/api/supply-registry/admin/entities`);
  assert.equal(denied.status, 401, 'supply registry administration must require admin authentication');

  const missingProvenance = await fetch(`${baseUrl}/api/supply-registry/admin/entities`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ businessName: 'Ikeja Screen Clinic', country: 'ng', sourceType: 'public_website' }) });
  assert.equal(missingProvenance.status, 422, 'public-source import requires a source URL');
  const policy = await fetch(`${baseUrl}/api/supply-registry/admin/source-policies`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ source: 'example.test', sourceType: 'public_website', sourceUrlPattern: 'https://example.test', allowedForImport: true, termsReviewStatus: 'approved', operatorApproved: true, freshnessWindowDays: 30 }) });
  assert.equal(policy.status, 201, 'admin must explicitly approve a source policy before import');

  const retrievedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const imported = await fetch(`${baseUrl}/api/supply-registry/admin/entities`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({
    businessName: 'Ikeja Screen Clinic', entityType: 'business', country: 'ng', state: 'Lagos', lga: 'Ikeja', address: 'Publicly listed address',
    website: 'https://example.test/ikeja-screen-clinic', openingHours: { mon_fri: '09:00-17:00' }, services: ['phone_repairer', 'screen_replacement'],
    source: 'example.test', sourceType: 'public_website', sourceUrl: 'https://example.test/ikeja-screen-clinic', sourceRetrievedAt: retrievedAt, sourceConfidence: 0.8, importBatchId: 'pilot-batch-001',
  }) });
  const importedBody = await imported.json();
  assert.equal(imported.status, 201, `admin can import a provenance-bearing public supply record: ${JSON.stringify(importedBody)}`);
  const entityId = importedBody.entity.id as string;
  assert.equal(importedBody.entity.status, 'imported');
  assert.equal(importedBody.provider_verified, false);
  assert.equal(importedBody.provider_network_membership, 'not implied');
  const profileRows = db.exec(`SELECT phone FROM memory_profiles WHERE name='Ikeja Screen Clinic'`)[0]?.values || [];
  assert.equal(profileRows.length, 0, 'public supply import must not create a Kurukoo provider account');
  assert.equal((await find_worker({ skill: 'phone_repairer', location: 'Ikeja', max: 20 })).providers.some(provider => provider.name === 'Ikeja Screen Clinic'), false, 'unclaimed supply entity must never appear in provider discovery');

  const entityDetail = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}`, { headers: auth(adminToken) });
  assert.equal(entityDetail.status, 200, 'admin can inspect supply provenance');
  const entityDetailBody = await entityDetail.json();
  assert.ok(entityDetailBody.provenance.some((row: any) => row.fieldScope === 'business_profile' && row.sourceUrl === 'https://example.test/ikeja-screen-clinic'), 'public listing provenance must be retained');

  const listingReview = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/review`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ decision: 'still_current', evidenceRef: 'listing-review:fixture:001' }) });
  assert.equal(listingReview.status, 200, 'a source listing must be reviewed before claiming');
  assert.equal((await listingReview.json()).entity.freshnessState, 'current');
  const claim = await fetch(`${baseUrl}/api/supply-registry/entities/${encodeURIComponent(entityId)}/claim`, { method: 'POST', headers: auth(claimantToken), body: '{}' });
  assert.equal(claim.status, 201, 'authenticated account can request a supply claim');
  const claimBody = await claim.json();
  assert.equal(claimBody.provider_verified, false, 'claim request cannot claim provider verification');

  const reviewMissingEvidence = await fetch(`${baseUrl}/api/supply-registry/admin/claims/${encodeURIComponent(claimBody.claim.id)}/review`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ decision: 'approved' }) });
  assert.equal(reviewMissingEvidence.status, 409, 'approving a claim requires claim evidence');
  const review = await fetch(`${baseUrl}/api/supply-registry/admin/claims/${encodeURIComponent(claimBody.claim.id)}/review`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ decision: 'approved', evidenceRef: 'claim-review:fixture:001' }) });
  assert.equal(review.status, 200, 'admin can evidence-approve a claim');
  assert.equal((await review.json()).provider_verified, false, 'approved claim remains separate from verification');

  const genericTransition = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/transition`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ status: 'verified' }) });
  assert.equal(genericTransition.status, 410, 'generic admin lifecycle mutation must remain disabled');
  const startedReadiness = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/provider-readiness/start`, { method: 'POST', headers: auth(adminToken), body: '{}' });
  assert.equal(startedReadiness.status, 200, 'only an approved claim can begin provider readiness review');
  const blockedReadiness = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/provider-readiness`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ evidenceRef: 'provider-readiness:blocked' }) });
  assert.equal(blockedReadiness.status, 409, 'provider readiness remains blocked without separate provider verification and capability');

  db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,provider_type,is_available) VALUES(?,?,?,?,?,?)`, [claimantPhone, 'Ikeja Screen Clinic claimant', 'Ikeja', 'ng', 'business', 1]);
  db.run(`INSERT INTO skills(phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode,service_radius_km) VALUES(?,?,?,?,?,?,?,?)`, [claimantPhone, 'phone_repairer', 1, 250000, 4.7, 4, 'stationary', 5]);
  saveDb();
  await setProviderVerification(claimantPhone, 'verified', { evidenceRef: 'provider-verification:fixture:001', reviewedBy: 'test' });
  const readiness = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/provider-readiness`, { method: 'POST', headers: auth(adminToken), body: JSON.stringify({ evidenceRef: 'provider-readiness:fixture:001' }) });
  assert.equal(readiness.status, 200, 'provider readiness requires the independent evidence and capability gates');

  const activated = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entityId)}/activate`, { method: 'POST', headers: auth(adminToken), body: '{}' });
  assert.equal(activated.status, 200, 'activation requires separate provider evidence and available capability');
  const activatedBody = await activated.json();
  assert.equal(activatedBody.entity.status, 'active');
  assert.equal(activatedBody.entity.linkedProviderPhone, claimantPhone);
  assert.equal(activatedBody.payment_or_dispatch_confirmed, false);
  assert.ok((await find_worker({ skill: 'phone_repairer', location: 'Ikeja', max: 20 })).providers.some(provider => provider.phone === claimantPhone), 'only the separately verified and capable claimant account becomes discoverable');

  console.log('Provider Supply Registry regression passed: provenance-bearing public entity, no automatic network membership, evidence-backed claim review, separate provider verification/capability activation, and no payment or dispatch fabrication.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
