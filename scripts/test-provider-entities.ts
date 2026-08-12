import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-provider-entities-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';

const { getDb, saveDb } = await import('../src/database.js');
const { find_worker } = await import('../src/services/find-worker.js');
const { createEconomicRequest, getEconomicRequest, transitionEconomicRequest } = await import('../src/services/skillFlows.js');
const { runOrchestrationPass, lockEscrowForEconomicRequest } = await import('../src/services/tradeEngine.js');
const { createAIAgent } = await import('../src/services/aiAgentService.js');
const { isProviderEntityType, normalizeProviderEntityType } = await import('../src/services/providerEntity.js');
const { ensureProviderVerificationSchema, setProviderVerification } = await import('../src/services/providerVerification.js');
await ensureProviderVerificationSchema();

const db = await getDb();
const customerPhone = '+2347000000301';
const humanPhone = '+2347000000302';
const businessPhone = '+2347000000303';
const authorizedDronePhone = '+2347000000304';
const unauthorizedDronePhone = '+2347000000305';
const contributorPhone = '+2347000000306';
const agentId = 'agent_provider_entity_test';
const externalPlatformPhone = '+2347000000307';

for (const [phone, name, providerType, verified] of [
  [customerPhone, 'Provider Entity Customer', 'human', 0],
  [humanPhone, 'Human Plumber', 'human', 1],
  [businessPhone, 'Business Plumber', 'business', 1],
  [authorizedDronePhone, 'Authorized Delivery Asset', 'drone', 1],
  [unauthorizedDronePhone, 'Unverified Delivery Asset', 'drone', 0],
  [externalPlatformPhone, 'External Platform Test Provider', 'external_platform', 1],
  ] as const) {
  db.run(
    `INSERT INTO memory_profiles (phone, name, location, country, provider_type, verified_provider)
     VALUES (?, ?, 'Ikeja', 'ng', ?, ?)`,
    [phone, name, providerType, verified]
  );
  if (verified) {
    await setProviderVerification(phone, 'verified', {
      evidenceRef: `fixture:provider-entity:${phone}`,
      reviewedBy: 'provider_entity_fixture',
    });
  }
}

db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode) VALUES (?, 'plumber', 1, 3000, 4.8, 10, 'stationary')`, [humanPhone]);
db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode) VALUES (?, 'plumber', 1, 3500, 4.7, 8, 'stationary')`, [businessPhone]);
db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode) VALUES (?, 'delivery', 1, 4500, 4.9, 4, 'delivery')`, [authorizedDronePhone]);
// A category-specific human verification marker must not authorize a non-human entity.
db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode, verified_artist) VALUES (?, 'delivery', 1, 100, 5, 99, 'delivery', 1)`, [unauthorizedDronePhone]);
db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode) VALUES (?, 'external_fulfillment_test', 1, 5000, 4.6, 1, 'stationary')`, [externalPlatformPhone]);

assert.equal(isProviderEntityType('drone'), true, 'drone must be a constrained provider entity type');
assert.equal(isProviderEntityType('external_platform'), true, 'external platforms must be a constrained provider entity type');
assert.equal(isProviderEntityType('invented_asset'), false, 'unknown provider types must be rejected');
assert.equal(normalizeProviderEntityType('invented_asset'), 'human', 'legacy/invalid provider types must normalize safely');

const persistedTypes = db.exec(
  `SELECT phone, provider_type FROM memory_profiles WHERE phone IN (?, ?, ?, ?) ORDER BY phone`,
  [humanPhone, businessPhone, authorizedDronePhone, externalPlatformPhone]
)[0]?.values || [];
assert.deepEqual(
  persistedTypes.map((row: unknown[]) => row[1]),
  ['human', 'business', 'drone', 'external_platform'],
  'provider type must persist without changing existing human records'
);

const plumbers = await find_worker({ skill: 'plumber', location: 'Ikeja', max: 10 });
assert.deepEqual(
  plumbers.providers.map((provider) => provider.phone).sort(),
  [humanPhone, businessPhone].sort(),
  'existing verified human and business providers must remain discoverable through the canonical matcher'
);
assert.deepEqual(
  plumbers.providers.map((provider) => provider.provider_type).sort(),
  ['business', 'human'],
  'canonical discovery must represent provider type alongside the existing capability match'
);

const deliveries = await find_worker({ skill: 'delivery', location: 'Ikeja', max: 10 });
assert.deepEqual(
  deliveries.providers.map((provider) => provider.phone),
  [authorizedDronePhone],
  'only an independently verified autonomous provider may match its declared delivery capability'
);
assert.equal(deliveries.providers[0]?.provider_type, 'drone', 'authorized autonomous provider type must be represented in discovery');
assert.equal(deliveries.providers[0]?.distance_km, undefined, 'discovery must not fabricate location or telemetry data');
assert.equal(deliveries.providers[0]?.hourly_rate, 4500, 'discovery must use the declared provider rate rather than fabricate a quote');

const externalPlatformDiscovery = await find_worker({ skill: 'external_fulfillment_test', max: 5 });
assert.equal(externalPlatformDiscovery.providers[0]?.phone, externalPlatformPhone, 'a verified external platform must use the same canonical skill matcher');
assert.equal(externalPlatformDiscovery.providers[0]?.provider_type, 'external_platform', 'external platform representation must remain explicit in discovery');

const requestId = 'provider-entity-delivery-request';
await createEconomicRequest({
  id: requestId,
  phone: customerPhone,
  skill: 'delivery',
  requirements: { location: 'Ikeja' },
});
await transitionEconomicRequest(requestId, 'awaiting_match');
const orchestration = await runOrchestrationPass();
assert.deepEqual(orchestration.errors, [], 'provider entity discovery must not introduce orchestration errors');
const request = await getEconomicRequest(requestId);
assert.equal(request?.providerPhone, authorizedDronePhone, 'Economic Requests must use the same canonical discovery result');
assert.equal(request?.status, 'quoted', 'authorized provider discovery must continue through the existing quote lifecycle');
assert.equal((request?.quote as { source?: string } | undefined)?.source, 'provider_listed_rate', 'the existing declared-rate quote path must remain canonical');

const escrowAttempt = await lockEscrowForEconomicRequest(requestId);
assert.equal(escrowAttempt.success, false, 'provider type must not bypass verified-payment and escrow requirements');
assert.match(escrowAttempt.message, /Verified payment must be completed/, 'escrow must retain the existing payment-evidence gate');

// Contributor status is an independent role on the same profile, not a provider type.
db.run(
  `INSERT INTO memory_profiles (phone, name, location, country, is_contributor)
   VALUES (?, 'Contributor and user', 'Ikeja', 'ng', 1)`,
  [contributorPhone]
);
const contributorProfile = db.exec(`SELECT is_contributor, provider_type FROM memory_profiles WHERE phone = ?`, [contributorPhone])[0]?.values?.[0];
assert.deepEqual(contributorProfile, [1, 'human'], 'contributors must remain compatible, non-exclusive profile roles rather than a new provider identity');

await createAIAgent({
  id: agentId,
  name: 'Provider Entity Test Agent',
  avatar: 'T',
  system_prompt: 'Test-only agent; never performs device control.',
  skills: ['software_test_skill'],
  tools: ['test_tool'],
  status: 'active',
  lga: 'All',
  concurrency_limit: 1,
  token_quota_daily: 10,
  cost_threshold_usd: 0.01,
  temperature: 0,
});
const agentProfile = db.exec(`SELECT provider_type, verified_provider, is_available FROM memory_profiles WHERE phone = ?`, [agentId])[0]?.values?.[0];
assert.deepEqual(agentProfile, ['software_service', 1, 1], 'AI agents must remain first-class verified actors while mirroring as software_service providers');
const agentDiscovery = await find_worker({ skill: 'software_test_skill', max: 5 });
assert.equal(agentDiscovery.providers[0]?.phone, agentId, 'AI-agent skills must remain discoverable through the same canonical skill matcher');
assert.equal(agentDiscovery.providers[0]?.provider_type, 'software_service', 'canonical discovery must preserve the software-service representation');

const compositionRoot = fs.readFileSync(path.join(process.cwd(), 'src', 'index.ts'), 'utf8');
assert.doesNotMatch(compositionRoot, /iotBridge|\/api\/iot\/command/, 'no production IoT command route or bridge may be mounted by the composition root');

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary database cleanup is best-effort */ }

console.log('Provider entity integration checks passed');
console.log('Verified: canonical human/business discovery, constrained provider types, authorized autonomous concept matching, no verification bypass, no fabricated telemetry, and unchanged Economic Request/escrow gates.');
