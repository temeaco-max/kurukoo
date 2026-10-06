/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-conversation-turn-contract-${process.pid}-${Date.now()}.sqlite`;
const { buildConversationTurnContract, buildConversationalSystemDirective, shouldBlockGeneratedAction, shouldRetryConversationalGeneration } = await import('../src/services/conversationTurnContractService.js');

const exploratory = buildConversationTurnContract({
  latestUserMessage: 'I am thinking about getting a cleaner this weekend.',
  assistantReply: 'We can work out what you need first.',
  activeContextIds: ['request:phone-1'],
  selectedContextId: 'request:phone-1',
  relation: 'continue',
  knownFacts: ['Ibadan'],
  pendingFields: [],
  userMessage: 'I am thinking about getting a cleaner this weekend.',
  currentGoal: 'request:phone-1',
});
assert.equal(exploratory.mode, 'exploration');
assert.equal(exploratory.shouldAvoidAction, true);
assert.equal(exploratory.actionPosture, 'none');
assert.ok(shouldBlockGeneratedAction(exploratory));

const action = buildConversationTurnContract({
  latestUserMessage: 'Please find me a cleaner in Ibadan for Saturday.',
  assistantReply: 'I can look for suitable options.',
  activeContextIds: ['request:cleaner-1'],
  selectedContextId: 'request:cleaner-1',
  relation: 'create',
  userMessage: 'Please find me a cleaner in Ibadan for Saturday.',
  pendingFields: [],
});
assert.equal(action.mode, 'action');
assert.equal(action.actionPosture, 'propose');
assert.equal(action.requiresStructuredProposal, true);
assert.equal(action.shouldAvoidAction, false);
assert.equal(action.protectedContextIds[0], 'request:cleaner-1');

const interrupted = buildConversationTurnContract({
  latestUserMessage: 'Actually, forget that for a second. What was the other option?',
  assistantReply: 'You had another provider option earlier.',
  activeContextIds: ['request:phone-1', 'request:cleaner-1'],
  selectedContextId: 'request:cleaner-1',
  relation: 'switch',
  currentGoal: 'request:cleaner-1',
  pausedGoals: ['request:phone-1'],
  userMessage: 'Actually, forget that for a second. What was the other option?',
});
assert.equal(interrupted.requiresContextReconciliation, true);
assert.equal(interrupted.shouldEscalateModel, true);
assert.ok(interrupted.modelInstructions.length > 0);
assert.match(buildConversationalSystemDirective(interrupted), /Keep these 2 conversation contexts distinct/);
assert.doesNotMatch(buildConversationalSystemDirective(interrupted), /model_tier=|requirement=|instruction=|protected_context_count=/);

const weakResponse = buildConversationTurnContract({
  latestUserMessage: 'Go back to that one.',
  assistantReply: '[stable] Subscription: Base; Points: 30\n[stable] Subscription: Base; Points: 30',
  activeContextIds: ['subscription:1', 'request:1'],
  selectedContextId: 'request:1',
  userMessage: 'Go back to that one.',
});
assert.equal(weakResponse.quality.conversational, false);
assert.ok(shouldRetryConversationalGeneration(weakResponse));

console.log(JSON.stringify({
  status: 'passed',
  cases: 4,
  exploratory: exploratory.mode,
  explicitAction: action.mode,
  multiContext: interrupted.modelTier,
  retryReason: weakResponse.retryReason,
}, null, 2));
