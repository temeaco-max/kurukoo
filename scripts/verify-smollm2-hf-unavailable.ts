import assert from 'node:assert/strict';

process.env.KURUKOO_SMOLLM2_LOCAL = 'false';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.HUGGINGFACE_API_KEY = 'test-only-unavailable-provider-key';
process.env.SMOLLM2_MODEL = 'HuggingFaceTB/SmolLM2-1.7B-Instruct';

const { querySmolLM2, querySmolLM2Diagnostics, getSmolLM2RuntimeStatus } = await import('../src/services/smolLm2Service.js');
const first = await querySmolLM2('Can you help me plan this?');
const firstStatus = getSmolLM2RuntimeStatus();
const firstDiagnostics = querySmolLM2Diagnostics();
assert.ok(first.trim(), 'Unavailable hosted inference must still return the bounded deterministic fallback.');
assert.equal(firstStatus.source, 'fallback', 'Unavailable Hugging Face serverless inference must not be attributed as a model response.');
assert.equal(firstStatus.available, false, 'Unavailable Hugging Face serverless inference must report unavailable.');
assert.equal(firstStatus.lastFailure, 'huggingface_provider_unavailable', 'The actual provider-unavailable reason must be preserved.');
assert.equal(firstDiagnostics.executionMode, 'deterministic_fallback', 'The fallback execution mode must be explicit.');
assert.equal(firstDiagnostics.actualModel, 'template-fallback', 'A deterministic fallback must not claim SmolLM2 generated it.');

await querySmolLM2('Can you help me plan the next step?');
const secondDiagnostics = querySmolLM2Diagnostics();
assert.equal(secondDiagnostics.fallbackReason, 'huggingface_provider_unavailable', 'The permanently unavailable selected model must remain cached as unavailable for the process lifetime.');
console.log('Live SmolLM2 unavailable-Hugging-Face verification passed: the tested serverless path returned unavailable, the response was attributed to deterministic fallback, and the selected model remained cached as unavailable.');
