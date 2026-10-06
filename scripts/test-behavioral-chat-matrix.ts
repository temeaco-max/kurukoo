/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A per-run path this contract OWNS, never one inherited from the environment.
// `.env` sets DB_PATH=tmp/kurukoo.sqlite and a running dev server exports it, so
// a `process.env.DB_PATH || …` fallback resolves to the developer's REAL
// database — and the rmSync below then deletes it before the first assertion
// runs. That is data loss, not a flaky test. Proven with a canary file.
const dbPath = `/tmp/kurukoo-behavioral-matrix-${process.pid}-${Date.now()}.sqlite`;
try { fs.rmSync(dbPath, { force: true }); } catch {}
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DEV_AUTH = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'behavioral-matrix-secret-0123456789';
process.env.DB_PATH = dbPath;
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'true';
process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE = '2';
process.env.KURUKOO_AGENT_MAX_CONCURRENT_GOALS = '4';

const { getDb } = await import('../src/database.js');
const { encryptData } = await import('../src/services/memoryProfile.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { getEconomicRequest, updateEconomicRequestRequirements } = await import('../src/services/skillFlows.js');
const { createConversationGoal, listAgentGoals, cancelAgentGoal } = await import('../src/services/agentRuntime.js');

const actors = {
  customer: '+2347000000701',
  provider: '+2347000000702',
  seller: '+2347000000703',
  contributor: '+2347000000704',
  safety: '+2347000000705',
};
const db = await getDb();
for (const [phone, name, verified] of [
  [actors.customer, 'Behaviour Customer', 0],
  [actors.provider, 'Behaviour Provider', 1],
  [actors.seller, 'Behaviour Seller', 0],
  [actors.contributor, 'Behaviour Contributor', 0],
  [actors.safety, 'Behaviour Safety Actor', 0],
] as const) {
  db.run(`INSERT OR REPLACE INTO memory_profiles (phone,name,location,country,verified_provider,points_balance,preferences) VALUES (?,?,?,'ng',?,20,?)`, [phone, name, 'Ibadan', verified, encryptData(JSON.stringify({ onboarding_complete: true, onboarding_step: 'done', primary_intent: phone === actors.provider ? 'both' : 'find services' }))]);
}

type Case = { id: string; actor: string; skill: string; messages: string[]; expect: (turns: any[]) => void };
const cases: Case[] = [
  {
    id: 'customer-painter-natural-correction-cancel', actor: actors.customer, skill: 'find_worker',
    messages: ['Guy I need somebody to paint my place.', 'Ibadan.', 'Tomorrow afternoon.', 'Actually tomorrow morning, not afternoon.'],
    expect: turns => { assert.equal(turns[0].cardData?.type, 'agentic_storefront'); assert.equal(turns[0].cardData?.skill, 'find_worker'); assert.ok(turns[0].cardData?.requestId); assert.match(turns[3].reply, /painter|request|details|continue/i); },
  },
  {
    id: 'customer-ambiguous-ride', actor: actors.customer, skill: 'ride_request',
    messages: ['Need a ride tomorrow.'],
    expect: turns => { assert.equal(turns[0].cardData?.type, 'agentic_storefront'); assert.equal(turns[0].cardData?.skill, 'ride_request'); assert.match(turns[0].reply, /pickup|destination|where|going|when|vehicle/i); },
  },
  {
    id: 'provider-capability-consent', actor: actors.provider, skill: 'provider_profile_setup',
    messages: ['I offer painter services in Ibadan and can take jobs tomorrow.'],
    expect: turns => { assert.equal(turns[0].cardData?.type, 'provider_profile_setup'); assert.match(turns[0].reply, /confirm|availability|verification|pricing/i); },
  },
  {
    id: 'seller-known-offer-boundary', actor: actors.seller, skill: 'product_sourcing',
    messages: ['I need a phone charger in Ibadan.'],
    expect: turns => { assert.ok(turns[0].cardData); assert.match(turns[0].reply, /seller|product|request|verified|available/i); assert.doesNotMatch(turns[0].reply, /payment completed|delivered|in stock/i); },
  },
  {
    id: 'contributor-evidence', actor: actors.contributor, skill: 'event_coverage',
    messages: ['I can provide evidence for an event listing.'],
    expect: turns => { assert.equal(turns[0].cardData?.type, 'event_coverage'); assert.equal(turns[0].cardData?.mode, 'contributor_evidence'); assert.match(turns[0].reply, /evidence|event|coverage|contributor/i); assert.doesNotMatch(JSON.stringify(turns[0].cardData || {}), /agentic_storefront|economic_request/i); },
  },
  {
    id: 'safety-urgent-triage', actor: actors.safety, skill: 'support_triage',
    messages: ['There is an immediate danger and I need emergency help.'],
    expect: turns => { assert.match(turns[0].reply, /112|safe|emergency|danger/i); assert.doesNotMatch(JSON.stringify(turns[0].cardData || {}), /agentic_storefront|economic_request/i); },
  },
];

const results: any[] = [];
for (const scenario of cases) {
  const turns: any[] = [];
  let conversationId: string | undefined;
  for (const message of scenario.messages) {
    const turn = await processCanonicalChatTurn({ phone: scenario.actor, message, channel: 'web', conversationId });
    conversationId = turn.conversationId;
    turns.push(turn);
  }
  try {
    scenario.expect(turns);
    results.push({ id: scenario.id, actor: scenario.actor, skill: scenario.skill, status: 'passed', conversationId, turns: turns.map(t => ({ reply: t.reply, cardType: t.cardData?.type, cardSkill: t.cardData?.skill, requestId: t.cardData?.requestId })) });
  } catch (error) {
    results.push({ id: scenario.id, actor: scenario.actor, skill: scenario.skill, status: 'failed', conversationId, error: String(error), turns: turns.map(t => ({ reply: t.reply, cardData: t.cardData })) });
  }
}

const activeRequests = db.exec(`SELECT phone, skill, status, requirements_json FROM economic_requests WHERE phone IN (${Object.values(actors).map(() => '?').join(',')}) ORDER BY created_at`).flatMap(table => table.values.map(row => ({ phone: row[0], skill: row[1], status: row[2], requirements: row[3] })));
const ownedGoal = await createConversationGoal({ phone: actors.customer, conversationId: 'agentic-matrix-conversation', skill: 'find_worker', objective: 'Keep checking for a painter and tell me when one is verified.', source: 'conversation' });
assert.ok(ownedGoal?.id);
const goals = await listAgentGoals(actors.customer);
assert.ok(goals.some(goal => goal.id === ownedGoal?.id));
const cancelledGoal = await cancelAgentGoal(actors.customer, ownedGoal!.id);
assert.equal(cancelledGoal?.status, 'cancelled');

const failed = results.filter(item => item.status === 'failed');
console.log(JSON.stringify({ scenarios: results.length, passed: results.length - failed.length, failed: failed.length, results, activeRequests, agentic: { created: ownedGoal?.id, cancelled: cancelledGoal?.status } }, null, 2));
if (failed.length) process.exitCode = 1;
try { fs.rmSync(dbPath, { force: true }); } catch {}
