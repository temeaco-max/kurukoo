import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-supply-acquisition-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath; process.env.KURUKOO_DISABLE_LISTEN = 'true'; process.env.KURUKOO_WORKERS = '0'; process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'provider_supply_acquisition_test_secret_with_32_chars';
const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const sign = (payload: object) => jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const adminToken = sign({ username: 'supply-acquisition-admin', role: 'admin' });
const auth = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
const server = app.listen(0); const address = server.address(); assert.ok(address && typeof address === 'object'); const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const policy = await fetch(`${baseUrl}/api/supply-registry/admin/source-policies`, { method: 'POST', headers: auth, body: JSON.stringify({ source: 'approved.example.test', sourceType: 'public_website', sourceUrlPattern: 'https://approved.example.test', allowedForImport: true, termsReviewStatus: 'approved', operatorApproved: true, freshnessWindowDays: 30 }) });
  assert.equal(policy.status, 201);
  const batch = await fetch(`${baseUrl}/api/supply-registry/admin/imports`, { method: 'POST', headers: auth, body: JSON.stringify({ batchId: 'acquisition-fixture-001', records: [
    { businessName: 'Lagos Repair House', country: 'Nigeria', state: 'LA', lga: 'VI', locality: 'Victoria Island', entityType: 'business', website: 'https://approved.example.test/lagos-repair', source: 'approved.example.test', sourceType: 'public_website', sourceUrl: 'https://approved.example.test/lagos-repair', services: ['phone_repairer'], openingHours: { mon_fri: '09:00-17:00' }, sourceConfidence: 0.9 },
    { businessName: 'Rejected Private Record', country: 'Nigeria', state: 'Lagos', lga: 'Ikeja', source: 'approved.example.test', sourceType: 'public_website', sourceUrl: 'https://approved.example.test/private', openingHours: { employee_email: 'person@example.com' } },
  ] }) });
  assert.equal(batch.status, 201); const batchBody = await batch.json(); assert.equal(batchBody.imported.length, 1); assert.equal(batchBody.rejected.length, 1);
  const entity = batchBody.imported[0]; assert.equal(entity.normalizedState, 'Lagos'); assert.equal(entity.normalizedLga, 'Eti-Osa'); assert.equal(entity.freshnessState, 'review_required'); assert.equal(entity.providerVerified, undefined);
  const publicBeforeReview = await fetch(`${baseUrl}/api/supply-registry/public-listings`); assert.equal((await publicBeforeReview.json()).listings.length, 0);
  const review = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entity.id)}/review`, { method: 'POST', headers: auth, body: JSON.stringify({ decision: 'still_current', evidenceRef: 'review:acquisition-fixture-001' }) }); assert.equal(review.status, 200);
  const publicAfterReview = await fetch(`${baseUrl}/api/supply-registry/public-listings`); const publicBody = await publicAfterReview.json(); assert.equal(publicBody.listings.length, 1); assert.equal(publicBody.listings[0].label, 'Publicly listed business'); assert.equal(publicBody.listings[0].providerVerified, false); assert.equal(publicBody.listings[0].availability, 'unknown');
  const duplicateImport = await fetch(`${baseUrl}/api/supply-registry/admin/entities`, { method: 'POST', headers: auth, body: JSON.stringify({ businessName: 'Lagos Repair House', country: 'Nigeria', state: 'Lagos', lga: 'Victoria Island', website: 'https://approved.example.test/lagos-repair', source: 'approved.example.test', sourceType: 'public_website', sourceUrl: 'https://approved.example.test/lagos-repair-copy', sourceConfidence: 0.9 }) }); assert.equal(duplicateImport.status, 201);
  const duplicates = await fetch(`${baseUrl}/api/supply-registry/admin/duplicates`, { headers: auth }); const duplicateBody = await duplicates.json(); assert.ok(duplicateBody.duplicates.length >= 1);
  const db = await getDb(); db.run("UPDATE provider_supply_entities SET next_review_at='2000-01-01T00:00:00.000Z' WHERE id=?", [entity.id]); saveDb();
  const stale = await fetch(`${baseUrl}/api/supply-registry/admin/freshness/revalidate-overdue`, { method: 'POST', headers: auth }); assert.equal(stale.status, 200); const detail = await fetch(`${baseUrl}/api/supply-registry/admin/entities/${encodeURIComponent(entity.id)}`, { headers: auth }); assert.equal((await detail.json()).entity.freshnessState, 'stale');
  console.log('Controlled Nigerian supply acquisition regression passed: bounded import, source policy, privacy rejection, geography, duplicate review, freshness, and public-vs-provider semantics.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve())); for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
