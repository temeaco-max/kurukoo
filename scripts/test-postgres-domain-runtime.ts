/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-postgres-domain-runtime-${process.pid}-${Date.now()}.sqlite`;

const connectionString = String(process.env.KURUKOO_TEST_POSTGRES_URL || '').trim();
if (!connectionString) {
  console.log('PostgreSQL domain runtime: BLOCKED_EXTERNAL — set KURUKOO_TEST_POSTGRES_URL to a disposable local PostgreSQL database.');
  process.exit(0);
}

process.env.KURUKOO_DATABASE_MODE = 'postgres';
process.env.DATABASE_URL = connectionString;
process.env.KURUKOO_POSTGRES_SSL = String(process.env.KURUKOO_POSTGRES_SSL || 'false');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'domain-runtime-test-secret-01234567890123456789';
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.CREDIT_ECONOMY_ENABLED = 'true';

const ownerA = '+2348000000711';
const ownerB = '+2348000000722';
const conversationId = `pg-domain-conv-${crypto.randomUUID()}`;
const requestId = `pg-domain-erq-${crypto.randomUUID()}`;
const orderId = `pg-domain-order-${crypto.randomUUID()}`;
const markerId = `pg-domain-marker-${crypto.randomUUID()}`;
const { getCanonicalStore, closeCanonicalStore } = await import('../src/services/canonicalStore.js');
const { ensureMemoryProfileSchema, ensureOrderSchema, ensureProfileAccessLogSchema } = await import('../src/services/canonicalDomainSchemas.js');
const { updateProfile, getProfile } = await import('../src/services/memoryProfile.js');
const { createEconomicRequest, getEconomicRequest, updateEconomicRequestRequirements, transitionEconomicRequest } = await import('../src/services/economicRequestPersistence.js');
const { ensureAgentRuntimeSchema, createConversationGoal, getAgentGoal, listAgentGoalEvents } = await import('../src/services/agentRuntime.js');
const { attachAgentGoalDependency } = await import('../src/services/agentEconomicRequestOrchestrator.js');
const { sendFcmPush, getInternalNotifications } = await import('../src/services/pushNotifications.js');
const { createReminder, getReminderForPhone, cancelReminder } = await import('../src/services/reminderService.js');

async function run() {
  const store = await getCanonicalStore();
  await ensureMemoryProfileSchema();
  await ensureOrderSchema();
  await ensureProfileAccessLogSchema();
  await ensureAgentRuntimeSchema();

  // ---- Memory / profile persistence + owner scoping ----
  await updateProfile(ownerA, 'postgresDomainRuntime', { name: 'Runtime Owner A', location: 'Lagos', country: 'ng', preferences: { preferred_channel: 'web' } });
  await updateProfile(ownerB, 'postgresDomainRuntime', { name: 'Runtime Owner B', location: 'Abuja', country: 'ng', preferences: { preferred_channel: 'web' } });
  const profileA = await getProfile(ownerA, 'postgresDomainRuntimeReader');
  assert.equal(profileA?.name, 'Runtime Owner A', 'Memory profile A must persist through PostgreSQL');
  assert.equal((await getProfile(ownerB, 'postgresDomainRuntimeReader'))?.name, 'Runtime Owner B', 'Memory profile B must persist through PostgreSQL');

  // ---- Economic Request: create, update, transition ----
  await createEconomicRequest({ id: requestId, phone: ownerA, skill: 'plumber', requirements: { urgency: 'today' } });
  assert.equal((await getEconomicRequest(requestId))?.phone, ownerA);
  await updateEconomicRequestRequirements(requestId, ownerA, { location: 'Ikeja' });
  const requirements = JSON.parse(String((await store.one<any>('SELECT requirements_json FROM economic_requests WHERE id = ?', [requestId]))?.requirements_json || '{}'));
  assert.equal(requirements.location, 'Ikeja', 'requirements patch must merge through PostgreSQL');
  await transitionEconomicRequest(requestId, 'awaiting_match');
  assert.equal((await getEconomicRequest(requestId))?.status, 'awaiting_match', 'economic request transition must persist through PostgreSQL');

  // ---- Economic Request owner isolation ----
  assert.equal(await store.one<any>('SELECT id FROM economic_requests WHERE id = ? AND phone = ?', [requestId, ownerB]), undefined, 'Owner B must not inspect Owner A request');

  // ---- Economic Request creation idempotency (no duplicate durable effect) ----
  let duplicateAttempt = false;
  try { await createEconomicRequest({ id: requestId, phone: ownerA, skill: 'plumber', requirements: { urgency: 'today' } }); } catch { duplicateAttempt = true; }
  assert.ok(duplicateAttempt, 'duplicate economic request id must be rejected as idempotent');
  assert.equal(Number((await store.one<any>('SELECT COUNT(*) AS count FROM economic_requests WHERE id = ?', [requestId]))?.count || 0), 1, 'no duplicate economic request durable effect');

  // ---- Agent Goal + events ----
  const goal = await createConversationGoal({ phone: ownerA, conversationId, skill: 'reminder', objective: 'PostgreSQL domain runtime goal', source: 'conversation' });
  assert.ok(goal?.id, 'Agent Goal must be created through PostgreSQL');
  assert.ok((await getAgentGoal(ownerA, goal.id)), 'Agent Goal must be readable by its owner');
  assert.equal(await getAgentGoal(ownerB, goal.id), null, 'Owner B must not read Owner A goal (getAgentGoal is owner-scoped)');
  assert.equal((await listAgentGoalEvents(ownerB, goal.id)).length, 0, 'Owner B must not observe Owner A goal events');

  // ---- Owner B cannot attach a dependency to Owner A's goal ----
  await assert.rejects(
    () => attachAgentGoalDependency({ phone: ownerB, parentGoalId: goal.id, skill: 'electrician', purpose: 'subtask' }),
    /ownership is required/i,
    'Owner B must not attach a dependency to Owner A Agent Goal',
  );

  // ---- Agent Goal creation idempotency (same conversation/skill returns prior, one row) ----
  const secondGoal = await createConversationGoal({ phone: ownerA, conversationId, skill: 'reminder', objective: 'PostgreSQL domain runtime goal', source: 'conversation' });
  assert.equal(secondGoal?.id, goal.id, 'repeated identical goal creation must be idempotent');
  assert.equal(Number((await store.one<any>('SELECT COUNT(*) AS count FROM agent_goals WHERE phone = ? AND conversation_id = ? AND goal_type = ?', [ownerA, conversationId, 'reminder']))?.count || 0), 1, 'no duplicate Agent Goal durable effect');
  assert.ok((await listAgentGoalEvents(ownerA, goal.id)).length >= 1, 'goal_created event must persist through PostgreSQL');

  // ---- Notification idempotency + owner scoping ----
  await sendFcmPush(ownerA, 'Domain runtime notification', 'Persisted without an FCM provider.', '/chat', { ownerScope: ownerA, idempotencyKey: 'pg-domain-notification', surface: 'chat' });
  const second = await sendFcmPush(ownerA, 'Domain runtime notification', 'Persisted without an FCM provider.', '/chat', { ownerScope: ownerA, idempotencyKey: 'pg-domain-notification', surface: 'chat' });
  assert.equal(second, false, 'duplicate identical notification must be suppressed');
  assert.equal(Number((await store.one<any>('SELECT COUNT(*) AS count FROM internal_notifications WHERE phone = ? AND title = ? AND body = ?', [ownerA, 'Domain runtime notification', 'Persisted without an FCM provider.']))?.count || 0), 1, 'no duplicate notification durable effect');
  const noteA = await getInternalNotifications(ownerA, 20);
  assert.ok(noteA.some((n: any) => n.owner_scope === ownerA && n.title === 'Domain runtime notification'), 'Owner A must observe its notification through PostgreSQL');
  assert.equal((await getInternalNotifications(ownerB, 20)).some((n: any) => n.owner_scope === ownerA), false, 'Owner B must not observe Owner A notification');

  // ---- Reminder: create, owner-scoped read, owner-scoped cancel ----
  const reminder = await createReminder(ownerA, { title: 'Domain runtime reminder', dueAt: new Date(Date.now() + 7200000).toISOString() });
  assert.equal((await getReminderForPhone(ownerA, reminder.id))?.title, 'Domain runtime reminder');
  assert.equal(await getReminderForPhone(ownerB, reminder.id), null, 'Owner B must not read Owner A reminder');
  assert.equal(await cancelReminder(ownerB, reminder.id), false, 'Owner B must not cancel Owner A reminder');
  assert.equal(await cancelReminder(ownerA, reminder.id), true, 'Owner A must cancel its own reminder');
  assert.equal(Number((await store.one<any>("SELECT COUNT(*) AS count FROM reminders WHERE id = ? AND status = 'cancelled'", [reminder.id]))?.count || 0), 1, 'reminder cancel must persist as a single durable state');

  // ---- Order: owner isolation + idempotency ----
  await store.run(`INSERT INTO orders(id, phone, order_type, provider_phone, amount, status, idempotency_key) VALUES(?,?,?,?,?,?,?)`, [orderId, ownerA, 'domain-runtime', ownerA, 1, 'created', `order:${orderId}`]);
  assert.ok(await store.one<any>('SELECT id FROM orders WHERE id = ? AND phone = ?', [orderId, ownerA]));
  assert.equal(await store.one<any>('SELECT id FROM orders WHERE id = ? AND phone = ?', [orderId, ownerB]), undefined, 'Owner B must not read Owner A order');
  let orderDuplicate = false;
  try { await store.run(`INSERT INTO orders(id, phone, order_type, provider_phone, amount, status, idempotency_key) VALUES(?,?,?,?,?,?,?)`, [orderId, ownerA, 'domain-runtime', ownerA, 1, 'created', `order:${orderId}`]); } catch { orderDuplicate = true; }
  assert.ok(orderDuplicate, 'duplicate order id must be rejected as idempotent');
  assert.equal(Number((await store.one<any>('SELECT COUNT(*) AS count FROM orders WHERE id = ?', [orderId]))?.count || 0), 1, 'no duplicate order durable effect');

  // ---- Transaction rollback ----
  await store.run(`CREATE TABLE IF NOT EXISTS runtime_markers(k TEXT PRIMARY KEY, v TEXT)`);
  await assert.rejects(() => store.transaction(async tx => {
    await tx.run(`INSERT INTO runtime_markers(k, v) VALUES(?, ?)`, [markerId, 'about-to-rollback']);
    throw new Error('intentional rollback');
  }), /intentional rollback/);
  assert.equal(await store.one<any>('SELECT v FROM runtime_markers WHERE k = ?', [markerId]), undefined, 'forced failure must leave no partial durable state');

  // ---- Successful transaction commits the full unit ----
  await store.transaction(async tx => {
    await tx.run(`INSERT INTO runtime_markers(k, v) VALUES(?, ?)`, [markerId, 'committed-a']);
    await tx.run(`UPDATE runtime_markers SET v = ? WHERE k = ?`, ['committed-b', markerId]);
  });
  assert.equal(String((await store.one<any>('SELECT v FROM runtime_markers WHERE k = ?', [markerId]))?.v), 'committed-b', 'successful transaction must commit its entire unit');

  // ---- Reopen boundary: canonical owner persists across a store reopen ----
  await store.close();
  const restarted = await getCanonicalStore();
  assert.ok(await restarted.one<any>('SELECT id FROM orders WHERE id = ? AND phone = ?', [orderId, ownerA]));
  assert.equal((await getEconomicRequest(requestId))?.status, 'awaiting_match');
  assert.ok((await getAgentGoal(ownerA, goal.id)));
  assert.equal((await getReminderForPhone(ownerA, reminder.id))?.status, 'cancelled');

  console.log('PostgreSQL domain runtime: VERIFIED — Memory/profile, Economic Request, Agent Goal + events + dependency ownership, notification, reminder, order, owner isolation, idempotency, transaction/rollback and reopen persistence passed against a real PostgreSQL database.');
}

try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeCanonicalStore();
}
