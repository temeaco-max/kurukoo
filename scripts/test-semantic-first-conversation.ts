/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

import type { SemanticConversationInterpretation } from '../src/services/semanticConversationInterpreter.js';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-semantic-first-conversation-${process.pid}-${Date.now()}.sqlite`;
const { buildConversationTurnContract } = await import('../src/services/conversationTurnContractService.js');

function semantic(patch: Partial<SemanticConversationInterpretation>): SemanticConversationInterpretation {
  return {
    mode: 'conversation', speechAct: 'conversation', intent: 'general_conversation', explicitAuthorization: false,
    requiresClarification: false, topicShift: false, resumption: false, references: [], entities: {},
    missingInformation: [], goalStatements: [], responseStrategy: 'answer', confidence: 0.95, source: 'llm',
    ...patch,
  };
}

const exploratoryBookingTalk = buildConversationTurnContract({
  latestUserMessage: 'I am thinking about booking the cheaper one, but I want to compare them first.',
  userMessage: 'I am thinking about booking the cheaper one, but I want to compare them first.',
  assistantReply: '',
  semanticInterpretation: semantic({ mode: 'exploration', speechAct: 'question', intent: 'compare_options_before_booking', explicitAuthorization: false, responseStrategy: 'answer', references: [{ text: 'the cheaper one', target: 'offer_2', confidence: 0.91 }] }),
});
assert.equal(exploratoryBookingTalk.mode, 'exploration');
assert.equal(exploratoryBookingTalk.shouldAvoidAction, true);
assert.equal(exploratoryBookingTalk.actionPosture, 'none');
assert.equal(exploratoryBookingTalk.shouldRequireCanonicalAction, false);
assert.equal(exploratoryBookingTalk.semanticInterpretation?.intent, 'compare_options_before_booking');

const authorizedBooking = buildConversationTurnContract({
  latestUserMessage: 'Yes, go ahead and book the cheaper verified option we just discussed.',
  userMessage: 'Yes, go ahead and book the cheaper verified option we just discussed.',
  assistantReply: '',
  semanticInterpretation: semantic({ mode: 'action', speechAct: 'instruction', intent: 'book_selected_offer', skillHint: 'book_offer', capabilityHint: 'economic_request.book', explicitAuthorization: true, responseStrategy: 'propose', references: [{ text: 'the cheaper verified option', target: 'offer_2', confidence: 0.94 }] }),
});
assert.equal(authorizedBooking.mode, 'action');
assert.equal(authorizedBooking.shouldRequireCanonicalAction, true);
assert.equal(authorizedBooking.shouldAvoidAction, false);
assert.equal(authorizedBooking.actionPosture, 'propose');
assert.equal(authorizedBooking.semanticInterpretation?.explicitAuthorization, true);

const topicShift = buildConversationTurnContract({
  latestUserMessage: 'Actually, forget the cleaner for now. My landlord says the bathroom leak is getting worse.',
  userMessage: 'Actually, forget the cleaner for now. My landlord says the bathroom leak is getting worse.',
  assistantReply: '',
  currentGoal: 'Find a house cleaner',
  activeGoals: ['Find a house cleaner'],
  semanticInterpretation: semantic({ mode: 'conversation', speechAct: 'correction', intent: 'switch_to_worsening_bathroom_leak', topicShift: true, responseStrategy: 'answer', goalStatements: ['Address worsening bathroom leak'], entities: { issue: 'bathroom leak', urgency: 'worsening' } }),
});
assert.equal(topicShift.mode, 'conversation');
assert.equal(topicShift.shouldAvoidAction, true);
assert.equal(topicShift.goalState.currentGoal, 'Find a house cleaner');
assert.match(topicShift.responseRequirements.join('\n'), /topic shift/i);

console.log('semantic-first conversation tests passed');
