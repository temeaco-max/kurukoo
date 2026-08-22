import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.CREDIT_ECONOMY_ENABLED = 'true';
process.env.FF_WEBRTC = 'true';
process.env.STUN_SERVERS = 'stun:test.invalid';
process.env.DB_PATH = path.join(os.tmpdir(), `kurukoo-outcome-context-${process.pid}-${Date.now()}.sqlite`);

const { getDb } = await import('../src/database.js');
const { createEconomicRequest } = await import('../src/services/skillFlows.js');
const { broadcastDispatch, acceptDispatchLead, markDispatchArrived, completeDispatch } = await import('../src/services/economicDispatchCoordinator.js');
const { getOutcomeContext } = await import('../src/services/outcomeContextService.js');
const { createServiceReview } = await import('../src/services/serviceReviewService.js');

const db = await getDb();
const customer = `+234700001${Date.now().toString().slice(-4)}`;
const driver = `+234700002${Date.now().toString().slice(-4)}`;
try {
  for (const [phone, name] of [[customer, 'Context Customer'], [driver, 'Context Driver']] as const) {
    db.run('INSERT INTO memory_profiles (phone,name,country,verified_provider,points_balance,grace_leads) VALUES (?,?,?,0,0,0)', [phone, name, 'ng']);
  }
  db.run('UPDATE memory_profiles SET verified_provider=1,points_balance=100 WHERE phone=?', [driver]);
  db.run("INSERT INTO skills (phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode) VALUES (?,?,1,100,4.8,4,'mobile')", [driver, 'okada_rider']);
  const request = await createEconomicRequest({ id: `ctx-${Date.now()}`, phone: customer, skill: 'ride_request', requirements: { origin: 'Ikeja', destination: 'Yaba', vehicle_type: 'bike' } });
  const offers = await broadcastDispatch({ requestId: request.id, ownerPhone: customer, skill: 'ride_request', vehicleType: 'bike', location: 'Ikeja', maxProviders: 3 });
  assert.ok(offers.offers.length >= 1);
  const accepted = await acceptDispatchLead({ leadId: offers.offers[0].id, providerPhone: offers.offers[0].providerPhone });
  assert.ok(accepted.leadPoints > 0);
  const matched = await getOutcomeContext({ ownerPhone: customer, requestId: request.id });
  assert.equal(matched?.state, 'matched');
  assert.ok(matched?.communicationSessionId);
  assert.ok(matched?.actions.some(action => action.id === 'communicate'));
  await markDispatchArrived({ leadId: accepted.id, providerPhone: accepted.providerPhone });
  const arrived = await getOutcomeContext({ ownerPhone: customer, requestId: request.id });
  assert.equal(arrived?.state, 'arrived');
  assert.ok(arrived?.actions.some(action => action.id === 'communicate'));
  await completeDispatch({ leadId: accepted.id, providerPhone: accepted.providerPhone, evidence: { pickup_confirmed: true, dropoff_confirmed: true } });
  const completed = await getOutcomeContext({ ownerPhone: customer, requestId: request.id });
  assert.equal(completed?.state, 'completed');
  assert.ok(completed?.actions.some(action => action.id === 'review'));
  await createServiceReview({ requestId: request.id, reviewerPhone: customer, providerPhone: accepted.providerPhone, rating: 5, feedback: 'Good trip' });
  console.log(JSON.stringify({ passed: true, requestId: request.id, leadPoints: accepted.leadPoints, states: [matched?.state, arrived?.state, completed?.state] }, null, 2));
} finally {
  db.run('DELETE FROM economic_dispatch_leads WHERE request_id LIKE ?', ['ctx-%']);
  db.run('DELETE FROM service_reviews WHERE reviewer_phone=? OR provider_phone=?', [customer, driver]);
  db.run('DELETE FROM skills WHERE phone=? OR phone=?', [customer, driver]);
  db.run('DELETE FROM memory_profiles WHERE phone=? OR phone=?', [customer, driver]);
}
