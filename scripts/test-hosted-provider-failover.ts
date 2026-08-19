import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(os.tmpdir(), `kurukoo-hosted-failover-${process.pid}-${Date.now()}.sqlite`);
process.env.KURUKOO_SMOLLM2_LOCAL = 'false';
process.env.KURUKOO_AGENT_ENABLED = 'false';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'auto';

const originalFetch = globalThis.fetch;
const resetProviders = () => {
  delete process.env.MISTRAL_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.API_KEY;
  delete process.env.GROQ_API_KEY;
};
const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

const { queryUnifiedAI, resolveHostedProviderCandidates, getLastAiRoutingDiagnostic } = await import('../src/services/unifiedAiEngine.js');

resetProviders();
process.env.GEMINI_API_KEY = 'configured-gemini-key';
assert.deepEqual(resolveHostedProviderCandidates('auto'), ['gemini'], 'Configured Gemini must be eligible when it is the only usable hosted provider.');

resetProviders();
process.env.MISTRAL_API_KEY = 'configured-mistral-key';
assert.deepEqual(resolveHostedProviderCandidates('auto'), ['mistral'], 'Configured Mistral must be eligible when it is the only usable hosted provider.');

resetProviders();
process.env.GROQ_API_KEY = 'configured-groq-key';
assert.deepEqual(resolveHostedProviderCandidates('auto'), ['groq'], 'Configured Groq must be eligible when it is the only usable hosted provider.');

resetProviders();
process.env.MISTRAL_API_KEY = 'configured-mistral-key';
process.env.GROQ_API_KEY = 'configured-groq-key';
globalThis.fetch = async (url: string | URL | Request) => {
  const target = String(url);
  if (target.includes('api.mistral.ai')) return json(503, { error: 'simulated Mistral outage' });
  if (target.includes('api.groq.com')) return json(200, { choices: [{ message: { content: 'Groq recovered the configured hosted-provider request.' } }] });
  throw new Error(`Unexpected provider URL: ${target}`);
};
try {
  const response = await queryUnifiedAI('Please explain the safe route in one sentence.', { provider: 'mistral', conversational: true });
  assert.equal(response.provider, 'Groq', 'A failed configured Mistral request must fall through to the next configured hosted provider.');
  assert.equal(response.model, process.env.GROQ_MODEL || 'llama-3.1-8b-instant', 'Actual selected Groq model must be reported.');
  assert.match(response.text, /Groq recovered/i, 'Failover must return the actual fallback provider response.');
  const diagnostic = getLastAiRoutingDiagnostic();
  assert.equal(diagnostic?.requestedProvider, 'mistral', 'Diagnostics must preserve the requested provider.');
  assert.deepEqual(diagnostic?.attemptedProviders, ['mistral', 'groq'], 'Diagnostics must preserve the actual configured failover order.');
  assert.equal(diagnostic?.actualProvider, 'Groq', 'Diagnostics must record the provider that produced the response.');
  assert.equal(diagnostic?.actualModel, process.env.GROQ_MODEL || 'llama-3.1-8b-instant', 'Diagnostics must record the actual selected model.');
  assert.equal(diagnostic?.executionMode, 'hosted_provider', 'Diagnostics must distinguish hosted-provider execution from local or deterministic paths.');
  assert.equal(diagnostic?.success, true, 'A returned Groq response must be recorded as success.');
} finally {
  globalThis.fetch = originalFetch;
}

resetProviders();
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'auto';
const fallback = await queryUnifiedAI('Hello there', { conversational: false });
assert.equal(fallback.provider, 'Kurukoo Template', 'No configured provider and unavailable local mode must be attributed as deterministic fallback.');
assert.equal(fallback.model, 'template-fallback', 'Deterministic fallback must not be attributed to SmolLM2 or a hosted provider.');
const fallbackDiagnostic = getLastAiRoutingDiagnostic();
assert.equal(fallbackDiagnostic?.actualProvider, 'Kurukoo Template', 'Fallback diagnostics must identify the deterministic provider.');
assert.equal(fallbackDiagnostic?.executionMode, 'deterministic_fallback', 'Fallback diagnostics must record deterministic execution.');
assert.equal(fallbackDiagnostic?.success, false, 'Fallback diagnostics must never report model success.');

console.log('Hosted provider failover regression passed: Gemini/Mistral/Groq configuration discovery, Mistral-to-Groq selected-provider attribution, and deterministic fallback are all explicit.');
