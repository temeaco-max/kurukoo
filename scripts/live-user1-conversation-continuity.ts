/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.ACCEPTANCE_BASE_URL || 'http://127.0.0.1:3210';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'acceptance-admin-password';
const evidencePath = process.env.ACCEPTANCE_CONTINUITY_EVIDENCE || '/tmp/kurukoo-user1-conversation-continuity.json';

function cookieOf(response: Response): string { return String(response.headers.get('set-cookie') || '').split(';')[0]; }
async function json(response: Response): Promise<any> { return response.json().catch(() => ({})); }
function parseSse(text: string): any[] { return text.split(/\n\n+/).map(block => block.trim()).filter(Boolean).map(block => { const raw = block.startsWith('data: ') ? block.slice(6) : block; try { return JSON.parse(raw); } catch { return { raw }; } }); }

async function get(path: string, cookie: string): Promise<{ status: number; data: any }> {
  const response = await fetch(`${base}${path}`, { headers: { cookie } });
  return { status: response.status, data: await json(response) };
}

const login = await fetch(`${base}/api/admin/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: adminUsername, password: adminPassword }) });
assert.equal(login.status, 200, 'admin login failed');
const loginData = await json(login);
assert.ok(loginData.token, 'admin token missing');
const adminToken = String(loginData.token);
const launch = await fetch(`${base}/api/admin/operator/chat`, { headers: { 'x-admin-token': adminToken } });
assert.equal(launch.status, 200, 'User #1 Chat launch failed');
const userCookie = cookieOf(launch);
assert.match(userCookie, /^kurukoo_auth=/, 'operator launch did not issue user session');

const me = await get('/api/auth/me', userCookie);
assert.equal(me.status, 200);
assert.equal(me.data.sessionContext?.operator, true);
assert.equal(me.data.sessionContext?.actorRole, 'super_admin');

const campaign = [
  { stage: 'conversation', message: 'Hello Kurukoo. I am Amina and I prefer short, practical answers.' },
  { stage: 'memory', message: 'Remember that my usual area is Ikeja and I prefer short answers.' },
  { stage: 'memory', message: 'What do you remember about my preferences and area?' },
  { stage: 'native_assistance', message: 'I need help deciding what to do about a leaking bathroom pipe.' },
  { stage: 'skill', message: 'It is worse when I use the shower, and I need a plumber in Ikeja.' },
  { stage: 'economic_request', message: 'Please find a plumber for Saturday morning; my budget is about 25000 naira.' },
  { stage: 'correction', message: 'Actually Sunday afternoon is better, and the budget can be 30000.' },
  { stage: 'provider_network', message: 'Use only a provider with a current verified capability and do not invent availability, price, or reviews.' },
  { stage: 'deferred', message: 'If no suitable plumber is available, keep this request open and tell me what is waiting.' },
  { stage: 'agent', message: 'Keep checking for a suitable plumber and notify me if availability changes.' },
  { stage: 'agent_control', message: 'Pause that follow-up, then tell me what is paused.' },
  { stage: 'agent_control', message: 'Resume the follow-up, but do not contact anyone or spend money without my confirmation.' },
  { stage: 'notification', message: 'What notifications or follow-up updates are waiting for me?' },
  { stage: 'reminder', message: 'Remind me tomorrow at 9am to check the plumber request.' },
  { stage: 'continuation', message: 'Continue from where we left off. What is the current state of my plumber request and reminder?' },
  { stage: 'truth_check', message: 'Which parts are confirmed, which are waiting, and which still need an external provider?' },
];

let conversationId = '';
const turns: any[] = [];
for (const item of campaign) {
  const started = Date.now();
  const response = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { cookie: userCookie, 'content-type': 'application/json' }, body: JSON.stringify({ message: item.message, channel: 'web', ...(conversationId ? { conversationId } : {}) }) });
  const events = parseSse(await response.text());
  const conversation = events.find(event => event?.type === 'conversation');
  const done = events.find(event => event?.type === 'done');
  if (conversation?.conversationId) conversationId = conversation.conversationId;
  const diagnostics = done?.diagnostics || null;
  const cardData = done?.cardData || null;
  const [notifications, reminders, goals, requestCategories] = await Promise.all([
    get('/api/notifications', userCookie),
    get('/api/reminders', userCookie),
    get('/api/agent/goals', userCookie),
    get('/api/chat/economic-requests/categories', userCookie),
  ]);
  turns.push({
    stage: item.stage,
    message: item.message,
    status: response.status,
    elapsedMs: Date.now() - started,
    conversationId,
    reply: done?.fullReply || events.filter(event => event?.type === 'text').map(event => event.content || '').join(''),
    cardData,
    diagnostics,
    progress: events.filter(event => event?.type === 'progress'),
    state: {
      notifications: notifications.status === 200 ? notifications.data : { status: notifications.status },
      reminders: reminders.status === 200 ? reminders.data : { status: reminders.status },
      goals: goals.status === 200 ? goals.data : { status: goals.status },
      requestCategories: requestCategories.status === 200 ? requestCategories.data : { status: requestCategories.status },
    },
    telemetry: {
      classificationSource: diagnostics?.classificationSource || null,
      intent: diagnostics?.intent || diagnostics?.intentClass || null,
      provider: diagnostics?.modelProvider || diagnostics?.provider || null,
      model: diagnostics?.model || null,
      latencyMs: diagnostics?.latencyMs ?? null,
      action: diagnostics?.canonicalAction || diagnostics?.action || null,
      finalState: cardData?.status || cardData?.state || diagnostics?.finalState || null,
    },
  });
  assert.equal(response.status, 200, `${item.stage}: Chat failed for ${item.message}`);
  assert.ok(conversationId, `${item.stage}: conversation continuity id missing`);
}

const history = await get(`/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=200`, userCookie);
assert.equal(history.status, 200, 'conversation history failed');
assert.ok((history.data.messages || []).length >= campaign.length * 2, 'not every turn persisted both sides of the conversation');

const joined = turns.map(turn => `${turn.reply}\n${JSON.stringify(turn.cardData)}\n${JSON.stringify(turn.diagnostics)}`).join('\n');
assert.match(joined, /remember|memory|preference|area|Ikeja/i, 'memory stage produced no evidence');
assert.match(joined, /plumber|request|provider|availability/i, 'skill/request stage produced no evidence');
assert.match(joined, /pause|resume|follow-up|agent/i, 'agent continuity stage produced no evidence');
assert.match(joined, /remind|reminder/i, 'reminder stage produced no evidence');

const evidence = { base, identity: me.data, conversationId, historyCount: history.data.messages?.length || 0, turns };
await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ conversationId, historyCount: evidence.historyCount, turns: turns.map(turn => ({ stage: turn.stage, intent: turn.telemetry.intent, action: turn.telemetry.action, finalState: turn.telemetry.finalState, provider: turn.telemetry.provider, model: turn.telemetry.model, reply: turn.reply })) }, null, 2));
console.log(`Continuity evidence written to ${evidencePath}`);
