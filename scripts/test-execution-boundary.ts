import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-execution-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest } = await import('../src/services/skillFlows.js');
const { addEconomicParticipant } = await import('../src/services/economicParticipants.js');
const {
  authorizeProviderConnector,
  revokeProviderConnector,
  authorizeProviderExecution,
  createExecutionRequest,
  dispatchExecutionRequest,
  getExecutionRequest,
  updateExecutionStatus,
  recordExecutionEvidence,
} = await import('../src/services/executionConnector.js');

const db = await getDb();
const buyerPhone = '+2347000020101';
const deliveryPhone = '+2347000020102';
const unconnectedPhone = '+2347000020103';
const requestId = 'execution-boundary-request';

for (const [phone, name, verified] of [
  [buyerPhone, 'Execution test buyer', 0],
  [deliveryPhone, 'Execution test delivery provider', 1],
  [unconnectedPhone, 'Unconnected delivery provider', 1],
] as const) {
  db.run(
    "INSERT INTO memory_profiles (phone,name,location,country,is_available,verified_provider,provider_type) VALUES (?,?,'Ikeja','ng',1,?,?)",
    [phone, name, verified, 'human'],
  );
}
db.run('INSERT INTO skills (phone,skill,is_available,hourly_rate,rating) VALUES (?,\'delivery\',1,1200,4.8)', [deliveryPhone]);
db.run('INSERT INTO skills (phone,skill,is_available,hourly_rate,rating) VALUES (?,\'delivery\',1,1300,4.7)', [unconnectedPhone]);

await createEconomicRequest({
  id: requestId,
  phone: buyerPhone,
  skill: 'product_sourcing',
  requirements: { product: 'known generator', location: 'Ikeja' },
  amount: 8000,
});
await addEconomicParticipant({
  requestId,
  ownerPhone: buyerPhone,
  role: 'delivery_provider',
  providerPhone: deliveryPhone,
  capability: 'delivery',
  status: 'selected',
});
await addEconomicParticipant({
  requestId,
  ownerPhone: buyerPhone,
  role: 'delivery_provider',
  providerPhone: unconnectedPhone,
  capability: 'delivery',
  status: 'offered',
});

const before = await getEconomicRequest(requestId);
assert.equal(before?.status, 'requested', 'execution must not change the canonical Economic Request status');
assert.equal(before?.providerPhone, null, 'delivery execution must not become the primary escrow provider');

const blocked = await authorizeProviderExecution({
  requestId,
  providerPhone: unconnectedPhone,
  role: 'delivery_provider',
  capability: 'delivery',
  actionRequested: 'dispatch_delivery',
});
assert.deepEqual(blocked, { authorized: false, reason: 'No active authorized connector permits this action' }, 'provider type/verification/skill alone must not authorize execution');
await assert.rejects(
  () => createExecutionRequest({
    requestId,
    actionId: 'unauthorized-action',
    providerPhone: unconnectedPhone,
    role: 'delivery_provider',
    capability: 'delivery',
    actionRequested: 'dispatch_delivery',
    idempotencyKey: 'blocked-execution',
    correlationId: `corr-${requestId}`,
  }),
  /No active authorized connector/i,
  'unconnected providers must fail closed instead of appearing dispatched',
);

await authorizeProviderConnector({
  providerPhone: deliveryPhone,
  connectorId: 'kurukoo_dummy_test_v1',
  capability: 'delivery',
  externalProviderId: 'dummy-delivery-provider-1',
  allowedActions: ['dispatch_delivery'],
});
const authorization = await authorizeProviderExecution({
  requestId,
  providerPhone: deliveryPhone,
  role: 'delivery_provider',
  capability: 'delivery',
  actionRequested: 'dispatch_delivery',
});
assert.equal(authorization.authorized, true, 'explicit connector authorization should permit the action');
if (!authorization.authorized) throw new Error('Expected explicit connector authorization');
assert.equal(authorization.connectorId, 'kurukoo_dummy_test_v1');

const created = await createExecutionRequest({
  requestId,
  actionId: 'dispatch-action-1',
  providerPhone: deliveryPhone,
  role: 'delivery_provider',
  capability: 'delivery',
  actionRequested: 'dispatch_delivery',
  idempotencyKey: 'delivery-dispatch-idempotency-1',
  correlationId: `corr-${requestId}`,
  authorizationContext: { invoked_by: buyerPhone, reason: 'buyer selected delivery provider' },
});
assert.equal(created.status, 'pending', 'creation must persist pending before dispatch');
assert.equal(created.connectorId, 'kurukoo_dummy_test_v1');

const dispatched = await dispatchExecutionRequest(created.id);
assert.equal(dispatched.status, 'acknowledged', 'dummy connector must acknowledge dispatch');
assert.match(dispatched.externalReference || '', /^DUMMY-EXEC_/i);
assert.equal(dispatched.evidence[0]?.source, 'connector_reported');
assert.equal(dispatched.evidence[0]?.verificationState, 'pending_review');

const duplicate = await createExecutionRequest({
  requestId,
  actionId: 'different-action-must-not-duplicate',
  providerPhone: deliveryPhone,
  role: 'delivery_provider',
  capability: 'delivery',
  actionRequested: 'dispatch_delivery',
  idempotencyKey: 'delivery-dispatch-idempotency-1',
  correlationId: `corr-${requestId}`,
});
assert.equal(duplicate.id, created.id, 'repeated idempotency key must return the original execution');
assert.equal((await getExecutionRequest(created.id))?.evidence.length, 1, 'idempotent creation must not duplicate evidence');

const inProgress = await updateExecutionStatus(created.id, 'in_progress');
assert.equal(inProgress.status, 'in_progress');
const succeeded = await updateExecutionStatus(created.id, 'succeeded');
assert.equal(succeeded.status, 'succeeded');
assert.equal((await updateExecutionStatus(created.id, 'succeeded')).status, 'succeeded', 'repeated callback status must be idempotent');
await assert.rejects(() => updateExecutionStatus(created.id, 'pending'), /Invalid execution transition/i, 'terminal execution state cannot regress');

const withProviderEvidence = await recordExecutionEvidence(created.id, {
  id: 'provider-handover-001',
  source: 'provider_reported',
  type: 'collection_confirmation',
  scope: 'delivery_provider',
  submittedBy: deliveryPhone,
  verificationState: 'unverified',
  payload: { reference: 'provider-reported-collection' },
});
assert.equal(withProviderEvidence.evidence.at(-1)?.source, 'provider_reported');
assert.equal(withProviderEvidence.evidence.at(-1)?.verificationState, 'unverified');
const withKurukooEvidence = await recordExecutionEvidence(created.id, {
  id: 'buyer-selection-001',
  source: 'kurukoo_recorded',
  type: 'delivery_selection',
  scope: 'delivery_provider',
  submittedBy: buyerPhone,
  verificationState: 'verified',
  payload: { selected: deliveryPhone },
});
assert.equal(withKurukooEvidence.evidence.at(-1)?.source, 'kurukoo_recorded');
assert.equal(withKurukooEvidence.evidence.at(-1)?.verificationState, 'verified');
const repeatedEvidence = await recordExecutionEvidence(created.id, {
  id: 'buyer-selection-001',
  source: 'kurukoo_recorded',
  type: 'delivery_selection',
  scope: 'delivery_provider',
  submittedBy: buyerPhone,
  payload: { selected: deliveryPhone },
});
assert.equal(repeatedEvidence.evidence.filter((item) => item.id === 'buyer-selection-001').length, 1, 'repeated evidence callback must not duplicate evidence');

const after = await getEconomicRequest(requestId);
assert.equal(after?.status, 'requested', 'execution status must not create a second lifecycle or mutate request status');
assert.equal(after?.providerPhone, null, 'execution participant must not become the escrow recipient');

await revokeProviderConnector({ providerPhone: deliveryPhone, connectorId: 'kurukoo_dummy_test_v1', capability: 'delivery' });
const revoked = await authorizeProviderExecution({
  requestId,
  providerPhone: deliveryPhone,
  role: 'delivery_provider',
  capability: 'delivery',
  actionRequested: 'dispatch_delivery',
});
assert.deepEqual(revoked, { authorized: false, reason: 'No active authorized connector permits this action' }, 'revocation must fail closed for subsequent execution');

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* isolated test cleanup is best-effort */ }

console.log('Execution boundary regression checks passed');
console.log('Verified: explicit connector authorization, dummy dispatch, constrained execution lifecycle, idempotency, typed evidence sources, no external-provider fabrication, and unchanged Economic Request/escrow boundaries.');
