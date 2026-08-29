/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.ACCEPTANCE_BASE_URL || 'http://127.0.0.1:3210';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'acceptance-admin-password';
const evidencePath = process.env.ACCEPTANCE_ACTOR_EVIDENCE || '/tmp/kurukoo-actor-chat-matrix.json';

function cookieOf(response: Response): string {
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

async function json(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

function parseSse(text: string): any[] {
  return text.split(/\n\n+/).map(block => block.trim()).filter(Boolean).map(block => {
    const raw = block.startsWith('data: ') ? block.slice(6) : block;
    try { return JSON.parse(raw); } catch { return { raw }; }
  });
}

const login = await fetch(`${base}/api/admin/auth`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: adminUsername, password: adminPassword }),
});
assert.equal(login.status, 200, 'admin login failed');
const loginData = await json(login);
assert.ok(loginData.token, 'admin token missing');
const adminToken = String(loginData.token);

const actorsResponse = await fetch(`${base}/api/admin/operator/actors`, { headers: { 'x-admin-token': adminToken } });
assert.equal(actorsResponse.status, 200, 'controlled actor registry failed');
const actorsData = await json(actorsResponse);
assert.ok(Array.isArray(actorsData.actors) && actorsData.actors.length > 0, 'controlled actor registry is empty');

const prompts: Record<string, string[]> = {
  customer: ['Remember that I prefer concise answers.', 'Remind me tomorrow at 9am to check my request.'],
  provider: ['I can provide plumbing services in Ikeja and I am available tomorrow.'],
  seller: ['I sell phone chargers and want to review known seller offers.'],
  contributor: ['I want to report event evidence from a community meeting.'],
  business: ['I want to advertise my business through the approved public campaign flow.'],
  agent_owner: ['Keep checking my open request, but do not contact anyone or spend money without confirmation.'],
};

const results: any[] = [];
for (const actor of actorsData.actors) {
  const reset = await fetch(`${base}/api/admin/operator/actors/${encodeURIComponent(actor.id)}/reset`, { method: 'POST', headers: { 'x-admin-token': adminToken } });
  assert.equal(reset.status, 200, `${actor.id}: reset failed`);
  const launch = await fetch(`${base}/api/admin/operator/actors/${encodeURIComponent(actor.id)}/chat`, { method: 'POST', headers: { 'x-admin-token': adminToken, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(launch.status, 200, `${actor.id}: Chat launch failed`);
  const cookie = cookieOf(launch);
  assert.match(cookie, /^kurukoo_auth=/, `${actor.id}: actor session cookie missing`);
  let conversationId = '';
  const turns: any[] = [];
  for (const message of prompts[actor.id] || ['Tell me what this actor can do in Kurukoo.']) {
    const started = Date.now();
    const response = await fetch(`${base}/api/chat/stream`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ message, channel: 'web', ...(conversationId ? { conversationId } : {}) }),
    });
    assert.equal(response.status, 200, `${actor.id}: Chat failed for ${message}`);
    const events = parseSse(await response.text());
    const conversation = events.find(event => event?.type === 'conversation');
    const done = events.find(event => event?.type === 'done');
    if (conversation?.conversationId) conversationId = conversation.conversationId;
    assert.ok(conversationId, `${actor.id}: conversation continuity id missing`);
    turns.push({
      message,
      elapsedMs: Date.now() - started,
      reply: done?.fullReply || events.filter(event => event?.type === 'text').map(event => event.content || '').join(''),
      diagnostics: done?.diagnostics || null,
      cardData: done?.cardData || null,
      progress: events.filter(event => event?.type === 'progress'),
    });
  }
  const combined = turns.map(turn => `${turn.reply}\n${JSON.stringify(turn.cardData)}`).join('\n');
  if (actor.id === 'customer') assert.match(combined, /remind|reminder/i, 'customer memory/reminder flow was not reached');
  if (actor.id === 'provider') assert.match(combined, /provider_profile_setup|provider profile|plumber/i, 'provider onboarding flow was not reached');
  if (actor.id === 'seller') assert.match(combined, /seller_offer_review|seller|offer/i, 'seller offer review flow was not reached');
  if (actor.id === 'contributor') assert.match(combined, /event evidence|event_coverage|contributor/i, 'contributor evidence flow was not reached');
  if (actor.id === 'business') assert.match(combined, /advertising|public placements|campaign/i, 'business advertising flow was not reached');
  if (actor.id === 'agent_owner') assert.match(combined, /agentic_storefront|slot_fill|provider/i, 'agent-owner bounded request flow was not reached');
  results.push({ actor: { id: actor.id, role: actor.role, phone: actor.phone }, conversationId, turns });
}

assert.equal(new Set(results.map(result => result.actor.phone)).size, results.length, 'actor contexts were not isolated');
const evidence = { base, actorCount: results.length, results };
await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ actorCount: results.length, results: results.map(result => ({ actor: result.actor, conversationId: result.conversationId, turns: result.turns.map((turn: any) => ({ message: turn.message, skill: turn.diagnostics?.skill || null, action: turn.diagnostics?.canonicalAction || null, provider: turn.diagnostics?.modelProvider || null, model: turn.diagnostics?.model || null, finalState: turn.cardData?.status || turn.cardData?.state || turn.diagnostics?.finalState || null, reply: turn.reply })) })) }, null, 2));
console.log(`Actor evidence written to ${evidencePath}`);
