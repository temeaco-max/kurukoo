import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const mode = process.argv[2] || 'write';
const connectionString = String(process.env.KURUKOO_TEST_POSTGRES_URL || '').trim();
if (!connectionString) throw new Error('KURUKOO_TEST_POSTGRES_URL is required.');
process.env.KURUKOO_DATABASE_MODE='postgres';
process.env.DATABASE_URL=connectionString;
process.env.KURUKOO_POSTGRES_SSL=String(process.env.KURUKOO_POSTGRES_SSL || 'false');
process.env.NODE_ENV='test';
process.env.JWT_SECRET=process.env.JWT_SECRET||'domain-restart-test-secret-01234567890123456789';process.env.KURUKOO_AGENT_ENABLED='true';

const ownerA='+2348000000811';
const ownerB='+2348000000822';
const orderId=`restart-order-${crypto.randomUUID()}`;

const { getCanonicalStore, closeCanonicalStore } = await import('../src/services/canonicalStore.js');
const { updateProfile, getProfile } = await import('../src/services/memoryProfile.js');
const { createEconomicRequest, getEconomicRequest } = await import('../src/services/economicRequestPersistence.js');
const { createConversationGoal, getAgentGoal, listAgentGoalEvents, ensureAgentRuntimeSchema } = await import('../src/services/agentRuntime.js');
const { sendFcmPush, getInternalNotifications } = await import('../src/services/pushNotifications.js');
const { createReminder, getReminderForPhone } = await import('../src/services/reminderService.js');

const childEnv = { ...process.env, KURUKOO_TEST_POSTGRES_URL: connectionString };

try {
  if (mode === 'write') {
    const store = await getCanonicalStore();
    await ensureAgentRuntimeSchema();
    await store.run(`CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,phone TEXT,order_type TEXT,provider_phone TEXT,amount BIGINT,status TEXT,idempotency_key TEXT UNIQUE,created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,message TEXT,updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
    await store.run(`CREATE TABLE IF NOT EXISTS postgres_restart_probe(id TEXT PRIMARY KEY,owner_phone TEXT NOT NULL,order_id TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
    await store.run('DELETE FROM postgres_restart_probe WHERE id=?',['domain-restart']);

    await updateProfile(ownerA,'postgresDomainRestart',{name:'Restart Owner A',location:'Lagos',country:'ng',preferences:{restart_probe:true}});
    await updateProfile(ownerB,'postgresDomainRestart',{name:'Restart Owner B',location:'Abuja',country:'ng',preferences:{restart_probe:true}});

    const economicRequest = await createEconomicRequest({ id:`restart-erq-${crypto.randomUUID()}`, phone:ownerA, skill:'plumber', requirements:{restartProbe:true} });
    const goal = await createConversationGoal({ phone:ownerA, skill:'reminder', objective:'PostgreSQL restart proof goal', source:'conversation' });
    await sendFcmPush(ownerA,'Restart proof','Persistent notification state',undefined,{ contextId:'postgres-restart', objectType:'restart_probe', objectId:'domain-restart', ownerScope:ownerA, idempotencyKey:'postgres-restart-notification', surface:'chat' });
    const reminder = await createReminder(ownerA,{title:'PostgreSQL restart proof reminder',dueAt:new Date(Date.now()+7200000).toISOString()});
    await store.run(`INSERT INTO orders(id,phone,order_type,provider_phone,amount,status,idempotency_key) VALUES(?,?,?,?,?,?,?)`,[orderId,ownerA,'restart-proof',ownerA,1,'created',`restart-order:${orderId}`]);
    await store.run(`INSERT INTO postgres_restart_probe(id,owner_phone,order_id) VALUES(?,?,?)`,['domain-restart',ownerA,orderId]);

    await store.close();
    const child = spawnSync(process.execPath,['--import','tsx',fileURLToPath(import.meta.url),'read'],{env:childEnv,stdio:'inherit'});
    if (child.status!==0) throw new Error(`PostgreSQL domain restart reader exited with ${child.status}`);
    console.log(JSON.stringify({processA:'verified-write',processB:'verified-read',economicRequestId:economicRequest.id,agentGoalId:goal.id,reminderId:reminder.id,orderId},null,2));
    process.exit(0);
  }

  const store = await getCanonicalStore();
  const profileA = await getProfile(ownerA,'postgresDomainRestartReader');
  const profileB = await getProfile(ownerB,'postgresDomainRestartReader');
  assert.equal(profileA?.name,'Restart Owner A');
  assert.equal(profileB?.name,'Restart Owner B');

  const probe = await store.one<any>('SELECT * FROM postgres_restart_probe WHERE id=? AND owner_phone=? LIMIT 1',['domain-restart',ownerA]);
  assert.ok(probe);
  const order = await store.one<any>('SELECT * FROM orders WHERE id=? AND phone=? LIMIT 1',[String(probe.order_id),ownerA]);
  assert.ok(order);
  assert.equal(await store.one<any>('SELECT id FROM orders WHERE id=? AND phone=? LIMIT 1',[String(probe.order_id),ownerB]),undefined);

  const requestRow = await store.one<any>('SELECT id,phone,status FROM economic_requests WHERE phone=? ORDER BY created_at DESC LIMIT 1',[ownerA]);
  assert.ok(requestRow?.id);
  assert.equal(requestRow.phone,ownerA);
  assert.equal(await store.one<any>('SELECT id FROM economic_requests WHERE id=? AND phone=? LIMIT 1',[String(requestRow.id),ownerB]),undefined);
  const request = await getEconomicRequest(String(requestRow.id));
  assert.equal(request?.phone,ownerA);

  const goalRow = await store.one<any>('SELECT id FROM agent_goals WHERE phone=? ORDER BY created_at DESC LIMIT 1',[ownerA]);
  assert.ok(goalRow?.id);
  assert.ok(await getAgentGoal(ownerA,String(goalRow.id)));
  assert.equal(await getAgentGoal(ownerB,String(goalRow.id)),null);
  assert.equal(Array.isArray(await listAgentGoalEvents(ownerA,String(goalRow.id))),true);
  assert.equal((await listAgentGoalEvents(ownerB,String(goalRow.id))).length,0);

  const notifications = await getInternalNotifications(ownerA,20);
  assert.ok(notifications.some(item=>item.id>0 && item.owner_scope===ownerA));
  const notificationIds = notifications.filter(item=>item.owner_scope===ownerA).map(item=>item.id);
  for(const id of notificationIds){
    const row = await store.one<any>('SELECT id FROM internal_notifications WHERE id=? AND phone=? LIMIT 1',[id,ownerB]);
    assert.equal(row,undefined);
  }

  const reminderRow = await store.one<any>('SELECT id FROM reminders WHERE phone=? ORDER BY created_at DESC LIMIT 1',[ownerA]);
  assert.ok(reminderRow?.id);
  assert.ok(await getReminderForPhone(ownerA,String(reminderRow.id)));
  assert.equal(await store.one<any>('SELECT id FROM reminders WHERE id=? AND phone=? LIMIT 1',[String(reminderRow.id),ownerB]),undefined);

  await closeCanonicalStore();
  console.log('PostgreSQL domain restart: VERIFIED — process A wrote Memory/profile, Economic Request, Agent Goal/Event, notification, reminder and order state; process B reopened the same PostgreSQL database and recovered it with owner isolation.');
} catch (error) {
  console.error(error);
  process.exitCode=1;
} finally {
  await closeCanonicalStore();
}
