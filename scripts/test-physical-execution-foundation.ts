import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-physical-execution-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'physical-execution-test-secret';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.KURUKOO_EXTERNAL_EXECUTION_ENABLED = 'false';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest } = await import('../src/services/skillFlows.js');
const { addEconomicParticipant } = await import('../src/services/economicParticipants.js');
const { authorizeProviderConnector, completeDevelopmentExecution, dispatchExecutionRequest, getExecutionRequest, recordExecutionEvidence, revokeProviderConnector, updateExecutionStatus } = await import('../src/services/executionConnector.js');
const { createBoundedPhysicalExecution, declarePhysicalExecutionCapability, derivePhysicalExecutionStage, getPhysicalExecutionDestinationBinding, matchPhysicalExecutionParticipants } = await import('../src/services/physicalExecutionParticipant.js');

const db = await getDb();
const ownerPhone = '+2347000040101';
const courierPhone = '+2347000040102';
const wrongActorPhone = '+2347000040103';
const requestId = 'physical-execution-foundation-request';

for (const [phone, name, providerType, verified, available] of [
  [ownerPhone, 'Physical foundation owner', 'human', 0, 1],
  [courierPhone, 'Simulated verified courier', 'human', 1, 1],
  [wrongActorPhone, 'Unauthorised actor', 'human', 0, 1],
] as const) {
  db.run(`INSERT INTO memory_profiles(phone,name,location,primary_lga,primary_state,country,is_available,verified_provider,provider_type)
    VALUES (?,?,'Ikeja','Ikeja','Lagos','ng',?,?,?)`, [phone, name, available, verified, providerType]);
}
db.run(`INSERT INTO skills(phone,skill,is_available,operation_mode,service_radius_km,transport_mode,pricing_model)
  VALUES (?,'delivery',1,'mobile',18,'motorbike','quoted')`, [courierPhone]);

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
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  destinationBinding,
  allowedActions: ['deliver_package'] as const,
  safetyPolicyRef: 'physical-execution-test-policy',
  maxSpendMinor: 4500,
};

await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: wrongActorPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-owner', idempotencyKey: 'wrong-owner-key', correlationId: 'wrong-owner-correlation', authorizationScope }),
  /owner authorization/i,
  'another user cannot authorize a physical execution',
);
await assert.rejects(
  () => createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'wrong-destination', idempotencyKey: 'wrong-destination-key', correlationId: 'wrong-destination-correlation', authorizationScope: { ...authorizationScope, destinationBinding: 'tampered' } }),
  /destination/i,
  'destination changes must invalidate an existing authorization scope',
);

const execution = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'deliver-phone', idempotencyKey: 'physical-delivery-idempotency', correlationId: 'physical-delivery-correlation', authorizationScope });
assert.equal(execution.status, 'pending');
assert.equal(derivePhysicalExecutionStage(execution), 'authorized');
assert.equal((execution.authorizationContext.physical_execution as any).participant_type, 'courier');
assert.equal((execution.authorizationContext.physical_execution as any).destination_binding, destinationBinding);

const replay = await createBoundedPhysicalExecution({ requestId, actorPhone: ownerPhone, providerPhone: courierPhone, role: 'delivery_provider', capability: 'delivery', actionRequested: 'deliver_package', actionId: 'different-action-but-same-key', idempotencyKey: 'physical-delivery-idempotency', correlationId: 'physical-delivery-correlation', authorizationScope });
assert.equal(replay.id, execution.id, 'identical physical execution scope must remain idempotent');

process.env.NODE_ENV = 'development';
const completedSimulation = await completeDevelopmentExecution(execution.id);
assert.equal(completedSimulation.status, 'succeeded');
assert.equal(derivePhysicalExecutionStage(completedSimulation), 'evidence_pending', 'simulated connector evidence must not become a verified physical outcome');
const withVerifiedEvidence = await recordExecutionEvidence(execution.id, {
  id: 'verified-recipient-delivery', source: 'kurukoo_recorded', type: 'delivery_confirmation', scope: 'delivery_provider', submittedBy: ownerPhone, verificationState: 'verified', payload: { simulated: true, confirmation: 'recipient' },
});
assert.equal(derivePhysicalExecutionStage(withVerifiedEvidence), 'completed');
const duplicateEvidence = await recordExecutionEvidence(execution.id, {
  id: 'verified-recipient-delivery', source: 'kurukoo_recorded', type: 'delivery_confirmation', scope: 'delivery_provider', submittedBy: ownerPhone, verificationState: 'verified', payload: { simulated: true },
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

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort isolated cleanup */ }
console.log('Physical execution foundation contract checks passed');
console.log('Verified repository-only contracts: existing provider identity/capability reuse, bounded authorization, destination binding, action-time availability and connector authorization, idempotency, evidence boundary, cancellation, simulated completion, connector revocation, and participant unavailability. No real robot, drone, vehicle, courier, or autonomous system was tested.');
