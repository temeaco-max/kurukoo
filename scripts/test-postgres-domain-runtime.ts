import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const connectionString = process.env.KURUKOO_TEST_POSTGRES_URL;
if (!connectionString) {
  console.log('PostgreSQL domain runtime: BLOCKED_EXTERNAL — set KURUKOO_TEST_POSTGRES_URL to run the real domain round-trip.');
  process.exit(0);
}

process.env.KURUKOO_DATABASE_MODE = 'postgres';
process.env.KURUKOO_PERSISTENT_STATE_REQUIRED = 'true';
process.env.KURUKOO_POSTGRES_APPLICATION_INTEGRATED = 'true';
process.env.KURUKOO_POSTGRES_SSL = process.env.KURUKOO_POSTGRES_SSL || 'false';

const { createEconomicRequest, getEconomicRequest, listEconomicRequestsForPhone, transitionEconomicRequest, updateEconomicRequestRequirements } = await import('../src/services/economicRequestPersistence.js');
const { getCanonicalPersistenceMode } = await import('../src/services/canonicalPersistence.js');

assert.equal(getCanonicalPersistenceMode(), 'postgres', 'domain runtime must execute against PostgreSQL');

const requestId = `pg-domain-${crypto.randomUUID()}`;
const ownerPhone = `pg-test-${crypto.randomUUID()}`;

const created = await createEconomicRequest({
  id: requestId,
  phone: ownerPhone,
  skill: 'food',
  requirements: { description: 'PostgreSQL domain runtime proof' },
  amount: 2500,
});
assert.equal(created.id, requestId);
assert.equal(created.phone, ownerPhone);
assert.equal(created.status, 'requested');
assert.equal(created.requirements.description, 'PostgreSQL domain runtime proof');

const afterRequirements = await updateEconomicRequestRequirements(requestId, ownerPhone, { quantity: 2, delivery_note: 'CI domain runtime' });
assert.equal(afterRequirements.requirements.quantity, 2);
assert.equal(afterRequirements.requirements.delivery_note, 'CI domain runtime');

const awaitingMatch = await transitionEconomicRequest(requestId, 'awaiting_match');
assert.equal(awaitingMatch.status, 'awaiting_match');

const matched = await transitionEconomicRequest(requestId, 'matched', { providerPhone: 'provider-ci' });
assert.equal(matched.status, 'matched');
assert.equal(matched.providerPhone, 'provider-ci');

const fetched = await getEconomicRequest(requestId);
assert(fetched);
assert.equal(fetched.status, 'matched');
assert.equal(fetched.requirements.quantity, 2);

const listed = await listEconomicRequestsForPhone(ownerPhone, { includeClosed: true, limit: 10 });
assert.equal(listed.filter(item => item.id === requestId).length, 1, 'domain persistence must be queryable through the owner projection');

console.log('PostgreSQL domain runtime: VERIFIED — Economic Request create, update, lifecycle transition, reload and owner projection all persisted through the canonical PostgreSQL domain boundary.');