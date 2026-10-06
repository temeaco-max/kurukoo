/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-emergency-priority-route-${process.pid}-${Date.now()}.sqlite`;
const { routeIntent } = await import('../src/services/intentRouter.js');

const cases = [
  ['I need an ambulance', 'ambulance'],
  ['call the police', 'police'],
  ['there is a fire', 'fire'],
] as const;

for (const [message, service] of cases) {
  const result = await routeIntent(message, 'anon_emergency_priority_test', undefined, undefined, 'emergency-priority-test');
  if (result.canonicalAction !== 'safety.emergency_dispatch') throw new Error(`${message}: expected safety.emergency_dispatch, got ${result.canonicalAction || 'none'}`);
  if (result.skill !== 'emergency') throw new Error(`${message}: expected emergency skill, got ${result.skill}`);
  if (!result.cardData || result.cardData.service !== service) throw new Error(`${message}: expected service ${service}`);
  if (/sign in|tell me your name|phone number|otp/i.test(result.reply)) throw new Error(`${message}: emergency response must not require registration before initial help`);
  if (/Support, Safety & Dispute Triage Agent|I.m with you\. Tell me a little more/i.test(result.reply)) throw new Error(`${message}: legacy generic safety agent response leaked through`);
  if (!Array.isArray(result.cardData.actions) || !result.cardData.actions.length) throw new Error(`${message}: no emergency next action was returned`);
}

console.log(JSON.stringify({ ok: true, cases: cases.length, canonicalAction: 'safety.emergency_dispatch', guestRegistrationBypassed: true }, null, 2));
