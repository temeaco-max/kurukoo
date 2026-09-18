/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.CREDIT_ECONOMY_ENABLED = 'true';
process.env.FF_WEBRTC = 'false';
process.env.TRICKBRIDGE_BASE_URL = '';
process.env.KURUKOO_PERSISTENT_STATE_REQUIRED = 'false';
process.env.KURUKOO_MAGIC_LINK_AUTH = 'false';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.JWT_SECRET = 'shared-dispatch-outcome-test-secret-0123456789';
process.env.DB_PATH = path.join(os.tmpdir(), `kurukoo-shared-dispatch-${process.pid}-${Date.now()}.sqlite`);

const { getDb, saveDb } = await import('../src/database.js');
const { requestRide } = await import('../src/services/quickRideDispatchService.js');
const { acceptDispatchLead, markDispatchArrived, completeDispatch, confirmDispatchCompletion } = await import('../src/services/economicDispatchCoordinator.js');
const { getEconomicRequest } = await import('../src/services/skillFlows.js');
const { getFulfilmentForEconomicRequest } = await import('../src/services/canonicalFulfilmentService.js');
const { getEconomicParticipants } = await import('../src/services/economicParticipants.js');
const { getProviderCommunicationSession } = await import('../src/services/providerCommunicationService.js');
const { createServiceReview } = await import('../src/services/serviceReviewService.js');

const db = await getDb();
const customer = '+2347000008101';
const driverOne = '+2347000008102';
const driverTwo = '+2347000008103';
for (const [phone, name] of [[customer, 'Ride customer'], [driverOne, 'Taxi driver one'], [driverTwo, 'Taxi driver two']] as const) {
  db.run('INSERT INTO memory_profiles (phone,name,location,country,is_available,verified_provider,points_balance,grace_leads) VALUES (?,?,?, ?,1,0,0,0)', [phone, name, 'Yaba', 'ng']);
}
for (const driver of [driverOne, driverTwo]) {
  db.run('UPDATE memory_profiles SET verified_provider=1,points_balance=100 WHERE phone=?', [driver]);
  db.run("INSERT INTO skills (phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode) VALUES (?,?,1,100,4.8,4,'mobile')", [driver, 'taxi_quick']);
}

const ride = await requestRide({
  ownerPhone: customer,
  originLatitude: 6.5158,
  originLongitude: 3.375,
  originLabel: 'Yaba',
  destinationLabel: 'Lekki Phase 1',
  vehicleType: 'taxi',
  pickupAt: '2026-08-28T08:00:00.000Z',
  passengers: 2,
  budgetMinor: 450000,
  accessibility: 'Easy vehicle access preferred',
  safetyRequirements: 'Verified driver only',
  note: 'Two small bags',
  maxProviders: 5,
});

assert.equal(ride.state, 'awaiting_match');
assert.ok(ride.fulfilmentId, 'quick rides must create a canonical fulfilment record');
assert.equal(ride.offers.length, 2, 'the shared provider dispatch should contact matching transport providers');
const request = await getEconomicRequest(ride.requestId);
assert.equal(request?.requirements.departure_time, '2026-08-28T08:00:00.000Z');
assert.equal(request?.requirements.description, 'Ride from Yaba to Lekki Phase 1');
assert.equal(request?.requirements.accessibility, 'Easy vehicle access preferred');
const fulfilment = await getFulfilmentForEconomicRequest(customer, ride.requestId);
assert.equal(fulfilment?.id, ride.fulfilmentId);
assert.equal(fulfilment?.mechanism, 'provider_dispatch', 'transport must join the existing shared provider-dispatch mechanism');
assert.deepEqual(fulfilment?.missingInputs, []);

const lead = ride.offers[0];
const accepted = await acceptDispatchLead({ leadId: lead.id, providerPhone: lead.providerPhone });
assert.equal(accepted.status, 'accepted');
assert.ok(accepted.communicationSessionId, 'accepted dispatches reuse the provider communication session');
assert.equal((await getFulfilmentForEconomicRequest(customer, ride.requestId))?.status, 'offers_ready');

const arrived = await markDispatchArrived({ leadId: lead.id, providerPhone: lead.providerPhone });
assert.equal(arrived.status, 'arrived');
assert.equal((await getEconomicRequest(ride.requestId))?.status, 'in_fulfillment');
assert.equal((await getFulfilmentForEconomicRequest(customer, ride.requestId))?.status, 'in_fulfillment');
assert.equal((await getProviderCommunicationSession(String(accepted.communicationSessionId)))?.state, 'arrived');
assert.equal((await getEconomicParticipants(ride.requestId)).find(participant => participant.providerPhone === lead.providerPhone)?.status, 'in_progress');

await assert.rejects(
  () => completeDispatch({ leadId: lead.id, providerPhone: lead.providerPhone, evidence: { completed_at: new Date().toISOString() } }),
  /reference/i,
  'a provider cannot report completion without a traceable reference',
);

const reported = await completeDispatch({
  leadId: lead.id,
  providerPhone: lead.providerPhone,
  evidence: {
    trip_reference: 'KQ-RIDE-TEST-8101',
    completed_at: new Date().toISOString(),
    dropoff_confirmed_by_provider: true,
  },
});
assert.equal(reported.status, 'completion_reported', 'provider evidence must not itself complete the real-world outcome');
assert.equal(reported.completionEvidence?.verification_state, 'provider_reported_pending_owner_confirmation');
assert.equal((await getEconomicRequest(ride.requestId))?.status, 'fulfilled', 'a provider report moves the request only to awaiting confirmation');
assert.equal((await getFulfilmentForEconomicRequest(customer, ride.requestId))?.status, 'fulfilled');
assert.equal((await getProviderCommunicationSession(String(accepted.communicationSessionId)))?.state, 'completion_reported');
assert.equal((await getEconomicParticipants(ride.requestId)).find(participant => participant.providerPhone === lead.providerPhone)?.status, 'completion_reported');
const jobsBeforeOwnerConfirmation = db.exec('SELECT jobs_completed FROM skills WHERE phone=? AND skill=?', [lead.providerPhone, 'taxi_quick']);
assert.equal(Number(jobsBeforeOwnerConfirmation[0].values[0][0]), 4, 'provider-reported evidence must not award completion early');

await assert.rejects(
  () => confirmDispatchCompletion({ leadId: lead.id, ownerPhone: driverTwo }),
  /ownership/i,
  'only the request owner may confirm a provider-reported outcome',
);
const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
let completed: Awaited<ReturnType<typeof confirmDispatchCompletion>>;
try {
  const token = jwt.sign({ phone: customer, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/dispatch-leads/${encodeURIComponent(lead.id)}/confirm-completion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  assert.equal(response.status, 200, 'the request owner must be able to confirm the reported outcome through the API');
  const payload = await response.json() as { success?: boolean; lead?: Awaited<ReturnType<typeof confirmDispatchCompletion>> };
  assert.equal(payload.success, true);
  assert.equal(payload.lead?.status, 'completed');
  completed = payload.lead!;
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
assert.equal(completed.status, 'completed');
assert.equal((await getEconomicRequest(ride.requestId))?.status, 'completed');
assert.equal((await getFulfilmentForEconomicRequest(customer, ride.requestId))?.status, 'completed');
assert.equal((await getProviderCommunicationSession(String(accepted.communicationSessionId)))?.state, 'completed');
assert.equal((await getEconomicParticipants(ride.requestId)).find(participant => participant.providerPhone === lead.providerPhone)?.status, 'confirmed');
const jobsAfterOwnerConfirmation = db.exec('SELECT jobs_completed FROM skills WHERE phone=? AND skill=?', [lead.providerPhone, 'taxi_quick']);
assert.equal(Number(jobsAfterOwnerConfirmation[0].values[0][0]), 5, 'provider completion is awarded only after owner confirmation');

const review = await createServiceReview({ requestId: ride.requestId, reviewerPhone: customer, providerPhone: lead.providerPhone, rating: 5, feedback: 'Good trip' });
assert.equal(review.rating, 5);

saveDb(true);
console.log(JSON.stringify({
  passed: true,
  requestId: ride.requestId,
  fulfilmentId: ride.fulfilmentId,
  acceptedProvider: lead.providerPhone,
  verifiedCompletion: completed.status,
  sharedMechanism: fulfilment?.mechanism,
}, null, 2));

// --- AI-agent dispatch lifecycle on the same dispatch rails ---
const AI_AGENT_ID = 'agent_cs_dispatch_test';
const AI_CUSTOMER = 'agent-ride-customer';
const AI_OWNER = 'agent-business-owner';
db.run('INSERT INTO memory_profiles (phone,name,location,country,points_balance,verified_provider,is_available,provider_type) VALUES (?,?,?,?,?,1,1,?) ON CONFLICT(phone) DO UPDATE SET points_balance=excluded.points_balance,verified_provider=1,is_available=1', ['agent_cs_dispatch_test', 'CS Dispatch Agent', 'Lagos', 'ng', 500, 'software_service']);
db.run('INSERT INTO ai_agents (id,name,system_prompt,skills,tools,status,lga,concurrency_limit,token_quota_daily,cost_threshold_usd,temperature,avatar) VALUES(?,?,?,?,?,\'active\',?,5,10000,1.0,0.2,\'🤖\')', ['agent_cs_dispatch_test', 'CS Dispatch Agent', '', JSON.stringify(['customer_service']), '[]', 'All']);
db.run('INSERT INTO memory_profiles (phone,name,location,country,points_balance,is_available,provider_type) VALUES (?,?,?,?,100,1,?) ON CONFLICT(phone) DO UPDATE SET points_balance=excluded.points_balance', ['agent-ride-customer', 'Agent-ride customer', 'Yaba', 'ng', 'human']);
db.run('INSERT INTO memory_profiles (phone,name,location,country,points_balance,is_available,provider_type) VALUES (?,?,?,?,100,1,?) ON CONFLICT(phone) DO UPDATE SET points_balance=excluded.points_balance', ['agent-business-owner', 'Agent business owner', 'Lagos', 'ng', 'human']);
db.run('CREATE TABLE IF NOT EXISTS agent_delegations (id TEXT PRIMARY KEY, owner_phone TEXT, agent_id TEXT, skill TEXT, status TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');
db.run('DELETE FROM agent_delegations WHERE agent_id=?', [AI_AGENT_ID]);
db.run("INSERT INTO agent_delegations (id,owner_phone,agent_id,skill,status) VALUES (?,?,?,'customer_service','active')", ['dlg_agent_8100', AI_OWNER, AI_AGENT_ID]);
saveDb(true);

const { createEconomicRequest: createRequest } = await import('../src/services/skillFlows.js');
const { broadcastDispatch } = await import('../src/services/economicDispatchCoordinator.js');

const csRequest = await createRequest({ id: 'req_cs_8100', phone: AI_CUSTOMER, skill: 'customer_service', requirements: { objective: 'Answer my customer enquiries' } });
const csBroadcast = await broadcastDispatch({ requestId: csRequest.id, ownerPhone: AI_CUSTOMER, skill: 'customer_service' });
const agentOffer = csBroadcast.offers.find((offer) => offer.providerPhone === AI_AGENT_ID);
assert.ok(agentOffer, 'an AI agent must appear as a dispatch candidate for an AI-fulfillable skill');

const rideRequest2 = await createRequest({ id: 'req_ride_8100', phone: AI_CUSTOMER, skill: 'ride_request', requirements: { origin: 'Yaba', destination: 'Ikeja' } });
const rideBroadcast2 = await broadcastDispatch({ requestId: rideRequest2.id, ownerPhone: AI_CUSTOMER, skill: 'ride_request', location: 'Yaba' });
assert.ok(!rideBroadcast2.offers.some((offer) => offer.providerPhone === AI_AGENT_ID), 'an AI agent must never be offered physical work');

const { acceptDispatchLead: acceptLead, markDispatchArrived: markArrived, completeDispatch: reportCompletion, confirmDispatchCompletion: confirmCompletion } = await import('../src/services/economicDispatchCoordinator.js');
const agentAccepted = await acceptLead({ leadId: agentOffer!.id, providerPhone: AI_AGENT_ID });
assert.equal(agentAccepted.status, 'accepted', 'an AI agent must be able to accept a dispatch lead');
assert.ok(agentAccepted.communicationSessionId, 'agent acceptance must open a provider communication session');
const agentParticipant = (await getEconomicParticipants(csRequest.id)).find((participant) => participant.providerPhone === AI_AGENT_ID);
assert.equal(agentParticipant?.role, 'agent', 'agent acceptance must record the agent participant role');
assert.equal((agentParticipant?.evidence as Record<string, unknown>)?.provider_kind, 'ai_agent', 'agent participant evidence must mark the AI provider kind');

const agentArrived = await markArrived({ leadId: agentOffer!.id, providerPhone: AI_AGENT_ID });
assert.equal(agentArrived.status, 'arrived', 'agent progress must be recordable through the canonical lifecycle');

const agentReported = await reportCompletion({ leadId: agentOffer!.id, providerPhone: AI_AGENT_ID, evidence: { completion_reference: 'CS-TICKET-8100', completed_at: new Date().toISOString() } });
assert.equal(agentReported.status, 'completion_reported', 'an agent completion report must remain a claim pending owner confirmation');

const agentFinal = await confirmCompletion({ leadId: agentOffer!.id, ownerPhone: AI_CUSTOMER });
assert.equal(agentFinal.status, 'completed', 'owner confirmation must complete an agent-handled request');
assert.equal((await getEconomicParticipants(csRequest.id)).find((participant) => participant.providerPhone === AI_AGENT_ID)?.status, 'confirmed', 'agent participant must confirm after owner confirmation');

saveDb(true);
try { fs.rmSync(process.env.DB_PATH!, { force: true }); } catch { /* isolated test cleanup */ }
console.log(JSON.stringify({
  passed: true,
  agentRequestId: csRequest.id,
  agentProvider: AI_AGENT_ID,
  agentOutcome: agentFinal.status,
}, null, 2));
