/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.ACCEPTANCE_BASE_URL || 'http://127.0.0.1:3100';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'acceptance-admin-password';
const evidencePath = process.env.ACCEPTANCE_EVIDENCE || '/tmp/kurukoo-user1-chat-quality.json';

function cookieOf(response: Response): string { return String(response.headers.get('set-cookie') || '').split(';')[0]; }
async function json(response: Response): Promise<any> { return response.json().catch(() => ({})); }
function parseSse(text: string): any[] { return text.split(/\n\n+/).map(block => block.trim()).filter(Boolean).map(block => { const raw = block.startsWith('data: ') ? block.slice(6) : block; try { return JSON.parse(raw); } catch { return { raw }; } }); }

async function adminRequest(path: string, method = 'GET', adminCookie = ''): Promise<{ response: Response; data: any }> {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(adminCookie ? { cookie: adminCookie } : {}), 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
  return { response, data: await json(response) };
}

const login = await fetch(`${base}/api/admin/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: adminUsername, password: adminPassword }) });
assert.equal(login.status, 200, `admin login failed: ${login.status}`);
const loginData = await json(login);
assert.ok(loginData.token, 'admin token missing');
const adminCookie = `kurukoo_admin=${encodeURIComponent(loginData.token)}`;

const agentStatus = await fetch(`${base}/api/agent/status`, { headers: { 'x-admin-token': loginData.token } });
assert.equal(agentStatus.status, 200, `agent status unavailable: ${agentStatus.status}`);
const agentStatusData = await json(agentStatus);
assert.equal(agentStatusData.runtime?.enabled, true, 'live-user quality requires KURUKOO_AGENT_ENABLED=true; autonomous execution may remain disabled');

const state = await fetch(`${base}/api/admin/operator/state`, { headers: { 'x-admin-token': loginData.token } });
assert.equal(state.status, 200, `operator state failed: ${state.status}`);
const stateData = await json(state);
assert.equal(stateData.operator?.phone, '+2348000000001');
assert.ok(Array.isArray(stateData.actors) && stateData.actors.length >= 6);

const launch = await fetch(`${base}/api/admin/operator/chat`, { headers: { 'x-admin-token': loginData.token } });
assert.equal(launch.status, 200, `operator Chat launch failed: ${launch.status}`);
const launchData = await json(launch);
const userCookie = cookieOf(launch);
assert.match(userCookie, /^kurukoo_auth=/, 'operator launch did not issue user session');
assert.equal(launchData.session?.operator, true);

const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: userCookie } });
const meData = await json(me);
assert.equal(me.status, 200);
assert.equal(meData.sessionContext?.operator, true);
assert.equal(meData.sessionContext?.actorRole, 'super_admin');

const sessions: Record<string, any> = {};
async function runSession(name: string, messages: string[]) {
  let conversationId = '';
  const turns: any[] = [];
  for (const message of messages) {
    const response = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { cookie: userCookie, 'content-type': 'application/json' }, body: JSON.stringify({ message, channel: 'web', ...(conversationId ? { conversationId } : {}) }) });
    const text = await response.text();
    const events = parseSse(text);
    const conversation = events.find(event => event?.type === 'conversation');
    const done = events.find(event => event?.type === 'done');
    if (conversation?.conversationId) conversationId = conversation.conversationId;
    const diagnostics = done?.diagnostics || null;
    const cardData = done?.cardData || null;
    turns.push({
      message,
      status: response.status,
      conversationId,
      reply: done?.fullReply || events.filter(event => event?.type === 'text').map(event => event.content || '').join(''),
      cardData,
      diagnostics,
      progress: events.filter(event => event?.type === 'progress'),
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
    assert.equal(response.status, 200, `${name}: Chat failed for ${message}`);
    assert.ok(conversationId, `${name}: no conversation id for ${message}`);
  }
  sessions[name] = { conversationId, turns };
}

await runSession('general', ['Hello', 'What can you help me with?', 'Explain Kurukoo simply.', "I'm not sure what I need yet.", 'What is the difference between a provider, contributor and business?']);
await runSession('contextual-reasoning', ["I've just moved to Ikeja.", 'My bathroom is leaking.', "I don't know whether I need a plumber or something else.", 'It only happens when I use the shower.', 'What do you suggest?']);
await runSession('service-correction', ['I need a painter in Ikeja next Saturday morning, probably around ₦25,000.', 'Actually Sunday is better.', 'Make it ₦30,000.', 'Two bedrooms and the living room.', 'Not Ikeja, Yaba.', 'Forget the painting; I need a plumber.', 'Cancel it.']);
await runSession('memory', ['Remember that I prefer short answers.', 'What do you remember about me?', 'Explain the difference between a reminder and an agent simply.']);
await runSession('reminder', ['Remind me tomorrow to check my landlord message.', 'Cancel it.']);
await runSession('agent', ['Keep checking for a painter and tell me when one becomes available.', 'Pause that.', 'Resume.', 'Cancel it.', 'What have you been doing?']);
await runSession('commercial', ['I want to advertise my business.', 'What are my options?', 'Show me how.']);
await runSession('provider-request', ['Use the configured hosted provider only if policy allows; otherwise answer through the canonical local path.', 'What provider and model handled that turn?']);

const allTurns = Object.values(sessions).flatMap((session: any) => session.turns);
const correctionTurns = sessions['service-correction']?.turns || [];
assert.match(JSON.stringify(correctionTurns[1]?.cardData || {}), /Sunday/i, 'service correction did not persist the updated day');
assert.match(JSON.stringify(correctionTurns[2]?.cardData || {}), /30000|30,000/i, 'service correction did not persist the updated budget');
assert.match(JSON.stringify(correctionTurns[5]?.cardData || {}), /plumber/i, 'service correction did not replace the worker service');
assert.match(String(correctionTurns[6]?.reply || ''), /cancel/i, 'service correction did not cancel the active request');
assert.match(String(sessions['reminder']?.turns?.[1]?.reply || ''), /Cancelled your reminder/i, 'reminder cancellation was routed to the wrong control surface');
const emergencyProbe = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { cookie: userCookie, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'There is an immediate danger near Ikeja', channel: 'web' }) });
const emergencyEvents = parseSse(await emergencyProbe.text());
const emergencyDone = emergencyEvents.find(event => event?.type === 'done');
assert.equal(emergencyProbe.status, 200, 'emergency probe failed');
assert.equal(emergencyDone?.diagnostics?.canonicalAction, 'skill_flow.safety', 'emergency probe did not use the safety flow');
assert.equal(emergencyDone?.diagnostics?.progressStage, 'safety', 'emergency probe did not expose safety progress');
const diagnostics = allTurns.map(turn => turn.diagnostics).filter(Boolean);
const telemetry = allTurns.map(turn => turn.telemetry);
const invalidAiLabels = diagnostics.filter((d: any) => (d.modelProvider === 'SmolLM2' && d.model === 'template-fallback') || (d.modelProvider === 'FastText' && d.classificationSource === 'fallback'));
assert.equal(invalidAiLabels.length, 0, `diagnostics contained contradictory model labels: ${JSON.stringify(invalidAiLabels)}`);
for (const [name, session] of Object.entries(sessions)) {
  const history = await fetch(`${base}/api/chat/history?conversationId=${encodeURIComponent((session as any).conversationId)}&limit=200`, { headers: { cookie: userCookie } });
  const historyData = await json(history);
  assert.equal(history.status, 200, `${name}: history failed`);
  assert.ok((historyData.messages || []).length >= (session as any).turns.length * 2, `${name}: messages not persisted`);
  (session as any).historyCount = historyData.messages.length;
}

await fs.writeFile(evidencePath, JSON.stringify({ base, identity: meData, operator: stateData.operator, actors: stateData.actors, voiceStatus: await json(await fetch(`${base}/api/voice/status`, { headers: { cookie: userCookie } })), telemetry, sessions }, null, 2));
console.log(JSON.stringify({ identity: meData.sessionContext, sessions: Object.fromEntries(Object.entries(sessions).map(([name, value]: any) => [name, { conversationId: value.conversationId, historyCount: value.historyCount, turns: value.turns.map((turn: any) => ({ message: turn.message, reply: turn.reply, diagnostics: turn.diagnostics, telemetry: turn.telemetry, progress: turn.progress })) }])) }, null, 2));
console.log(`Evidence written to ${evidencePath}`);
