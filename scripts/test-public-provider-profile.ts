import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-public-provider-profile-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'public_provider_profile_test_secret_at_least_32_chars';

const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { setProviderVerification } = await import('../src/services/providerVerification.js');
const db = await getDb();
const providerPhone = '+2348000001234';
const providerSlug = 'evidence-gated-repair-provider';
db.run(`INSERT INTO memory_profiles(phone,name,location,country,profile_slug,provider_type,is_available) VALUES(?,?,?,?,?,?,?)`, [providerPhone, 'Evidence-gated Repair Provider', 'Ikeja', 'ng', providerSlug, 'human', 1]);
db.run(`INSERT INTO skills(phone,skill,is_available,rating,jobs_completed,hourly_rate) VALUES(?,?,?,?,?,?)`, [providerPhone, 'phone_repairer', 1, 5, 0, 0]);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

try {
  const unverified = await fetch(`${baseUrl}/p/${providerSlug}`);
  const unverifiedBody = await unverified.text();
  assert.equal(unverified.status, 404, 'an unverified provider profile must not be publicly discoverable');
  assert.ok(!unverifiedBody.includes('Evidence-gated Repair Provider'), 'the unverified public response must not expose provider identity');
  assert.ok(!unverifiedBody.includes('Ikeja'), 'the unverified public response must not expose provider location');
  assert.ok(!unverifiedBody.includes(providerPhone), 'the unverified public response must not expose provider phone');

  await setProviderVerification(providerPhone, 'verified', { evidenceRef: 'test://provider-profile-evidence', reviewedBy: 'provider_profile_regression' });
  const verified = await fetch(`${baseUrl}/p/${providerSlug}`);
  const verifiedBody = await verified.text();
  assert.equal(verified.status, 200, 'an evidence-verified provider may use the existing public profile projection');
  assert.ok(verifiedBody.includes('Evidence-gated Repair Provider'));
  assert.ok(verifiedBody.includes('Ikeja'));
  assert.ok(!verifiedBody.includes(providerPhone), 'the public provider profile must not expose the private account phone');
  console.log('Public provider-profile regression passed: evidence verification gates public discovery, unverified identities remain private, and verified projections omit private phone data.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
