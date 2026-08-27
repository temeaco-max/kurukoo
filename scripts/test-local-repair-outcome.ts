import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-local-repair-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'development';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';

const { getDb, saveDb } = await import('../src/database.js');
const { startStorefrontSession, advanceStorefront } = await import('../src/services/agenticStorefront.js');
const { getEconomicRequest } = await import('../src/services/skillFlows.js');
const { getFulfilmentForEconomicRequest } = await import('../src/services/canonicalFulfilmentService.js');
const { authorizeProviderConnector, getExecutionRequestsForRequest } = await import('../src/services/executionConnector.js');

const db = await getDb();
const customerPhone = '+2347000000701';
const providerPhone = '+2347000000702';

db.run(`INSERT INTO memory_profiles (phone, name, location, country, provider_type, verified_provider, is_available)
  VALUES (?, ?, 'Ikeja', 'ng', 'business', 1, 1)`, [providerPhone, 'Ikeja Device Care']);
db.run(`INSERT INTO memory_profiles (phone, name, location, country, provider_type, verified_provider, is_available)
  VALUES (?, ?, 'Ikeja', 'ng', 'human', 0, 1)`, [customerPhone, 'Local Repair Customer']);
db.run(`INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode)
  VALUES (?, 'phone_repairer', 1, 18000, 4.9, 12, 'stationary')`, [providerPhone]);
saveDb();

await authorizeProviderConnector({
  providerPhone,
  connectorId: 'kurukoo_dummy_test_v1',
  capability: 'phone_repairer',
  externalProviderId: 'development-phone-repair-provider',
  allowedActions: ['perform_service'],
});

const initial = await startStorefrontSession(customerPhone, 'repair', {
  device_or_asset: 'iPhone 13',
  issue: 'Cracked screen and intermittent charging',
  location: 'Ikeja',
  urgency: 'today',
  fulfilment_method: 'pickup_return',
  collection_address: '12 Allen Avenue, Ikeja',
  delivery_address: '14 Allen Avenue, Ikeja',
  parts_preference: 'genuine screen',
  diagnostic_authorization: 'diagnosis_before_repair',
});
assert.equal(initial.stage, 'catalog_match', 'complete repair requirements must reach canonical provider discovery');
assert.equal(initial.providers?.[0]?.phone, providerPhone, 'repair discovery must return the verified phone_repairer provider');
assert.equal(initial.actions?.some(action => action.id === 'select_provider'), true, 'Chat must require explicit provider selection');
assert.ok(initial.requestId, 'the canonical Economic Request must be persisted');
const intakeFulfilment = await getFulfilmentForEconomicRequest(customerPhone, initial.requestId!);
assert.equal(intakeFulfilment?.mechanism, 'service_request', 'repair must compose with the existing shared service fulfillment mechanism');
assert.equal(intakeFulfilment?.requirements.fulfilment_method, 'pickup_return');
assert.equal(intakeFulfilment?.requirements.collection_address, '12 Allen Avenue, Ikeja');
assert.equal(intakeFulfilment?.requirements.delivery_address, '14 Allen Avenue, Ikeja');
assert.equal(intakeFulfilment?.requirements.parts_preference, 'genuine screen');
assert.equal(intakeFulfilment?.requirements.diagnostic_authorization, 'diagnosis_before_repair');

const selected = await advanceStorefront(customerPhone, initial.requestId!, { providerPhone }, 'select_provider', 'local-repair:select-provider');
assert.equal(selected.stage, 'quote_review', 'provider selection must reach the existing quote review card');
assert.equal(selected.quote?.amount_minor, 18000, 'the provider-declared rate must remain the quote source');

const paidAndExecuted = await advanceStorefront(customerPhone, initial.requestId!, {}, 'confirm_escrow', 'local-repair:confirm-escrow');
assert.equal(paidAndExecuted.stage, 'service_in_progress', 'sandbox payment must enter the generic service execution boundary');
assert.match(paidAndExecuted.title, /Development service simulation complete/i);
assert.equal(paidAndExecuted.execution?.status, 'succeeded', 'the bounded development connector must record execution evidence');
assert.equal(paidAndExecuted.execution?.authorizationContext?.simulated, true, 'development execution must be explicitly marked simulated');

const completed = await advanceStorefront(customerPhone, initial.requestId!, {}, 'confirm_complete', 'local-repair:confirm-complete');
assert.equal(completed.stage, 'complete', 'the user confirmation must complete the canonical Economic Request');
const request = await getEconomicRequest(initial.requestId!);
assert.equal(request?.status, 'completed');
assert.equal(request?.fulfillment?.simulated, true, 'payment/execution evidence must retain the development truth marker');
const executions = await getExecutionRequestsForRequest(initial.requestId!);
assert.equal(executions.length, 1, 'execution must be idempotently represented once');

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary cleanup is best-effort */ }
console.log('Local iPhone repair outcome regression passed');
console.log('Verified: canonical discovery, explicit provider selection, development payment authorization, escrow, service-provider execution evidence, completion confirmation, idempotency, and truthful simulation boundaries.');
