import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV='production';
process.env.KURUKOO_PAY_PROVIDER='sandbox';
process.env.CREDIT_ECONOMY_ENABLED='true';
process.env.FF_WEBRTC='true';
process.env.STUN_SERVERS='stun:test.invalid';
process.env.TRICKBRIDGE_BASE_URL='';
process.env.DB_PATH=path.join(os.tmpdir(),`kurukoo-dispatch-${process.pid}-${Date.now()}.sqlite`);

const { getDb } = await import('../src/database.js');
const { createEconomicRequest } = await import('../src/services/skillFlows.js');
const { getPointsBalance } = await import('../src/services/pointsEngine.js');
const { broadcastDispatch, acceptDispatchLead, markDispatchArrived, completeDispatch } = await import('../src/services/economicDispatchCoordinator.js');
const { getProviderCommunicationSession } = await import('../src/services/providerCommunicationService.js');
const { getRoomPeers } = await import('../src/services/webrtcSignalling.js');
const { createServiceReview } = await import('../src/services/serviceReviewService.js');

const db=await getDb();
const customer='+2347000007001';
const driverOne='+2347000007002';
const driverTwo='+2347000007003';
for(const [phone,name] of [[customer,'Dispatch Customer'],[driverOne,'Bike Driver One'],[driverTwo,'Bike Driver Two']] as const){db.run('INSERT INTO memory_profiles (phone,name,country,verified_provider,points_balance,grace_leads) VALUES (?,?,?,0,0,0)',[phone,name,'ng']);}
for(const phone of [driverOne,driverTwo]){db.run('UPDATE memory_profiles SET verified_provider=1,points_balance=100 WHERE phone=?',[phone]);db.run("INSERT INTO skills (phone,skill,is_available,hourly_rate,rating,jobs_completed,operation_mode) VALUES (?,?,1,100,4.8,4,'mobile')",[phone,'okada_rider']);}
const request=await createEconomicRequest({id:'dispatch-test-request',phone:customer,skill:'ride_request',requirements:{origin:'Ikeja',destination:'Yaba',vehicle_type:'bike'}});
assert.equal(request.skill,'ride_request');
const broadcast=await broadcastDispatch({requestId:request.id,ownerPhone:customer,skill:'ride_request',vehicleType:'bike',location:'Ikeja',maxProviders:5});
assert.equal(broadcast.offers.length,2,'dispatch should broadcast to multiple matching providers');
const first=broadcast.offers[0];const before=await getPointsBalance(first.providerPhone);
const accepted=await acceptDispatchLead({leadId:first.id,providerPhone:first.providerPhone});
assert.equal(accepted.status,'accepted');
assert.ok(accepted.leadPoints>0,'acceptance must charge the configured provider lead');
assert.equal(await getPointsBalance(first.providerPhone),before-accepted.leadPoints,'lead charge must deduct Points at acceptance');
const session=await getProviderCommunicationSession(String(accepted.communicationSessionId));
assert.ok(session?.id,'acceptance creates one shared provider communication session');
assert.equal(session?.mode,'webrtc_tracking','WebRTC/tracking is the default; PSTN masking is not required');
assert.ok(session?.roomId,'WebRTC-enabled dispatch creates a shared room');
assert.deepEqual(new Set(getRoomPeers(String(session?.roomId))),new Set([customer,first.providerPhone]),'both rider and customer must join the shared WebRTC room');
const arrived=await markDispatchArrived({leadId:first.id,providerPhone:first.providerPhone});
assert.equal(arrived.status,'arrived');
const arrivedSession=await getProviderCommunicationSession(String(accepted.communicationSessionId));
assert.equal(arrivedSession?.state,'arrived','arrival updates the shared communication session');
const completed=await completeDispatch({leadId:first.id,providerPhone:first.providerPhone,evidence:{pickup_confirmed:true,dropoff_confirmed:true}});
assert.equal(completed.status,'completed');
const after=await getProviderCommunicationSession(String(accepted.communicationSessionId));
assert.equal(after?.state,'completed','completion closes the shared communication session');
const review=await createServiceReview({requestId:request.id,reviewerPhone:customer,providerPhone:first.providerPhone,rating:5,feedback:'Good trip'});
assert.equal(review.rating,5);
const skills=db.exec('SELECT rating,jobs_completed,is_available FROM skills WHERE phone=? AND skill=?',[first.providerPhone,'okada_rider']);
assert.equal(Number(skills[0].values[0][1]),5,'completion increments provider completed jobs');
assert.equal(Number(skills[0].values[0][2]),1,'provider becomes available again after completion/review');
console.log(JSON.stringify({passed:true,offers:broadcast.offers.length,acceptedProvider:first.providerPhone,leadPoints:accepted.leadPoints,communicationMode:session?.mode,roomPeers:getRoomPeers(String(session?.roomId)),arrivalState:arrivedSession?.state,completionState:after?.state,reviewRating:review.rating},null,2));
