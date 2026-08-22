import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const dbPath = path.join(os.tmpdir(), `kurukoo-physical-execution-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'physical-execution-test-secret-0123456789';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.KURUKOO_EXTERNAL_EXECUTION_ENABLED = 'false';
process.env.KURUKOO_PERSISTENT_STATE_REQUIRED = 'false';
process.env.KURUKOO_MAGIC_LINK_AUTH = 'false';
process.env.KURUKOO_EXTERNAL_AUTO_ACTIVATE = 'false';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest } = await import('../src/services/skillFlows.js');
const { addEconomicParticipant } = await import('../src/services/economicParticipants.js');
const { authorizeProviderConnector, completeDevelopmentExecution, dispatchExecutionRequest, getExecutionRequest, recordExecutionEvidence, reviewExecutionEvidence, revokeProviderConnector, updateExecutionStatus } = await import('../src/services/executionConnector.js');
const { createBoundedPhysicalExecution, declarePhysicalExecutionCapability, derivePhysicalExecutionStage, getPhysicalExecutionDestinationBinding, matchPhysicalExecutionParticipants } = await import('../src/services/physicalExecutionParticipant.js');

const db = await getDb();
const ownerPhone = '+2347000040101';
const courierPhone = '+2347000040102';
const wrongActorPhone = '+2347000040103';
const wrongProviderPhone = '+2347000040104';
const requestId = 'physical-execution-foundation-request';

for (const [phone, name, providerType, verified, available] of [
  [ownerPhone, 'Physical foundation owner', 'human', 0, 1],
  [courierPhone, 'Simulated verified courier', 'human', 1, 1],
  [wrongActorPhone, 'Unauthorised actor', 'human', 0, 1],
  [wrongProviderPhone, 'Verified but unselected courier', 'human', 1, 1],
] as const) {
  db.run(`INSERT INTO memory_profiles(phone,name,location,primary_lga,primary_state,country,is_available,verified_provider,provider_type)
    VALUES (?,?,'Ikeja','Ikeja','Lagos','ng',?,?,?)`, [phone, name, available, verified, providerType]);
}
db.run(`INSERT INTO skills(phone,skill,is_available,operation_mode,service_radius_km,transport_mode,pricing_model)
  VALUES (?,'delivery',1,'mobile',18,'motorbike','quoted')`, [courierPhone]);
db.run(`INSERT INTO skills(phone,skill,is_available,operation_mode,service_radius_km,transport_mode,pricing_model)
  VALUES (?,'delivery',1,'mobile',18,'motorbike','quoted')`, [wrongProviderPhone]);

await assert.rejects(
  () => declarePhysicalExecutionCapability({
    providerPhone: courierPhone,
    actorPhone: wrongActorPhone,
    capability: 'delivery',
    participantType: 'courier',
    supportedActions: ['collect_item'],
  }),
  /Only the provider/i,
  'participant metadata must require the existing provider identity',
);

const courier = await declarePhysicalExecutionCapability({
  providerPhone: courierPhone,
  actorPhone: courierPhone,
  capability: 'delivery',
  participantType: 'courier',
  transportMode: 'motorbike',
  pricingModel: 'quoted',
  operatingConstraints: ['daylight_only', 'road_access_required'],
  supportedPayloadTypes: ['small_parcel', 'repair_item'],
  capacity: { maxPayloadKg: 18 },
  communicationMethods: ['message', 'call'],
  evidenceMethods: ['participant_confirmation', 'timestamp', 'location_reference', 'recipient_confirmation'],
  supportedActions: ['collect_item', 'transport_item', 'deliver_package', 'collect_repair_item', 'return_repaired_item', 'verify_pickup', 'verify_delivery'],
});
assert.equal(courier.participantId, courierPhone);
assert.equal(courier.participantType, 'courier');
assert.equal(courier.providerType, 'human');
assert.equal(courier.serviceArea.lga, 'Ikeja');
assert.equal(courier.transportMode, 'motorbike');
assert.equal(courier.capacity.maxPayloadKg, 18);
assert.equal(courier.verificationState, 'verified');
await declarePhysicalExecutionCapability({
  providerPhone: wrongProviderPhone,
  actorPhone: wrongProviderPhone,
  capability: 'delivery',
  participantType: 'courier',
  supportedActions: ['deliver_package'],
});

await createEconomicRequest({
  id: requestId,
  phone: ownerPhone,
  skill: 'product_sourcing',
  requirements: { origin: 'Ikeja', destination: 'Yaba', destination_latitude: 6.5158, destination_longitude: 3.375 },
  amount: 4500,
});
await addEconomicParticipant({ requestId, ownerPhone, role: 'delivery_provider', providerPhone: courierPhone, capability: 'delivery', status: 'selected' });

const matches = await matchPhysicalExecutionParticipants({
  ownerPhone,
  capability: 'delivery',
  location: 'Ikeja',
  action: 'deliver_package',
  payloadType: 'small_parcel',
});
assert.equal(matches.some((participant) => participant.participantId === courierPhone), true, 'matching must reuse canonical capability discovery and physical constraints');

await authorizeProviderConnector({ providerPhone: courierPhone, connectorId: 'kurukoo_dummy_test_v1', capability: 'delivery', externalProviderId: 'simulated-courier-v1', allowedActions: ['deliver_package'] });
const request = await getEconomicRequest(requestId);
if (!request) throw new Error('Expected Economic Request');
const destinationBinding = getPhysicalExecutionDestinationBinding(request.requirements);
const authorizationScope = {
  requestBinding: requestId,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  destinationBinding,
  allowedActions: ['deliver_package'] as const,
  safetyPolicyRef: 'physical-execution-test-policy',
  maxSpendMinor: 4500,
};
const otherRequestId = 'physical-execution-foundation-other-request';
await createEconomicRequest({ id: otherRequestId, phone: ownerPhone, skill: 'product_sourcing', requirements: { origin: 'Ikeja', destination: 'Yaba' } });
await addEconomicParticipant({ requestId: otherRequestId, ownerPhone, role: 'delivery_provider', providerPhone: courierPhone, capability: 'delivery', status: 'selected' });

await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: wrongActorPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-owner', idempotencyKey: 'wrong-owner-key', correlationId: 'wrong-owner-correlation', authorizationScope }),
  /owner authorization/i,
  'another user cannot authorize a physical execution',
);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: wrongProviderPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-provider', idempotencyKey: 'wrong-provider-key', correlationId: 'wrong-provider-correlation', authorizationScope }),
  /not a participant/i,
  'a verified but unselected provider cannot execute another participant’s request',
);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'transport_item', actionId: 'wrong-action', idempotencyKey: 'wrong-action-key', correlationId: 'wrong-action-correlation', authorizationScope: { ...authorizationScope, allowedActions: ['transport_item'] } }),
  /authorized connector/i,
  'an action outside the connector’s explicit capability scope must fail closed',
);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-destination', idempotencyKey: 'wrong-destination-key', correlationId: 'wrong-destination-correlation', authorizationScope: { ...authorizationScope, destinationBinding: 'tampered' } }),
  /destination/i,
  'destination changes must invalidate an existing authorization scope',
);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-request', idempotencyKey: 'wrong-request-key', correlationId: 'wrong-request-correlation', authorizationScope: { ...authorizationScope, requestBinding: 'another-request' } }),
  /Economic Request/i,
  'authorization cannot be reused for another Economic Request',
);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId: otherRequestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'cross-request-reuse', idempotencyKey: 'cross-request-reuse-key', correlationId: 'cross-request-reuse-correlation', authorizationScope }),
  /Economic Request/i,
  'an authorization scope cannot be reused for a second request with the same participant',
);

const execution = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'deliver-phone', idempotencyKey: 'physical-delivery-idempotency', correlationId: 'physical-delivery-correlation', authorizationScope });
assert.equal(execution.status, 'pending');
assert.equal(derivePhysicalExecutionStage(execution), 'authorized');
assert.equal((execution.authorizationContext.physical_execution as any).participant_type, 'courier');
assert.equal((execution.authorizationContext.physical_execution as any).destination_binding, destinationBinding);
assert.equal(JSON.stringify(execution.authorizationContext).includes('Yaba'), false, 'execution authorization context must not expose a user destination to a participant');
assert.equal(JSON.stringify(execution.authorizationContext).includes('3.375'), false, 'execution authorization context must not expose raw destination coordinates to a participant');

const replay = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'different-action-but-same-key', idempotencyKey: 'physical-delivery-idempotency', correlationId: 'physical-delivery-correlation', authorizationScope });
assert.equal(replay.id, execution.id, 'identical physical execution scope must remain idempotent');

const alterPhysicalAuthorization = async (executionId: string, mutate: (physical: Record<string, unknown>) => Record<string, unknown>) => {
  const stored = await getExecutionRequest(executionId);
  if (!stored) throw new Error('Expected execution to alter');
  const context = stored.authorizationContext as Record<string, unknown>;
  db.run('UPDATE execution_requests SET authorization_context=? WHERE id=?', [JSON.stringify({ ...context, physical_execution: mutate(context.physical_execution as Record<string, unknown>) }), executionId]);
};

const expiredAtDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'expired-at-dispatch', idempotencyKey: 'physical-expired-dispatch-idempotency', correlationId: 'physical-expired-dispatch-correlation', authorizationScope });
await alterPhysicalAuthorization(expiredAtDispatch.id, (physical) => ({ ...physical, authorization_expires_at: new Date(Date.now() - 60_000).toISOString() }));
const expiredDispatch = await dispatchExecutionRequest(expiredAtDispatch.id);
assert.equal(expiredDispatch.status, 'expired', 'expired physical authorization must become the canonical expired terminal state.');
assert.match(expiredDispatch.failureReason || '', /authorization has expired/i, 'expired physical authorization must fail closed before dispatch');

const wrongActionAtDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-action-at-dispatch', idempotencyKey: 'physical-wrong-action-dispatch-idempotency', correlationId: 'physical-wrong-action-dispatch-correlation', authorizationScope });
await alterPhysicalAuthorization(wrongActionAtDispatch.id, (physical) => ({ ...physical, allowed_actions: [] }));
assert.match((await dispatchExecutionRequest(wrongActionAtDispatch.id)).failureReason || '', /outside the active authorization scope/i, 'altered action scope must fail closed before dispatch');

const missingSafetyAtDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'missing-safety-at-dispatch', idempotencyKey: 'physical-missing-safety-dispatch-idempotency', correlationId: 'physical-missing-safety-dispatch-correlation', authorizationScope });
await alterPhysicalAuthorization(missingSafetyAtDispatch.id, (physical) => ({ ...physical, safety_policy_ref: '' }));
assert.match((await dispatchExecutionRequest(missingSafetyAtDispatch.id)).failureReason || '', /safety policy reference is missing/i, 'missing safety reference must fail closed before dispatch');

const destinationChangedAtDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'destination-changed-at-dispatch', idempotencyKey: 'physical-destination-changed-dispatch-idempotency', correlationId: 'physical-destination-changed-dispatch-correlation', authorizationScope });
db.run('UPDATE economic_requests SET requirements_json=? WHERE id=?', [JSON.stringify({ ...request.requirements, destination: 'Lekki' }), requestId]);
assert.match((await dispatchExecutionRequest(destinationChangedAtDispatch.id)).failureReason || '', /destination binding no longer matches/i, 'canonical destination changes must invalidate a stale dispatch authorization');
db.run('UPDATE economic_requests SET requirements_json=? WHERE id=?', [JSON.stringify(request.requirements), requestId]);

const repeatDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'repeat-dispatch', idempotencyKey: 'physical-repeat-dispatch-idempotency', correlationId: 'physical-repeat-dispatch-correlation', authorizationScope });
const firstDispatch = await dispatchExecutionRequest(repeatDispatch.id);
const replayedDispatch = await dispatchExecutionRequest(repeatDispatch.id);
assert.equal(replayedDispatch.status, 'acknowledged', 'repeated dispatch must preserve the canonical acknowledged state');
assert.equal(replayedDispatch.evidence.length, firstDispatch.evidence.length, 'repeated dispatch must not append duplicate connector evidence');

process.env.NODE_ENV = 'development';
const completedSimulation = await completeDevelopmentExecution(execution.id);
assert.equal(completedSimulation.status, 'succeeded');
assert.equal(derivePhysicalExecutionStage(completedSimulation), 'evidence_pending', 'simulated connector evidence must not become a verified physical outcome');
const withVerifiedEvidence = await recordExecutionEvidence(execution.id, {
  id: 'verified-recipient-delivery', source: 'kurukoo_recorded', type: 'delivery_confirmation', scope: 'delivery_provider', submittedBy: ownerPhone, verificationState: 'pending_review', payload: { simulated: true, confirmation: 'recipient' },
});
assert.equal(derivePhysicalExecutionStage(withVerifiedEvidence), 'evidence_pending');
const reviewedCompletion = await reviewExecutionEvidence({ executionId: execution.id, evidenceId: 'verified-recipient-delivery', verificationState: 'verified', reviewedBy: 'canonical-test-reviewer' });
assert.equal(derivePhysicalExecutionStage(reviewedCompletion), 'completed');
await assert.rejects(
  () => recordExecutionEvidence(execution.id, { id: 'forged-physical-completion', source: 'provider_reported', type: 'delivery_confirmation', scope: 'delivery_provider', submittedBy: courierPhone, verificationState: 'verified' }),
  /canonical evidence review boundary/i,
  'a simulated participant cannot forge verified physical completion evidence',
);
const duplicateEvidence = await recordExecutionEvidence(execution.id, {
  id: 'verified-recipient-delivery', source: 'kurukoo_recorded', type: 'delivery_confirmation', scope: 'delivery_provider', submittedBy: ownerPhone, verificationState: 'pending_review', payload: { simulated: true },
});
assert.equal(duplicateEvidence.evidence.filter((evidence) => evidence.id === 'verified-recipient-delivery').length, 1, 'replayed completion evidence must not duplicate');
process.env.NODE_ENV = 'production';

const cancellation = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'cancel-case', idempotencyKey: 'physical-cancel-idempotency', correlationId: 'physical-cancel-correlation', authorizationScope });
assert.equal((await updateExecutionStatus(cancellation.id, 'cancelled')).status, 'cancelled');
await assert.rejects(() => updateExecutionStatus(cancellation.id, 'in_progress'), /Invalid execution transition/i, 'cancelled execution cannot resume');

const availabilityAtDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'availability-at-dispatch', idempotencyKey: 'physical-availability-dispatch-idempotency', correlationId: 'physical-availability-dispatch-correlation', authorizationScope });
db.run('UPDATE memory_profiles SET is_available=0 WHERE phone=?', [courierPhone]);
const unavailableAtDispatch = await dispatchExecutionRequest(availabilityAtDispatch.id);
assert.equal(unavailableAtDispatch.status, 'failed', 'availability must be rechecked immediately before connector dispatch');
assert.match(unavailableAtDispatch.failureReason || '', /Action-time authorization failed: Provider is unavailable/i);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'unavailable-case', idempotencyKey: 'physical-unavailable-idempotency', correlationId: 'physical-unavailable-correlation', authorizationScope }),
  /available physical execution participant/i,
  'participant disappearance must fail closed',
);
db.run('UPDATE memory_profiles SET is_available=1 WHERE phone=?', [courierPhone]);
const connectorAtDispatch = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'connector-at-dispatch', idempotencyKey: 'physical-connector-dispatch-idempotency', correlationId: 'physical-connector-dispatch-correlation', authorizationScope });
await revokeProviderConnector({ providerPhone: courierPhone, connectorId: 'kurukoo_dummy_test_v1', capability: 'delivery' });
const revokedAtDispatch = await dispatchExecutionRequest(connectorAtDispatch.id);
assert.equal(revokedAtDispatch.status, 'failed', 'connector authorization must be rechecked immediately before dispatch');
assert.match(revokedAtDispatch.failureReason || '', /Action-time authorization failed: No active authorized connector/i);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'revoked-case', idempotencyKey: 'physical-revoked-idempotency', correlationId: 'physical-revoked-correlation', authorizationScope }),
  /authorized connector/i,
  'revoked connector credentials must fail closed',
);
assert.equal((await getEconomicRequest(requestId))?.status, 'requested', 'physical execution must not create a second Economic Request lifecycle or fake completion');
assert.equal((await getExecutionRequest(execution.id))?.status, 'succeeded');

db.run('UPDATE memory_profiles SET phone_verified_at=CURRENT_TIMESTAMP WHERE phone=?', [ownerPhone]);
const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
try {
  const token = jwt.sign({ phone: ownerPhone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/economic-requests/${requestId}/execution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerPhone: courierPhone, capability: 'delivery', actionRequested: 'deliver_package', role: 'delivery_provider', idempotencyKey: 'physical-route-bypass' }),
  });
  const payload = await response.json() as { error?: string };
  assert.equal(response.status, 409, 'The generic execution route must reject physical action names that lack the bounded physical authorization envelope.');
  assert.match(payload.error || '', /bounded physical-execution authorization contract/i);
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort isolated cleanup */ }
console.log('Physical execution foundation contract checks passed');
console.log('Verified repository-only contracts: existing provider identity/capability reuse, bounded authorization, destination binding, action-time availability and connector authorization, idempotency, evidence boundary, cancellation, simulated completion, connector revocation, and participant unavailability. No real robot, drone, vehicle, courier, or autonomous system was tested.');
