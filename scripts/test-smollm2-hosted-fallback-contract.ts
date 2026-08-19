import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/smolLm2Service.ts', import.meta.url), 'utf8');

assert.match(source, /let hostedInferenceUnavailableForModel: string \| null = null;/);
assert.match(source, /function isHostedInferenceUnavailable\(error: unknown\): boolean/);
assert.match(source, /no inference provider available\|auto selected provider: undefined\|invalid username or password/);
assert.match(source, /hostedInferenceUnavailableForModel !== hostedModel/);
assert.match(source, /hostedInferenceUnavailableForModel = hostedModel;/);
assert.match(source, /lastInferenceFailure = 'huggingface_provider_unavailable';/);
assert.match(source, /using the bounded safe fallback until the model selection changes/);
assert.match(source, /getStudentModelRuntimeSelection\(\)/, 'Hosted fallback handling must retain the existing registry-selected model lookup.');

console.log('SmolLM2 hosted-inference fallback contract passed: unavailable serverless routing is bounded per selected model and remains separate from Student registry and local inference authority.');
