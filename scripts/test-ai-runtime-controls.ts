import { strict as assert } from 'node:assert';
import { getFastTextThresholdConfig } from '../src/services/fastTextThresholds.js';
import { getAiProviderHealth, isAiProviderUsable, recordAiProviderFailure, recordAiProviderSuccess, resetAiProviderHealth } from '../src/services/aiProviderHealth.js';
import { canSpendAgentInference, getAgentInferenceBudget, recordAgentInferenceSpend, resetAgentInferenceBudget } from '../src/services/agentInferenceBudget.js';

const thresholds = getFastTextThresholdConfig();
assert.ok(thresholds.modelMinConfidence >= 0 && thresholds.modelMinConfidence <= 1);
assert.ok(thresholds.modelMarginConfidence >= 0 && thresholds.modelMarginConfidence <= 1);
assert.ok(thresholds.fallbackMinScore >= 0 && thresholds.fallbackMinScore <= 1);
assert.ok(thresholds.fallbackMargin >= 0 && thresholds.fallbackMargin <= 1);

resetAiProviderHealth();
assert.equal(isAiProviderUsable('mistral'), true);
for (let i = 0; i < 3; i += 1) recordAiProviderFailure('mistral', 'synthetic_failure', 1000);
assert.equal(getAiProviderHealth('mistral').state, 'open');
assert.equal(isAiProviderUsable('mistral'), false);
// reset rather than waiting for cooldown; next success must restore health.
resetAiProviderHealth('mistral');
recordAiProviderSuccess('mistral', 120);
assert.equal(getAiProviderHealth('mistral').state, 'healthy');

resetAgentInferenceBudget();
const budget = getAgentInferenceBudget();
const allowed = canSpendAgentInference('agent-test', 'goal-test', Math.min(budget.cycleUsd / 2, budget.goalUsd / 2), true);
assert.equal(allowed.allowed, true);
recordAgentInferenceSpend('agent-test', 'goal-test', budget.cycleUsd * 2, true);
const blocked = canSpendAgentInference('agent-test', 'goal-test', 0.01, true);
assert.equal(blocked.allowed, false);

console.log(JSON.stringify({ passed: true, thresholds, providerCircuit: getAiProviderHealth('mistral'), agentBudget: budget }, null, 2));
