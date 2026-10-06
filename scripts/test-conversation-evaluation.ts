/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-conversation-evaluation-${process.pid}-${Date.now()}.sqlite`;
const { evaluateConversationTrajectory } = await import('../src/services/conversationEvaluationService.js');

const trajectory = evaluateConversationTrajectory([
  {
    user: 'My phone has been acting weird.',
    assistant: 'Tell me what kind of behaviour you are seeing and we can work it out.',
    expectedMode: 'conversation',
  },
  {
    user: 'Actually forget the phone for a second. I need a cleaner this weekend.',
    assistant: 'Sure. I can help you explore suitable options. Where are you based?',
    activeContextIds: ['request:phone'],
    selectedContextId: 'request:cleaner',
    expectedMode: 'action',
    expectedAction: true,
  },
  {
    user: 'No, the cheaper one.',
    assistant: 'Got it. I will keep the other option in view. Which one are you referring to?',
    activeContextIds: ['request:phone', 'offer:1', 'offer:2'],
    expectedMode: 'reference',
  },
  {
    user: 'Actually make that Saturday instead.',
    assistant: 'Absolutely. I will treat Saturday as the changed date and keep the rest of the request unchanged.',
    activeContextIds: ['request:cleaner'],
    pendingFields: ['date'],
    expectedMode: 'reference',
  },
]);

assert.equal(trajectory.turns, 4);
assert.ok(trajectory.overallScore >= 0.72, `expected trajectory score >= 0.72, got ${trajectory.overallScore}`);
assert.equal(trajectory.failures.some(failure => failure.type === 'premature_action'), false);
assert.equal(trajectory.failures.some(failure => failure.type === 'mode_mismatch'), false);

const empty = evaluateConversationTrajectory([]);
assert.equal(empty.overallScore, 0);
assert.equal(empty.failures[0]?.type, 'empty_trajectory');

console.log(`Conversation trajectory evaluation passed: ${trajectory.turns} turns, score=${trajectory.overallScore.toFixed(3)}.`);
