import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-agent-brief-redteam-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(tempDir, 'redteam.sqlite');
process.env.JWT_SECRET = 'agent-brief-redteam-secret-0123456789';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
process.on('exit', () => { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} });

const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { updateProfile } = await import('../src/services/memoryProfile.js');
const { createEconomicRequest } = await import('../src/services/skillFlows.js');
const { createReminder } = await import('../src/services/reminderService.js');
const { createConversationGoal, getAgentGoal } = await import('../src/services/agentRuntime.js');
const { sendFcmPush } = await import('../src/services/pushNotifications.js');
const { buildAgentBrief, classifyAgentBriefAttention, enqueueAgentBriefNotification, resolveAgentBriefPreferences } = await import('../src/services/agentBriefService.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const chatSurface = fs.readFileSync(path.resolve('public/js/kurukoo-primary-chat.js'), 'utf8');

const ownerA = '+2348091000001';
const ownerB = '+2348091000002';
const token = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
const headers = (phone: string) => ({ Authorization: `Bearer ${token(phone)}` });
const fixedNow = new Date();
const aPreferences = { proactive_brief: { voice_enabled: true, style: 'detailed', interruption_sensitivity: 'standard', allow_critical_interruption: true } };
const bPreferences = { proactive_brief: { voice_enabled: false, style: 'concise', interruption_sensitivity: 'minimal', allow_critical_interruption: false }, sensitive_note: 'B_ONLY_MEMORY_NEVER_SURFACE' };

await updateProfile(ownerA, 'agent-brief-redteam', { name: 'Owner A', preferences: aPreferences });
await updateProfile(ownerB, 'agent-brief-redteam', { name: 'Owner B', preferences: bPreferences });
const requestA = await createEconomicRequest({ id: 'redteam-request-a', phone: ownerA, skill: 'find_worker', requirements: { service: 'repair A', location: 'Ikeja' } });
const requestB = await createEconomicRequest({ id: 'redteam-request-b', phone: ownerB, skill: 'find_worker', requirements: { service: 'repair B', location: 'Yaba' } });
const dueSoon = new Date(fixedNow.getTime() + 60 * 60 * 1000).toISOString();
const reminderA = await createReminder(ownerA, { title: 'Owner A reminder', dueAt: dueSoon });
const reminderB = await createReminder(ownerB, { title: 'Owner B reminder', dueAt: dueSoon });
const goalA = await createConversationGoal({ phone: ownerA, conversationId: 'redteam-conversation-a', skill: 'find_worker', objective: 'Owner A agent goal', economicRequestId: requestA.id, persistWhenDisabled: true });
const goalB = await createConversationGoal({ phone: ownerB, conversationId: 'redteam-conversation-b', skill: 'find_worker', objective: 'Owner B agent goal', economicRequestId: requestB.id, persistWhenDisabled: true });
assert.ok(goalA && goalB, 'Controlled red-team setup must create bounded owner-scoped Agent Runtime goals.');

const db = await getDb();
db.run("UPDATE economic_requests SET status='awaiting_confirmation', updated_at='2026-08-22T11:00:00.000Z' WHERE id=?", [requestA.id]);
db.run("UPDATE economic_requests SET status='awaiting_confirmation', updated_at='2026-08-22T11:00:00.000Z' WHERE id=?", [requestB.id]);
db.run("UPDATE agent_goals SET status='needs_user', summary='Owner-scoped approval is required.', updated_at='2026-08-22T11:00:00.000Z' WHERE id=?", [goalA.id]);
db.run("UPDATE agent_goals SET status='needs_user', summary='Owner B approval is required.', updated_at='2026-08-22T11:00:00.000Z' WHERE id=?", [goalB.id]);
db.run("INSERT INTO micro_tasks(title, description, skill_tag, credits_reward, status, assigned_to, created_at, updated_at) VALUES(?, ?, ?, ?, 'in_progress', ?, '2026-08-22T11:00:00.000Z', '2026-08-22T11:00:00.000Z')", ['Owner A task', 'Owner A only', 'review', 0, ownerA]);
db.run("INSERT INTO micro_tasks(title, description, skill_tag, credits_reward, status, assigned_to, created_at, updated_at) VALUES(?, ?, ?, ?, 'in_progress', ?, '2026-08-22T11:00:00.000Z', '2026-08-22T11:00:00.000Z')", ['Owner B task', 'Owner B only', 'review', 0, ownerB]);
const taskAId = Number(db.exec("SELECT id FROM micro_tasks WHERE title='Owner A task' LIMIT 1")[0]?.values?.[0]?.[0]);
await sendFcmPush(ownerA, 'Safety update', 'Owner A safety information.', '/chat', { canonicalAction: 'safety.alert', objectType: 'safety_event', objectId: 'redteam-safety-a', ownerScope: ownerA });
await sendFcmPush(ownerB, 'Owner B update', 'Owner B notification only.', '/chat', { canonicalAction: 'notification.open', objectType: 'notification', objectId: 'redteam-notification-b', ownerScope: ownerB });
await sendFcmPush(ownerA, 'Provider private message', 'Sensitive provider communication: 0800-PRIVATE and personal details.', '/chat', { canonicalAction: 'provider.message.open', objectType: 'provider_communication', objectId: 'redteam-private-message', ownerScope: ownerA });

const before = {
  request: db.exec('SELECT status FROM economic_requests WHERE id=?', [requestA.id])[0]?.values?.[0]?.[0],
  task: db.exec("SELECT status FROM micro_tasks WHERE title='Owner A task'")[0]?.values?.[0]?.[0],
  reminder: db.exec('SELECT status FROM reminders WHERE id=?', [reminderA.id])[0]?.values?.[0]?.[0],
  goal: (await getAgentGoal(ownerA, goalA.id))?.status,
  memoryFacts: db.exec('SELECT COUNT(*) FROM memory_facts WHERE phone=?', [ownerA])[0]?.values?.[0]?.[0],
  requests: db.exec('SELECT COUNT(*) FROM economic_requests WHERE phone=?', [ownerA])[0]?.values?.[0]?.[0],
};

const briefA = await buildAgentBrief(ownerA, { now: fixedNow });
const repeatedBriefA = await buildAgentBrief(ownerA, { now: fixedNow });
const briefB = await buildAgentBrief(ownerB, { now: fixedNow });
assert.equal(briefA.id, repeatedBriefA.id, 'Repeated read-only aggregation must be deterministic.');
assert.equal(briefA.items.some(item => /owner b|repair b|B_ONLY_MEMORY/i.test(`${item.summary} ${item.stableRef}`)), false, 'Owner A must never receive Owner B requests, tasks, reminders, notifications, Memory data, or Agent state.');
assert.equal(briefB.items.some(item => /owner a|repair a/i.test(`${item.summary} ${item.stableRef}`)), false, 'Owner B must never receive Owner A canonical state.');
assert.equal(briefA.items.some(item => /Sensitive provider communication|0800-PRIVATE|personal details/i.test(item.summary)), false, 'Sensitive provider communication must be filtered before server-side brief presentation.');
assert.equal(briefA.presentation.text.includes('B_ONLY_MEMORY_NEVER_SURFACE'), false, 'Arbitrary sensitive Memory Profile data must not surface in brief text.');
assert.match(chatSurface, /recoverBriefAction/, 'Persisted Agent Brief cards must recover registered actions from stable canonical references.');
assert.match(chatSurface, /economic_request\.open[\s\S]*task\.open[\s\S]*reminder\.open[\s\S]*agent\.goal\.review[\s\S]*notification\.open/, 'Legacy brief action recovery must remain limited to registered canonical read-only continuations.');
assert.match(chatSurface, /Open this \$\{target\}\./, 'Exact-item continuation should use a concise user-facing prompt without duplicating action labels.');
const continuationExpectations = [
  { stableRef: `economic_request:${requestA.id}`, canonicalAction: 'economic_request.open', objectType: 'economic_request', objectId: requestA.id },
  { stableRef: `reminder:${reminderA.id}`, canonicalAction: 'reminder.open', objectType: 'reminder', objectId: reminderA.id },
  { stableRef: `task:${taskAId}`, canonicalAction: 'task.open', objectType: 'task', objectId: String(taskAId) },
  { stableRef: `agent_goal:${goalA.id}`, canonicalAction: 'agent.goal.review', objectType: 'agent_goal', objectId: goalA.id },
  { stableRef: 'notification:', canonicalAction: 'notification.open', objectType: 'notification' },
];
for (const expected of continuationExpectations) {
  const item = briefA.items.find(candidate => expected.stableRef.endsWith(':') ? candidate.stableRef.startsWith(expected.stableRef) : candidate.stableRef === expected.stableRef);
  assert.ok(item?.action, `The ${expected.objectType} brief item must carry an exact canonical action.`);
  assert.equal(item.action?.canonicalAction, expected.canonicalAction, `The ${expected.objectType} item must use its registered canonical action.`);
  assert.equal(item.action?.objectType, expected.objectType, `The ${expected.objectType} item must preserve its canonical object type.`);
  if (expected.objectId) assert.equal(item.action?.objectId, expected.objectId, `The ${expected.objectType} item must preserve its exact canonical object identity.`);
  const continuation = await processCanonicalChatTurn({ phone: ownerA, message: 'Open this exact update.', channel: 'web', conversationId: 'redteam-conversation-a', contextAction: { type: 'resume_canonical_context', contextId: `redteam:${item.stableRef}`, canonicalAction: item.action!.canonicalAction, objectType: item.action!.objectType, objectId: item.action!.objectId } });
  assert.equal(continuation.cardData?.type, 'canonical_context', `The ${expected.objectType} action must reopen its exact existing canonical context.`);
  assert.equal(continuation.cardData?.objectType, expected.objectType, `The ${expected.objectType} continuation must retain its type.`);
}
const foreignRequestItem = briefA.items.find(item => item.stableRef === `economic_request:${requestA.id}`)!;
const foreignContinuation = await processCanonicalChatTurn({ phone: ownerB, message: 'Open this exact update.', channel: 'web', contextAction: { type: 'resume_canonical_context', contextId: `redteam:${foreignRequestItem.stableRef}`, canonicalAction: foreignRequestItem.action!.canonicalAction, objectType: foreignRequestItem.action!.objectType, objectId: foreignRequestItem.action!.objectId } });
assert.equal(foreignContinuation.cardData?.type, 'canonical_context_unavailable', 'Another owner must not reopen an Agent Brief item context.');
assert.equal(briefB.presentation.shouldSpeak, false, 'Owner B disabled proactive voice must suppress speech.');
assert.equal(briefA.presentation.shouldSpeak, true, 'Owner A permitted proactive voice should remain available for safe visible items.');
assert.equal((await getAgentGoal(ownerA, goalA.id))?.status, before.goal, 'Brief generation must not execute or mutate Agent Runtime state.');
assert.equal(db.exec('SELECT status FROM economic_requests WHERE id=?', [requestA.id])[0]?.values?.[0]?.[0], before.request, 'Brief generation must not accept or mutate a request.');
assert.equal(db.exec("SELECT status FROM micro_tasks WHERE title='Owner A task'")[0]?.values?.[0]?.[0], before.task, 'Brief generation must not complete or mutate a task.');
assert.equal(db.exec('SELECT status FROM reminders WHERE id=?', [reminderA.id])[0]?.values?.[0]?.[0], before.reminder, 'Brief generation must not mutate a reminder.');
assert.equal(db.exec('SELECT COUNT(*) FROM memory_facts WHERE phone=?', [ownerA])[0]?.values?.[0]?.[0], before.memoryFacts, 'Brief generation must not create Memory entries.');
assert.equal(db.exec('SELECT COUNT(*) FROM economic_requests WHERE phone=?', [ownerA])[0]?.values?.[0]?.[0], before.requests, 'Brief generation must not create Economic Requests.');

const policy = resolveAgentBriefPreferences(aPreferences);
assert.equal(classifyAgentBriefAttention({ stableRef: 'attention:immediate', category: 'safety_event', priority: 'critical', urgency: 'critical', source: 'notification', summary: 'Safety', approvalRequired: false, visibility: 'private' }, policy), 'IMMEDIATE', 'Safety must classify as IMMEDIATE only through existing policy.');
assert.equal(classifyAgentBriefAttention({ stableRef: 'attention:notify', category: 'attention_required', priority: 'high', urgency: 'time_sensitive', source: 'request', summary: 'Review', approvalRequired: true, visibility: 'private' }, policy), 'NOTIFY', 'High approval-bound state must classify as NOTIFY.');
assert.equal(classifyAgentBriefAttention({ stableRef: 'attention:next', category: 'pending', priority: 'normal', urgency: 'none', source: 'task', summary: 'Later', approvalRequired: false, visibility: 'private' }, policy), 'NEXT_BRIEF', 'Normal pending work must classify as NEXT_BRIEF.');
assert.equal(classifyAgentBriefAttention({ stableRef: 'attention:silent', category: 'pending', priority: 'normal', urgency: 'none', source: 'task', summary: 'Restricted', approvalRequired: false, visibility: 'restricted' }, policy), 'SILENT', 'Restricted state must be silent before presentation.');
const quietNoInterrupt = resolveAgentBriefPreferences({ proactive_brief: { voice_enabled: true, quiet_hours: { start: '00:00', end: '23:59', timeZone: 'UTC' }, allow_critical_interruption: false } });
assert.equal((await buildAgentBrief(ownerA, { now: fixedNow, preferences: quietNoInterrupt })).presentation.shouldSpeak, false, 'Quiet hours must suppress proactive speech when critical interruption is not allowed.');
const firstDelivery = await enqueueAgentBriefNotification(ownerA, briefA);
const duplicateDelivery = await enqueueAgentBriefNotification(ownerA, repeatedBriefA);
assert.equal(firstDelivery.queued, true, 'Existing notification fallback should queue once for attention-worthy state.');
assert.equal(duplicateDelivery.duplicate, true, 'Repeated brief delivery must not create duplicate notifications.');

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
try {
  const chatAsset = await fetch(`${baseUrl}/js/kurukoo-primary-chat.js?v=21`);
  assert.equal(chatAsset.headers.get('cache-control'), 'no-cache, must-revalidate', 'Mutable Chat runtime assets must require browser revalidation after deployment.');
  const chatPage = await fetch(`${baseUrl}/chat/`);
  assert.match(await chatPage.text(), /kurukoo-primary-chat\.js\?v=21/, 'The served Chat page must point to the current Agent Brief client version.');
  const serviceWorker = await fetch(`${baseUrl}/sw.js`);
  assert.match(await serviceWorker.text(), /kurukoo-primary-chat\.js\?v=21/, 'The offline shell must point to the current Agent Brief client version.');
  const guest = await fetch(`${baseUrl}/api/agent/brief`);
  assert.equal(guest.status, 401, 'Guests must receive only non-authenticated behavior from the brief route.');
  const responseA = await fetch(`${baseUrl}/api/agent/brief`, { headers: headers(ownerA) });
  const payloadA = await responseA.json() as { success?: boolean; brief?: { ownerPhone?: string; items?: Array<{ summary: string; stableRef: string }> } };
  assert.equal(responseA.status, 200, 'Authenticated Owner A must receive their own brief.');
  assert.equal(payloadA.brief?.ownerPhone, undefined, 'The server route must not expose owner phone in public brief payloads.');
  assert.equal(payloadA.brief?.items?.some(item => /owner b|repair b/i.test(`${item.summary} ${item.stableRef}`)), false, 'HTTP brief projection must remain owner-scoped.');
  const responseB = await fetch(`${baseUrl}/api/agent/brief`, { headers: headers(ownerB) });
  const payloadB = await responseB.json() as { brief?: { items?: Array<{ summary: string; stableRef: string }> } };
  assert.equal(responseB.status, 200, 'Authenticated Owner B must receive their own brief.');
  assert.equal(payloadB.brief?.items?.some(item => /owner a|repair a/i.test(`${item.summary} ${item.stableRef}`)), false, 'HTTP cross-user contamination must fail closed.');
} finally {
  server.close();
}

console.log('Agent Brief independent red-team passed: canonical-only aggregation, owner scope, guest denial, pre-presentation privacy filtering, all attention states, quiet-hours/voice controls, duplicate suppression, and non-mutating autonomy boundaries.');
