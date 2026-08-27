import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-provider-readiness-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_MAGIC_LINK_AUTH = 'false';
process.env.KURUKOO_PERSISTENT_STATE_REQUIRED = 'false';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'provider-readiness-test-secret-0123456789';

const { getDb, saveDb } = await import('../src/database.js');
const { ensureCapability, listCapabilityPortfolio, setCapabilityState } = await import('../src/services/capabilityPortfolioService.js');
const { submitProviderVerification, reviewProviderVerification } = await import('../src/services/providerVerificationLifecycle.js');

const db = await getDb();
const providerPhone = '+2347000020101';
db.run(`INSERT INTO memory_profiles (phone,name,location,country,is_available,verified_provider,trust_score) VALUES (?,?,?,'ng',1,0,5)`, [providerPhone, 'Provider readiness test', 'Ikeja']);

const capability = await ensureCapability(providerPhone, 'delivery', 'provider', { service_area: 'Ikeja' });
assert.equal(capability.skill, 'delivery');
assert.equal(capability.availability, 'offline', 'an unverified provider capability must start offline');
assert.equal(capability.isVerified, false);

const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const token = jwt.sign({ phone: providerPhone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
try {
  const blockedResponse = await fetch(`${base}/api/capabilities/delivery`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ availability: 'available' }),
  });
  assert.equal(blockedResponse.status, 409, 'the public capability API must block unverified providers from enabling availability');
  const blockedPayload = await blockedResponse.json() as { success?: boolean; error?: string };
  assert.equal(blockedPayload.success, false);
  assert.match(String(blockedPayload.error), /verification is required/i);
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

await assert.rejects(
  () => setCapabilityState(providerPhone, 'delivery', { availability: 'available' }),
  /verification is required/i,
  'an unverified provider cannot self-enable discoverable availability',
);
const blocked = (await listCapabilityPortfolio(providerPhone)).find(item => item.skill === 'delivery');
assert.equal(blocked?.status, 'onboarding');
assert.equal(blocked?.availability, 'offline');
const disabledSkill = db.exec('SELECT is_available FROM skills WHERE phone=? AND skill=?', [providerPhone, 'delivery']);
assert.equal(Number(disabledSkill[0]?.values[0]?.[0]), 0, 'blocked availability cannot leak into canonical matching');

const submitted = await submitProviderVerification({ providerPhone, entityType: 'human', evidence: ['government-id-ref-201', 'provider-photo-ref-201'] });
assert.equal(submitted.state, 'submitted');
const verified = await reviewProviderVerification({ providerPhone, reviewerId: 'admin:provider-readiness-test', decision: 'verified' });
assert.equal(verified.state, 'verified');

const active = await setCapabilityState(providerPhone, 'delivery', { status: 'active', availability: 'available', metadata: { confirmed_operating_area: 'Ikeja' } });
assert.equal(active.status, 'active');
assert.equal(active.availability, 'available');
assert.equal(active.isVerified, true, 'portfolio truth must derive from the verification lifecycle');
assert.equal(active.metadata.confirmed_operating_area, 'Ikeja');
assert.equal(active.metadata.verification_state, 'verified');
const enabledSkill = db.exec('SELECT is_available FROM skills WHERE phone=? AND skill=?', [providerPhone, 'delivery']);
assert.equal(Number(enabledSkill[0]?.values[0]?.[0]), 1, 'verified readiness enables the existing skills source used by matching');

await assert.rejects(
  () => setCapabilityState(providerPhone, 'delivery', { status: 'verified' }),
  /operator-governed/i,
  'providers cannot use the portfolio API to self-assert verification',
);
const offline = await setCapabilityState(providerPhone, 'delivery', { status: 'paused', availability: 'offline' });
assert.equal(offline.status, 'paused');
assert.equal(offline.availability, 'offline');
assert.equal(Number(db.exec('SELECT is_available FROM skills WHERE phone=? AND skill=?', [providerPhone, 'delivery'])[0]?.values[0]?.[0]), 0);

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* isolated test cleanup is best-effort */ }
console.log(JSON.stringify({ passed: true, providerPhone, status: active.status, verification: active.metadata.verification_state, canonicalAvailability: active.availability }, null, 2));
