import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import {
  auditEconomicTaxonomy,
  getDefaultCapabilities,
  getEconomicCategory,
  getKnownSkills,
  getSkillCapabilities,
  getSkillRequirements,
  ECONOMIC_CATEGORIES,
  getAllowedEconomicTransitions,
} from '../src/services/skillFlows.js';

const taxonomy = auditEconomicTaxonomy();
if (taxonomy.unmapped.length) throw new Error(`Unmapped skills: ${taxonomy.unmapped.join(', ')}`);
if (taxonomy.categories !== ECONOMIC_CATEGORIES.length) throw new Error('Economic category count mismatch');

// `ride_request` is a chat intent; the canonical economic skill it resolves to
// is `okada_rider`. Keep the audit anchored to the shared skill catalogue.
const requiredSkills = [
  'okada_rider', 'keke_driver', 'order_food', 'buy_car', 'buy_ticket', 'repair',
  'find_worker', 'product_sourcing', 'security_personnel', 'verified_artist',
  'football_player', 'sports_coach',
];
for (const skill of requiredSkills) {
  const category = getEconomicCategory(skill);
  if (!category) throw new Error(`Missing category for required skill: ${skill}`);
  const capabilities = getDefaultCapabilities(category);
  if (!capabilities.includes('discovery') || !capabilities.includes('completion')) {
    throw new Error(`Incomplete capabilities for ${skill}`);
  }
}

// Every canonical skill must use the shared economic request machinery rather
// than introducing a separate transaction architecture.
const known = getKnownSkills();
if (known.length < 120) throw new Error(`Expected broad canonical skill taxonomy, found only ${known.length}`);
for (const skill of known) {
  const category = getEconomicCategory(skill);
  if (!category) throw new Error(`Canonical skill has no category: ${skill}`);
  const requirements = getSkillRequirements(skill);
  if (!requirements.length) throw new Error(`Canonical skill has no requirement schema: ${skill}`);
  const keys = requirements.map((requirement) => requirement.key);
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate requirement keys for ${skill}`);
  for (const requirement of requirements) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(requirement.key)) {
      throw new Error(`Invalid requirement key for ${skill}: ${requirement.key}`);
    }
    if (!requirement.label.trim()) throw new Error(`Blank requirement label for ${skill}: ${requirement.key}`);
  }
  const capabilities = getSkillCapabilities(skill);
  if (!capabilities.includes('discovery') || !capabilities.includes('completion')) {
    throw new Error(`Canonical skill lacks shared economic lifecycle capabilities: ${skill}`);
  }
}

for (const capability of ['verification', 'contract', 'escrow', 'completion'] as const) {
  if (!getSkillCapabilities('verified_artist').includes(capability)) throw new Error(`Artist capability missing: ${capability}`);
}
for (const capability of ['verification', 'evidence', 'escrow', 'completion'] as const) {
  if (!getSkillCapabilities('buy_car').includes(capability)) throw new Error(`Vehicle capability missing: ${capability}`);
}
for (const capability of ['verification', 'evidence', 'payment', 'completion'] as const) {
  if (!getSkillCapabilities('buy_ticket').includes(capability)) throw new Error(`Ticket capability missing: ${capability}`);
}
if (!getAllowedEconomicTransitions('requested').includes('awaiting_match')) throw new Error('Initial lifecycle transition missing');
if (!getAllowedEconomicTransitions('paid').includes('in_fulfillment')) throw new Error('Paid -> fulfilment transition missing');
if (!getAllowedEconomicTransitions('fulfilled').includes('completed')) throw new Error('Fulfilled -> completed transition missing');

const testDbPath = `/tmp/kurukoo-economic-request-${process.pid}.sqlite`;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'economic-request-test-secret-that-is-at-least-32-characters';
process.env.DB_PATH = testDbPath;

const secret = process.env.JWT_SECRET;
const userToken = (phone: string) => jwt.sign({ phone, role: 'user' }, secret, { algorithm: 'HS256', expiresIn: '5m' });
const adminToken = jwt.sign({ role: 'admin', username: 'economic-test-admin' }, secret, { algorithm: 'HS256', expiresIn: '5m' });

async function main() {
  const { app } = await import('../src/index.ts');
  const { getDb } = await import('../src/database.js');
  const { ensureOtpSchema } = await import('../src/services/otpAuthService.js');
  const db = await getDb();
  await ensureOtpSchema();
  db.run("INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, phone_verified_at) VALUES (?, ?, 'Lagos', 'ng', CURRENT_TIMESTAMP)", ['+2347000000001', 'Economic Owner']);
  db.run("INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, phone_verified_at) VALUES (?, ?, 'Lagos', 'ng', CURRENT_TIMESTAMP)", ['+2347000000002', 'Economic Other']);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
    return { response, body: await response.json() as Record<string, unknown> };
  };
  const json = (token?: string, body?: Record<string, unknown>) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  try {
    const anonymousOperation = await request('/api/economic-requests/orchestration/run', json());
    assert.equal(anonymousOperation.response.status, 401, 'anonymous operational route must return 401');
    const ordinaryUserOperation = await request('/api/economic-requests/orchestration/run', json(userToken('+2347000000001')));
    assert.equal(ordinaryUserOperation.response.status, 403, 'ordinary users must not run orchestration');
    const adminOperation = await request('/api/economic-requests/orchestration/run', json(adminToken));
    assert.equal(adminOperation.response.status, 200, 'admin may run orchestration');

    const anonymousLifecycle = await request('/api/economic-requests/memory/lifecycle', json(undefined, { job: 'invalid' }));
    assert.equal(anonymousLifecycle.response.status, 401, 'anonymous lifecycle route must return 401');
    const adminLifecycle = await request('/api/economic-requests/memory/lifecycle', json(adminToken, { job: 'invalid' }));
    assert.equal(adminLifecycle.response.status, 200, 'admin may run memory lifecycle');

    const owner = userToken('+2347000000001');
    const otherUser = userToken('+2347000000002');
    const anonymousCreate = await request('/api/economic-requests', json(undefined, { skill: 'find_worker', requirements: { service: 'plumbing', location: 'Lagos' }, allowPartial: true }));
    assert.equal(anonymousCreate.response.status, 401, 'anonymous economic request creation must return 401');
    const created = await request('/api/economic-requests', json(owner, { skill: 'find_worker', requirements: { service: 'plumbing', location: 'Lagos' }, allowPartial: true }));
    assert.equal(created.response.status, 201, `owner must create request: ${JSON.stringify(created.body)}`);
    const requestId = String((created.body.request as { id?: string }).id || '');
    assert.ok(requestId, 'created request must include an id');
    const crossUserRead = await request(`/api/economic-requests/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${otherUser}` } });
    assert.equal(crossUserRead.response.status, 404, 'another user must not read an owner request');
    const ownerRead = await request(`/api/economic-requests/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${owner}` } });
    assert.equal(ownerRead.response.status, 200, 'owner must read their request');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fs.rm(testDbPath, { force: true });
  }
}

await main();
console.log(`Economic request audit passed: ${taxonomy.categories} categories, ${taxonomy.skills} skills, canonical parity and HTTP authorization verified.`);
