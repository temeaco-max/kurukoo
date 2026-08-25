import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolatedDbPath = path.join(os.tmpdir(), `kurukoo-agent-brief-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = isolatedDbPath;
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
process.on('exit', () => { try { fs.rmSync(isolatedDbPath, { force: true }); } catch {} });

const { updateProfile } = await import('../src/services/memoryProfile.js');
const { createEconomicRequest } = await import('../src/services/skillFlows.js');
const { createReminder } = await import('../src/services/reminderService.js');
const { createConversationGoal, getAgentGoal } = await import('../src/services/agentRuntime.js');
const { sendFcmPush, getInternalNotifications, markNotificationRead } = await import('../src/services/pushNotifications.js');
const { sanitizeProactiveBriefPreferences } = await import('../src/routes/userRoutes.js');
const { getDb } = await import('../src/database.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const {
  buildAgentBrief,
  classifyAgentBriefAttention,
  enqueueAgentBriefNotification,
  formatAgentBrief,
  isAgentBriefQuestion,
  isQuietHoursActive,
  resolveAgentBriefPreferences,
} = await import('../src/services/agentBriefService.js');

const owner = `+234802${String(Date.now()).slice(-7)}`;
const other = `+234803${String(Date.now()).slice(-7)}`;
const basePreferences = {
  proactive_brief: {
    voice_enabled: true,
    style: 'concise',
    interruption_sensitivity: 'standard',
    allow_critical_interruption: true,
  },
};
await updateProfile(owner, 'test-agent-brief', { name: 'Brief Owner', preferences: basePreferences });
await updateProfile(other, 'test-agent-brief', { name: 'Other Owner', preferences: basePreferences });

const request = await createEconomicRequest({ id: `brief-request-${Date.now()}`, phone: owner, skill: 'find_worker', requirements: { service: 'car repair', location: 'Ikeja' } });
const otherRequest = await createEconomicRequest({ id: `brief-other-request-${Date.now()}`, phone: other, skill: 'find_worker', requirements: { service: 'other repair', location: 'Yaba' } });
const historicRequest = await createEconomicRequest({ id: `brief-historic-request-${Date.now()}`, phone: owner, skill: 'find_worker', requirements: { service: 'historic repair', location: 'Ikeja' } });
const goal = await createConversationGoal({ phone: owner, conversationId: 'brief-conversation', skill: 'find_worker', objective: 'Keep checking the repair request.', economicRequestId: request.id, persistWhenDisabled: true });
assert.ok(goal, 'Agent Brief test setup must create a bounded existing Agent Runtime goal.');
const historicGoal = await createConversationGoal({ phone: owner, conversationId: 'brief-historic-conversation', skill: 'find_worker', objective: 'Historic completed repair goal.', persistWhenDisabled: true });
assert.ok(historicGoal, 'Agent Brief test setup must create a historic Agent Runtime goal.');

const db = await getDb();
db.run(`UPDATE economic_requests SET status='awaiting_confirmation', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [request.id]);
db.run(`UPDATE economic_requests SET status='completed', updated_at='2026-08-01T00:00:00.000Z' WHERE id=?`, [historicRequest.id]);
db.run(`UPDATE agent_goals SET status='needs_user', summary='Your repair request is waiting for your approval.', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [goal.id]);
db.run(`UPDATE agent_goals SET status='completed', completed_at='2026-08-01T00:00:00.000Z', updated_at='2026-08-01T00:00:00.000Z' WHERE id=?`, [historicGoal.id]);
db.run(`INSERT INTO micro_tasks(title, description, skill_tag, credits_reward, status, assigned_to) VALUES(?, ?, ?, ?, 'in_progress', ?)`, ['Review repair options', 'Read-only task context', 'review', 0, owner]);
db.run(`INSERT INTO micro_tasks(title, description, skill_tag, credits_reward, status, assigned_to, created_at, updated_at) VALUES(?, ?, ?, ?, 'completed', ?, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`, ['Historic completed task', 'Must not remain in a current brief', 'review', 0, owner]);
const fixedNow = new Date(Date.now() + 60_000);
const reminder = await createReminder(owner, { title: 'Call the workshop', dueAt: new Date(fixedNow.getTime() + 60 * 60 * 1000).toISOString() });
assert.equal(reminder.status, 'scheduled', 'A canonical reminder should be available to the brief.');
await sendFcmPush(owner, 'Safety update', 'Check your safety plan before continuing.', '/chat', { canonicalAction: 'safety.alert', objectType: 'safety_event', objectId: 'brief-safety', ownerScope: owner });
await sendFcmPush(owner, 'Safety update', 'Check your safety plan before continuing.', '/chat', { canonicalAction: 'safety.alert', objectType: 'safety_event', objectId: 'brief-safety', ownerScope: owner });
await sendFcmPush(other, 'Other user update', 'Must remain private.', '/chat', { canonicalAction: 'notification.open', objectType: 'notification', objectId: 'other-only', ownerScope: other });
await sendFcmPush(owner, 'Kurukoo promotion', 'Sponsored local offer.', '/chat', { canonicalAction: 'notification.open', objectType: 'notification', objectId: 'promotion-only', ownerScope: owner });

const brief = await buildAgentBrief(owner, { now: fixedNow });
const sameBrief = await buildAgentBrief(owner, { now: fixedNow });
assert.equal(brief.id, sameBrief.id, 'Equivalent canonical state must produce an idempotent brief identifier.');
assert.equal(new Set(brief.items.map(item => item.stableRef)).size, brief.items.length, 'Duplicate canonical events must not create duplicate brief items.');
assert.ok(brief.items.some(item => item.stableRef === `economic_request:${request.id}` && item.category === 'waiting_for_user' && item.approvalRequired), 'A request awaiting confirmation must appear as a waiting-for-user item without an auto-action.');
assert.ok(brief.items.some(item => item.stableRef === `agent_goal:${goal.id}` && item.category === 'waiting_for_user'), 'Existing Agent Runtime work must be surfaced through its canonical status.');
assert.ok(brief.items.some(item => item.stableRef === `reminder:${reminder.id}` && item.category === 'upcoming_task'), 'Upcoming canonical reminders must be classified as upcoming tasks.');
assert.ok(brief.items.some(item => item.source === 'task' && item.category === 'pending'), 'Assigned canonical tasks must be included as pending work.');
assert.equal(brief.items.some(item => item.stableRef === `economic_request:${historicRequest.id}`), false, 'Completed requests older than the recent-completion window must not remain in a current brief.');
assert.equal(brief.items.some(item => /Historic completed task/.test(item.summary)), false, 'Completed tasks older than the recent-completion window must not remain in a current brief.');
assert.equal(brief.items.some(item => item.stableRef === `agent_goal:${historicGoal.id}`), false, 'Completed Agent Runtime goals older than the recent-completion window must not remain in a current brief.');
assert.ok(brief.items.some(item => item.category === 'safety_event' && item.attention === 'IMMEDIATE'), 'Safety-relevant notifications must use the deterministic immediate attention policy when critical interruptions are permitted.');
assert.equal(brief.items.some(item => /promotion|sponsored/i.test(item.summary)), false, 'Promotional queue entries must remain silent and cannot compete with user-relevant brief items.');
assert.equal(brief.presentation.shouldSpeak, true, 'Enabled proactive voice with a non-quiet brief must request browser speech presentation.');
assert.match(brief.presentation.text, /Welcome back/i, 'The brief must have deterministic user-facing presentation text.');
assert.match(formatAgentBrief(brief.items, resolveAgentBriefPreferences(basePreferences)), /Would you like me to go through them\?/i, 'Brief wording must retain a natural conversational continuation.');
assert.equal((await getAgentGoal(owner, goal.id))?.status, 'needs_user', 'Building a brief must not bypass the existing user-approval boundary.');

const quietPreferences = resolveAgentBriefPreferences({ proactive_brief: { voice_enabled: true, quiet_hours: { start: '00:00', end: '23:59', timeZone: 'UTC' }, allow_critical_interruption: false } });
assert.equal(isQuietHoursActive(quietPreferences, fixedNow), true, 'Configured quiet hours must be evaluated deterministically.');
const quietBrief = await buildAgentBrief(owner, { now: fixedNow, preferences: quietPreferences });
assert.equal(quietBrief.presentation.shouldSpeak, false, 'Quiet hours must suppress proactive speech when critical interruption permission is disabled.');
const disabledVoiceBrief = await buildAgentBrief(owner, { now: fixedNow, preferences: { proactiveVoiceEnabled: false } });
assert.equal(disabledVoiceBrief.presentation.shouldSpeak, false, 'A disabled proactive-voice preference must retain text-only presentation.');
assert.equal(classifyAgentBriefAttention({ stableRef: 'hidden:test', category: 'pending', priority: 'normal', urgency: 'none', source: 'task', summary: 'Hidden', approvalRequired: false, visibility: 'restricted' }, resolveAgentBriefPreferences(basePreferences)), 'SILENT', 'Restricted items must be filtered before user presentation.');

const otherBrief = await buildAgentBrief(other, { now: fixedNow });
assert.equal(otherBrief.items.some(item => item.stableRef === `economic_request:${request.id}`), false, 'A user must never receive another owner’s request in a brief.');
assert.equal(brief.items.some(item => item.stableRef === `economic_request:${otherRequest.id}`), false, 'Owner filtering must exclude another user’s canonical objects.');
const ownerNotifications = await getInternalNotifications(owner);
assert.ok(ownerNotifications.every(item => !/Other user update/.test(item.title)), 'Notification aggregation must remain owner-scoped.');
const safetyNotification = ownerNotifications.find(item => item.title === 'Safety update');
assert.ok(safetyNotification, 'The canonical notification queue must expose the safety item for the read-state regression.');
assert.equal(await markNotificationRead(owner, safetyNotification.id), true, 'The existing notification owner must mark the safety item as read.');
const afterReadBrief = await buildAgentBrief(owner, { now: fixedNow });
assert.equal(afterReadBrief.items.some(item => item.category === 'safety_event'), false, 'Read notifications must no longer compete for Agent Brief attention.');

const firstDelivery = await enqueueAgentBriefNotification(owner, afterReadBrief);
const duplicateDelivery = await enqueueAgentBriefNotification(owner, afterReadBrief);
assert.equal(firstDelivery.queued, true, 'Attention-worthy briefs must use the canonical notification fallback once.');
assert.equal(duplicateDelivery.duplicate, true, 'Brief notification fallback must be idempotent.');
const rebuiltAfterFallback = await buildAgentBrief(owner, { now: fixedNow });
assert.equal(rebuiltAfterFallback.id, afterReadBrief.id, 'The delivery-only Agent Brief notification must not change deterministic brief material.');
assert.equal(rebuiltAfterFallback.items.some(item => item.action?.canonicalAction === 'agent.brief.review' || item.action?.objectType === 'agent_brief'), false, 'The delivery-only Agent Brief notification must never be re-ingested as brief content.');
const rebuiltDelivery = await enqueueAgentBriefNotification(owner, rebuiltAfterFallback);
assert.equal(rebuiltDelivery.duplicate, true, 'Regenerating after fallback delivery must not recursively enqueue another Agent Brief notification.');
const fallbackNotifications = (await getInternalNotifications(owner)).filter(item => item.canonical_action === 'agent.brief.review');
assert.equal(fallbackNotifications.length, 1, 'The canonical notification centre must contain one idempotent Agent Brief fallback entry.');

assert.equal(isAgentBriefQuestion('Anything important?'), true, 'Natural brief questions must be recognized deterministically.');
const briefTurn = await processCanonicalChatTurn({ phone: owner, message: 'What have I got going on?', channel: 'web', conversationId: 'brief-conversation' });
assert.equal(briefTurn.cardData?.type, 'agent_brief', 'A brief question must stay in the canonical conversation owner and return the structured brief card.');
assert.equal(briefTurn.canonicalAction, 'agent.brief.review', 'A brief response must advertise a read-only review action rather than execute work.');
const continuation = await processCanonicalChatTurn({ phone: owner, message: 'Open that objective', channel: 'web', conversationId: 'brief-conversation', contextAction: { type: 'resume_canonical_context', contextId: `goal:${goal.id}`, conversationId: 'brief-conversation', canonicalAction: 'agent.goal.review', objectType: 'agent_goal', objectId: goal.id } });
assert.match(continuation.reply, /reopened the exact Kurukoo context/i, 'The existing Conversation owner must continue from a brief-referenced Agent Runtime context.');
assert.equal((await getAgentGoal(owner, goal.id))?.status, 'needs_user', 'Conversation continuation from a brief must not change approval-bound work automatically.');

const speechAdapter = fs.readFileSync('public/js/kurukoo-speech-output.js', 'utf8');
const presenceAdapter = fs.readFileSync('public/js/kurukoo-agent-presence.js', 'utf8');
const chatSurface = fs.readFileSync('public/chat/index.html', 'utf8');
assert.match(speechAdapter, /isSupported/, 'Browser speech adapter must expose capability detection for graceful unavailable behavior.');
assert.match(speechAdapter, /SpeechSynthesisUtterance/, 'Browser speech adapter must use zero-cost browser SpeechSynthesis rather than realtime voice.');
assert.match(presenceAdapter, /kurukoo:voice-presence/, 'Agent Presence must reuse existing browser speech presence events.');
assert.match(chatSurface, /kurukoo-speech-output\.js/, 'The existing chat surface must load the browser speech adapter.');
assert.match(chatSurface, /kurukoo-agent-presence\.js/, 'The existing chat surface must load the lightweight shared Agent Presence adapter.');
const sanitizedPreferencePatch = sanitizeProactiveBriefPreferences({ voice_enabled: true, style: 'detailed', interruption_sensitivity: 'minimal', allow_critical_interruption: false, notification_categories: ['safety_event', 'invalid'], quiet_hours: { start: '22:00', end: '07:00', timeZone: 'Africa/Lagos' }, ignored: 'never persisted' });
assert.deepEqual(sanitizedPreferencePatch, { voice_enabled: true, style: 'detailed', interruption_sensitivity: 'minimal', allow_critical_interruption: false, notification_categories: ['safety_event'], quiet_hours: { start: '22:00', end: '07:00', timeZone: 'Africa/Lagos' } }, 'The existing profile route must accept only supported Agent Brief preference fields.');
assert.equal(sanitizeProactiveBriefPreferences('invalid'), null, 'Invalid proactive preference payloads must be rejected at the established profile boundary.');

console.log('Agent Brief regression passed: deterministic aggregation, attention, preferences, privacy, idempotency, notification fallback, browser speech wiring, approval boundary, and canonical conversation continuation.');
