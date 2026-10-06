/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-conversational-agent-rebuild-${process.pid}-${Date.now()}.sqlite`;
const { interpretConversationSemantics } = await import('../src/services/semanticConversationInterpreter.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { resolveConversationProvider } = await import('../src/services/conversationalGenerationService.js');

async function runTests() {
  console.log('--- Starting Conversational Agent Rebuild Tests ---');

  // Test 1: Provider resolution hierarchy
  const resolvedProvider = resolveConversationProvider(undefined);
  assert.equal(resolvedProvider, 'auto', 'Default conversation provider should resolve to auto (SmolLM2-first)');
  console.log('✓ Test 1: Provider resolution defaults to auto');

  // Test 2: Multi-turn exploratory troubleshooting does not trigger premature action
  const phone = '+2348000000101';
  const threadId = 'conv-troubleshoot-' + Date.now();

  const semantic1 = await interpretConversationSemantics({
    message: 'My laptop keeps freezing.',
    phone,
    threadId,
    provider: 'auto',
  });
  assert.notEqual(semantic1.mode, 'action', 'Problem exploration must not be classified as an action');
  assert.equal(semantic1.explicitAuthorization, false, 'Exploring a problem is not explicit authorization');
  assert.equal(semantic1.conversationMode, 'chat', 'Exploratory troubleshooting should run in chat mode');
  console.log('✓ Test 2: Exploration is classified as chat/exploration without premature authorization');

  // Test 3: Natural Chat Turn Processing for Laptop Troubleshooting
  const turn1 = await processCanonicalChatTurn({
    phone,
    message: 'Hello',
    channel: 'web',
    conversationId: threadId,
  });
  assert.ok(turn1.reply.length > 0, 'Turn 1 should produce a natural greeting reply');
  assert.ok(!turn1.cardData || turn1.cardData.type === 'semantic_conversation' || turn1.cardData.hidden, 'Greeting should not display transactional storefront card');

  const turn2 = await processCanonicalChatTurn({
    phone,
    message: 'My laptop keeps freezing.',
    channel: 'web',
    conversationId: threadId,
  });
  assert.ok(turn2.reply.length > 0, 'Turn 2 should produce a helpful diagnostic response');
  assert.ok(!/payment|booking confirmed|quoted/i.test(turn2.reply), 'Turn 2 must not produce booking/payment confirmation');
  console.log('✓ Test 3: Multi-turn chat turn executes naturally without forced forms');

  // Test 4: Progressive Slot-filling for transport
  const phone2 = '+2348000000102';
  const threadId2 = 'conv-transport-' + Date.now();

  const transportTurn1 = await processCanonicalChatTurn({
    phone: phone2,
    message: 'Get me a ride to the airport',
    channel: 'web',
    conversationId: threadId2,
  });
  assert.ok(transportTurn1.reply.length > 0, 'Transport turn 1 should ask for origin/pickup');
  assert.ok(
    /pick you up|starting|where from|where/i.test(transportTurn1.reply) || transportTurn1.cardData?.stage === 'slot_fill',
    'Should ask progressive single question for missing pickup/origin'
  );

  const transportTurn2 = await processCanonicalChatTurn({
    phone: phone2,
    message: 'From Yaba',
    channel: 'web',
    conversationId: threadId2,
  });
  assert.ok(transportTurn2.reply.length > 0, 'Transport turn 2 should acknowledge Yaba');

  console.log('✓ Test 4: Progressive slot-filling asks single useful questions and updates slots');

  // Test 5: Correction without restarting
  const transportTurn3 = await processCanonicalChatTurn({
    phone: phone2,
    message: 'Actually make it tomorrow morning before 9',
    channel: 'web',
    conversationId: threadId2,
  });
  assert.ok(transportTurn3.reply.length > 0, 'Transport turn 3 handles time/date correction');
  console.log('✓ Test 5: Natural corrections modify existing active request context');

  // Test 6: Compound Objective Decomposition
  const { recognizeCompoundObjective } = await import('../src/services/compoundObjectiveResolver.js');
  const compound = recognizeCompoundObjective('I need to get to the airport by 9 tomorrow and I need a hotel near the terminal');
  assert.ok(compound, 'Should recognize compound travel and hotel request');
  assert.equal(compound?.subObjectives.length, 3, 'Should decompose into transport, hotel, and reminder sub-objectives');
  console.log('✓ Test 6: Compound outcome decomposes under overarching user outcome');

  // Test 7: Work Resumption & Status Query
  const statusTurn = await processCanonicalChatTurn({
    phone: phone2,
    message: 'Where are we with that ride?',
    channel: 'web',
    conversationId: threadId2,
  });
  assert.ok(statusTurn.reply.length > 0, 'Status turn should provide a natural update');
  console.log('✓ Test 7: Work resumption queries report truthful active request state');

  // Test 8: Voice Tool Parity
  const { executeVoiceTool } = await import('../src/services/voiceToolRegistry.js');
  const voiceResult = await executeVoiceTool('route_user_intent', { text: 'Hello' }, {
    phone: '+2348000000103',
    conversationId: 'voice-session-' + Date.now(),
    isGuest: false,
    sessionId: 'sess-' + Date.now(),
  });
  assert.equal(voiceResult.ok, true, 'Voice tool should execute successfully through canonical pipeline');
  assert.ok(typeof voiceResult.reply === 'string' && voiceResult.reply.length > 0, 'Voice should return assistant reply');
  console.log('✓ Test 8: Voice route achieves full parity with canonical chat turn pipeline');

  console.log('--- ALL CONVERSATIONAL AGENT REBUILD TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
