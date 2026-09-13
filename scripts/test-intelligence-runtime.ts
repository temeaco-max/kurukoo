/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Phase 1: Static assertions — verify the Intelligence Runtime boundary exists
// and is wired into the canonical Chat path.
// ---------------------------------------------------------------------------

const runtimeSource = fs.readFileSync(
  new URL('../src/services/kurukooIntelligenceRuntime.ts', import.meta.url),
  'utf8',
);

assert.match(runtimeSource, /export async function understand/, 'Intelligence Runtime must export understand()');
assert.match(runtimeSource, /export async function selectCapabilities/, 'Intelligence Runtime must export selectCapabilities()');
assert.match(runtimeSource, /export async function processIntelligenceTurn/, 'Intelligence Runtime must export processIntelligenceTurn()');
assert.match(runtimeSource, /arbitrateChatContext/, 'Intelligence Runtime must delegate context arbitration');
assert.match(runtimeSource, /routeIntent/, 'Intelligence Runtime must delegate intent routing');
assert.match(runtimeSource, /classifyAiRoutingSignal/, 'Intelligence Runtime must delegate routing signal');
assert.doesNotMatch(runtimeSource, /queryGemini|queryMistral|queryGroq|queryOpenRouter|queryPoolside/, 'Intelligence Runtime must not directly call model providers');

// Verify canonicalChatTurnService delegates to the Intelligence Runtime
const canonicalSource = fs.readFileSync(
  new URL('../src/services/canonicalChatTurnService.ts', import.meta.url),
  'utf8',
);
assert.match(canonicalSource, /from '.*kurukooIntelligenceRuntime/, 'canonicalChatTurnService must import the Intelligence Runtime');
assert.match(canonicalSource, /await understand\(/, 'canonicalChatTurnService must call Intelligence Runtime understand()');
assert.match(canonicalSource, /selectCapabilities/, 'canonicalChatTurnService must call selectCapabilities()');
assert.doesNotMatch(canonicalSource, /await arbitrateChatContext/, 'canonicalChatTurnService must not call arbitrateChatContext directly');

// Verify modelRouter abstraction exists
const modelRouterSource = fs.readFileSync(
  new URL('../src/services/modelRouter.ts', import.meta.url),
  'utf8',
);
assert.match(modelRouterSource, /export function selectModel/, 'modelRouter must export selectModel()');
assert.match(modelRouterSource, /export async function complete/, 'modelRouter must export complete()');
assert.match(modelRouterSource, /chooseInferenceProvider/, 'modelRouter must delegate to aiInferencePolicy');
assert.match(modelRouterSource, /queryUnifiedAI/, 'modelRouter must delegate execution to unifiedAiEngine');

// Verify FastText is explicitly secondary
const convergenceSource = fs.readFileSync(
  new URL('../src/services/aiRoutingConvergence.ts', import.meta.url),
  'utf8',
);
assert.match(convergenceSource, /FASTTEXT_HINT_MAX_CONFIDENCE/, 'FastText must have a confidence cap');


// ---------------------------------------------------------------------------
// Phase 2: Runtime assertions — verify delegation and FastText boundary.
// ---------------------------------------------------------------------------

const { understand, selectCapabilities, processIntelligenceTurn } = await import('../src/services/kurukooIntelligenceRuntime.js');
const { classifyAiRoutingSignal, shouldEscalateToAi, FASTTEXT_HINT_MAX_CONFIDENCE } = await import('../src/services/aiRoutingConvergence.js');

// --- understand: deterministic rules must classify conversation acts ---
const greeting = await understand({ phone: 'anon_test_123', message: 'hello', isGuest: true, conversationId: undefined });
assert.equal(greeting.routingSignal.conversationAct, 'greeting', 'understand must classify greeting via rules');
assert.equal(greeting.routingSignal.source, 'rules', 'conversation act must come from rules, not FastText');
assert.equal(greeting.contextDecision, undefined, 'guests must have no context decision');

// --- understand: skill catalogue must not consult FastText first-line ---
const repair = await understand({ phone: 'test_phone_456', message: 'I need my MacBook repaired', isGuest: false });
assert.notEqual(repair.routingSignal.source, 'fasttext', 'catalogue-solvable request must not be FastText-first-line');
assert.equal(repair.routingSignal.skill, 'laptop_repairer', 'understand must resolve laptop repair via catalogue');

// --- selectCapabilities: intent routing delegates to routeIntent ---
const capabilities = await selectCapabilities(
  { phone: 'anon_test_789', message: 'hello', isGuest: true, conversationId: undefined },
  greeting,
);
assert.ok(capabilities.routing, 'selectCapabilities must return a routing result');
assert.equal(capabilities.routing.skill, 'general_question', 'greeting must route to general_question');
assert.equal(typeof capabilities.routing.reply, 'string', 'routing must produce a reply');

// --- processIntelligenceTurn: full flow ---
const turn = await processIntelligenceTurn({
  phone: 'anon_test_999',
  message: 'hello',
  isGuest: true,
  conversationId: undefined,
});
assert.ok(turn.understanding, 'processIntelligenceTurn must produce understanding');
assert.ok(turn.routing, 'processIntelligenceTurn must produce routing');
assert.equal(turn.routing.routing.skill, 'general_question', 'hello must route to general_question');
assert.equal(turn.understanding.routingSignal.source, 'rules', 'greeting classified by rules through Intelligence Runtime');

// --- FastText boundary through the Intelligence Runtime ---
assert.ok(FASTTEXT_HINT_MAX_CONFIDENCE < 0.72, 'FastText hint cap must be below escalation threshold');
const nonsense = classifyAiRoutingSignal('zzz unknown domain probe qqq');
if (nonsense.source === 'fasttext') {
  assert.ok(nonsense.confidence <= FASTTEXT_HINT_MAX_CONFIDENCE, 'FastText hint exceeded its cap');
  assert.equal(shouldEscalateToAi(nonsense, 'zzz unknown domain probe qqq'), true, 'FastText-only hint must escalate');
}

// --- Module exports ---
const mod = await import('../src/services/kurukooIntelligenceRuntime.js');
assert.equal(typeof mod.understand, 'function');
assert.equal(typeof mod.selectCapabilities, 'function');
assert.equal(typeof mod.processIntelligenceTurn, 'function');

console.log('Intelligence Runtime runtime tests passed.');
console.log(`All tests passed. Greeting: act=${turn.understanding.routingSignal.conversationAct}, source=${turn.understanding.routingSignal.source}.`);

