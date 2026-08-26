import assert from 'node:assert/strict';
import {
  getProviderHealth,
  mayAttemptProvider,
  recordProviderFailure,
  recordProviderSuccess,
  resetProviderHealthForTest,
} from '../src/services/aiProviderHealthService.js';
import { getAiUsageSummary, recordAiUsageEvent } from '../src/services/aiCostTelemetry.js';

resetProviderHealthForTest();
const now = Date.now();
recordProviderFailure('groq', { timeout: true, now });
recordProviderFailure('groq', { timeout: true, now: now + 1 });
assert.equal(getProviderHealth('groq', now + 2).state, 'degraded');
recordProviderFailure('groq', { timeout: true, now: now + 3 });
assert.equal(getProviderHealth('groq', now + 4).state, 'open');
assert.equal(mayAttemptProvider('groq', now + 5), false, 'open circuit must block a hosted attempt');
assert.equal(mayAttemptProvider('groq', now + 30_100), true, 'half-open circuit must allow one probe');
assert.equal(mayAttemptProvider('groq', now + 30_101), false, 'only one half-open probe may run');
recordProviderSuccess('groq', now + 30_102);
assert.equal(getProviderHealth('groq', now + 30_103).state, 'healthy');
const requestId = `telemetry-${now}-${Math.random().toString(36).slice(2)}`;
await recordAiUsageEvent({ requestId, provider: 'groq', model: 'contract-model', skill: 'find_worker', inputTokens: 12, outputTokens: 8, latencyMs: 42, estimatedCostUsd: 0.001, success: false, escalationReason: 'contract_failure' });
await recordAiUsageEvent({ requestId: `${requestId}-recovery`, provider: 'groq', model: 'contract-model', skill: 'find_worker', inputTokens: 10, outputTokens: 6, latencyMs: 31, estimatedCostUsd: 0.001, success: true });
const summary = await getAiUsageSummary(new Date(now - 1_000).toISOString());
assert.ok(summary.total >= 2);
assert.ok(summary.failures >= 1);
assert.ok(summary.successes >= 1);
assert.ok(summary.byProvider.some(item => item.provider === 'groq' && item.requests >= 2));
console.log('AI resilience and telemetry contract passed: circuit transitions, bounded probe, recovery, and persisted usage evidence.');
