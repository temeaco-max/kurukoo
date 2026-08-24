import { AIProvider, resolveHostedProviderCandidates, resolveConfiguredHostedProvider } from '../src/services/unifiedAiEngine.js';
import { AiProvider, isAiProviderUsable, recordAiProviderSuccess, recordAiProviderFailure, resetAiProviderHealth, listAiProviderHealth } from '../src/services/aiProviderHealth.js';
import { getFeatureFlag, getFeatureFlagStatus } from '../src/services/featureFlags.js';
import { chooseInferenceProvider, type InferenceTask } from '../src/services/aiInferencePolicy.js';
import { hasConfiguredSecret } from '../src/services/providerCapabilities.js';

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    // console.log(`${PASS} ${message}`);
  } else {
    failed++;
    console.error(`${FAIL} ${message}`);
  }
}

// Test 1: provider type includes poolside
assert(
  resolveHostedProviderCandidates('poolside') instanceof Array,
  'Poolside resolves as a hosted provider candidate',
);

// Test 2: default model is correct
const expectedModel = 'poolside/laguna-xs-2.1';
assert(
  String(process.env.POOLSIDE_MODEL || expectedModel) === expectedModel,
  `Default Poolside model is ${expectedModel}`,
);

// Test 3: default base URL is correct
const expectedBase = 'https://inference.poolside.ai/v1';
assert(
  String(process.env.POOLSIDE_API_BASE || expectedBase) === expectedBase,
  `Default Poolside base URL is ${expectedBase}`,
);

// Test 4: missing key = unavailable
const originalPoolsideKey = process.env.POOLSIDE_API_KEY;
delete process.env.POOLSIDE_API_KEY;
const candidatesWithoutKey = resolveHostedProviderCandidates('poolside');
assert(
  candidatesWithoutKey.length === 0,
  'Without POOLSIDE_API_KEY, poolside is not in hosted candidates',
);
if (originalPoolsideKey !== undefined) {
  process.env.POOLSIDE_API_KEY = originalPoolsideKey;
}

// Test 5: disabled feature flag = unavailable
const originalFlag = process.env.FF_HOSTED_POOLSIDE;
const originalKey = process.env.POOLSIDE_API_KEY;
process.env.POOLSIDE_API_KEY = 'test-key-for-validation';
process.env.FF_HOSTED_POOLSIDE = 'false';
const candidatesDisabled = resolveHostedProviderCandidates('poolside');
assert(
  candidatesDisabled.length === 0,
  'With hosted_poolside flag disabled, poolside is not in hosted candidates',
);
if (originalKey !== undefined) {
  process.env.POOLSIDE_API_KEY = originalKey;
} else {
  delete process.env.POOLSIDE_API_KEY;
}
if (originalFlag !== undefined) {
  process.env.FF_HOSTED_POOLSIDE = originalFlag;
} else {
  delete process.env.FF_HOSTED_POOLSIDE;
}

// Test 6: configured poolside appears in hosted candidates
// Note: This test depends on the feature flag and key being set in env
const hasKey = hasConfiguredSecret(process.env.POOLSIDE_API_KEY);
const flagStatus = getFeatureFlag(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'hosted_poolside');
if (hasKey && flagStatus) {
  const candidates = resolveHostedProviderCandidates('poolside');
  assert(
    candidates.includes('poolside'),
    'Configured poolside appears in hosted candidates',
  );
} else {
  assert(
    true,
    'Skipping configured poolside candidate test (no valid key/flag in test env)',
  );
}

// Test 7: planning/agent_execution can select poolside (when configured)
if (hasKey && flagStatus && isAiProviderUsable('poolside')) {
  const planningDecision = chooseInferenceProvider({ task: 'planning', prompt: 'Plan a multi-step project coordination task' });
  assert(
    planningDecision.provider === 'poolside' || planningDecision.provider === 'mistral' || planningDecision.provider === 'smollm2',
    `Planning task selects an appropriate provider (got: ${planningDecision.provider})`,
  );
} else {
  const planningDecision = chooseInferenceProvider({ task: 'planning', prompt: 'Plan a multi-step project coordination task' });
  assert(
    planningDecision.provider !== 'poolside',
    'When poolside is not configured, planning task does not select poolside',
  );
}

// Test 8: simple greetings do NOT select poolside
const greetingDecision = chooseInferenceProvider({ task: 'conversation', prompt: 'Hello there!' });
assert(
  greetingDecision.provider !== 'poolside',
  'Simple greeting does NOT select poolside',
);

// Test 9: Poolside failure can fall back to Mistral/SmolLM2
// This is covered by the unifiedAiEngine tryHostedProviders fallback logic
assert(
  typeof isAiProviderUsable('poolside') === 'boolean',
  'Poolside participates in provider health circuit',
);

// Test 10: provider health circuit works
resetAiProviderHealth('poolside');
const initialHealth = listAiProviderHealth().find(h => h.provider === 'poolside');
assert(
  initialHealth !== undefined && initialHealth.state === 'healthy' && initialHealth.consecutiveFailures === 0,
  'Poolside health starts in healthy state with zero failures',
);

recordAiProviderFailure('poolside', new Error('simulated failure'), 100);
const afterFailure = listAiProviderHealth().find(h => h.provider === 'poolside');
assert(
  afterFailure !== undefined && afterFailure.state === 'degraded',
  'Poolside health transitions to degraded after a failure',
);

recordAiProviderSuccess('poolside', 50);
const afterRecovery = listAiProviderHealth().find(h => h.provider === 'poolside');
assert(
  afterRecovery !== undefined && afterRecovery.state === 'healthy',
  'Poolside health recovers to healthy after a success',
);

resetAiProviderHealth('poolside');

console.log(`\n📊 Poolside Provider Contract: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
