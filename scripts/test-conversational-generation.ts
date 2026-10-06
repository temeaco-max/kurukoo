/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-conversational-generation-${process.pid}-${Date.now()}.sqlite`;
const { generateConversationalResponse } = await import('../src/services/conversationalGenerationService.js');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const cases = [
  {
    name: 'casual conversation remains conversational',
    prompt: 'How are you today?',
    expectedMode: 'conversation',
  },
  {
    name: 'problem description remains non-action exploration',
    prompt: 'My phone has been acting weird since yesterday.',
    expectedMode: 'exploration',
  },
  {
    name: 'exploration does not become an action',
    prompt: "I'm thinking about getting a cleaner this weekend.",
    expectedMode: 'exploration',
  },
  {
    name: 'explicit action remains action-capable',
    prompt: 'Please find me a cleaner in Ibadan this weekend.',
    expectedMode: 'action',
  },
  {
    name: 'relative reference triggers stronger context handling',
    prompt: 'Actually, use the cheaper one instead.',
    expectedMode: 'reference',
  },
];

for (const item of cases) {
  const result = await generateConversationalResponse({
    prompt: item.prompt,
    activeContextIds: item.expectedMode === 'reference' ? ['request:one', 'request:two'] : [],
    priorAssistantReplies: [],
  });

  assert(result.contract.mode === item.expectedMode, `${item.name}: expected ${item.expectedMode}, got ${result.contract.mode}`);
  assert(Boolean(result.text.trim()), `${item.name}: empty response`);
  assert(!result.text.includes('internal conversation orientation'), `${item.name}: leaked internal prompt text`);
  assert(!result.text.includes('system prompt'), `${item.name}: leaked system prompt text`);

  if (item.expectedMode === 'conversation' || item.expectedMode === 'exploration') {
    assert(result.contract.shouldAvoidAction, `${item.name}: conversational turn should block autonomous action`);
    assert(result.contract.actionPosture === 'none' || result.contract.actionPosture === 'clarify', `${item.name}: unexpected action posture ${result.contract.actionPosture}`);
    assert(!result.quality.issues.includes('premature_action'), `${item.name}: generated response still indicates premature action`);
  }

  if (item.expectedMode === 'exploration') {
    assert(result.contract.mode === 'exploration', `${item.name}: exploration mode was lost`);
  }

  if (item.expectedMode === 'reference') {
    assert(result.contract.requiresContextReconciliation || result.contract.relativeReference, `${item.name}: reference did not require context handling`);
  }
}

console.log(`Conversational generation regression passed: ${cases.length} cases.`);
