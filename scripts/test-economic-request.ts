import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import {
  auditEconomicTaxonomy,
  getDefaultCapabilities,
  getEconomicCategory,
  getKnownSkills,
  ECONOMIC_CATEGORIES,
  getAllowedEconomicTransitions,
} from '../src/services/skillFlows.js';

const taxonomy = auditEconomicTaxonomy();
if (taxonomy.unmapped.length) throw new Error(`Unmapped skills: ${taxonomy.unmapped.join(', ')}`);
if (taxonomy.categories !== ECONOMIC_CATEGORIES.length) throw new Error('Economic category count mismatch');

// `ride_request` is the chat intent; the canonical economic skill it resolves to
// is `okada_rider` (see intentRouter.ts). Keep this audit aligned with the
// canonical CATEGORY_BY_SKILL catalogue rather than introducing a second alias.
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
const known = getKnownSkills();
if (known.length < 100) throw new Error(`Expected broad skill taxonomy, found only ${known.length}`);
if (!getAllowedEconomicTransitions('requested').includes('awaiting_match')) {
  throw new Error('Initial lifecycle transition missing');
}
if (!getAllowedEconomicTransitions('paid').includes('in_fulfillment')) {
  throw new Error('Paid -> fulfilment transition missing');
}
if (!getAllowedEconomicTransitions('fulfilled').includes('completed')) {
  throw new Error('Fulfilled -> completed transition missing');
}

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
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
    return { response, body: await response.json() as Record<string, unknown> };
  };
  const json = (token?: string, body?: Record<string, unknown>) => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    const anonymousCreate = await request('/api/economic-requests', json(undefined, {
      skill: 'find_worker', requirements: { service: 'plumbing', location: 'Lagos' }, allowPartial: true,
    }));
    assert.equal(anonymousCreate.response.status, 401, 'anonymous economic request creation must return 401');

    const created = await request('/api/economic-requests', json(owner, {
      skill: 'find_worker', requirements: { service: 'plumbing', location: 'Lagos' }, allowPartial: true,
    }));
    assert.equal(created.response.status, 201, `owner must create request: ${JSON.stringify(created.body)}`);
    const requestId = String((created.body.request as { id?: string }).id || '');
    assert.ok(requestId, 'created request must include an id');

    const crossUserRead = await request(`/api/economic-requests/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${otherUser}` },
    });
    assert.equal(crossUserRead.response.status, 404, 'another user must not read an owner request');

    const ownerRead = await request(`/api/economic-requests/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${owner}` },
    });
    assert.equal(ownerRead.response.status, 200, 'owner must read their request');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fs.rm(testDbPath, { force: true });
  }
}

await main();
console.log(`Economic request audit passed: ${taxonomy.categories} categories, ${taxonomy.skills} skills, explicit HTTP authorization verified.`);
