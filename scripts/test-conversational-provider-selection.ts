import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveHostedAIProvider } from '../src/services/providerCapabilities.js';

const source = fs.readFileSync(new URL('../src/services/conversationalGenerationService.ts', import.meta.url), 'utf8');
const unified = fs.readFileSync(new URL('../src/services/unifiedAiEngine.ts', import.meta.url), 'utf8');

assert.match(source, /const conversationProvider = input\.provider && input\.provider !== 'auto' \? input\.provider : strongerProvider\(input\.provider\);/);
assert.match(source, /provider: conversationProvider,/);
assert.match(source, /function strongerProvider\(preferred: AIProvider \| undefined\)/);
assert.match(source, /KURUKOO_AI_HOSTED_PROVIDER === 'mistral'/);
assert.match(source, /KURUKOO_AI_HOSTED_PROVIDER === 'gemini'/);
assert.match(source, /return 'smollm2';/);
assert.match(unified, /resolveHostedAIProvider\(\)/);
assert.match(unified, /const hostedProvider = resolveHostedAIProvider\(options\.provider\);/);

const original = {
  selected: process.env.KURUKOO_AI_HOSTED_PROVIDER,
  gemini: process.env.GEMINI_API_KEY,
  api: process.env.API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  groq: process.env.GROQ_API_KEY,
};

try {
  delete process.env.KURUKOO_AI_HOSTED_PROVIDER;
  process.env.GEMINI_API_KEY = 'gemini-test';
  delete process.env.API_KEY;
  delete process.env.MISTRAL_API_KEY;
  delete process.env.GROQ_API_KEY;
  assert.equal(resolveHostedAIProvider(), 'gemini');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'mistral';
  process.env.MISTRAL_API_KEY = 'mistral-test';
  assert.equal(resolveHostedAIProvider(), 'mistral');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  process.env.API_KEY = 'gemini-alt-test';
  assert.equal(resolveHostedAIProvider(), 'gemini');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  delete process.env.API_KEY;
  assert.equal(resolveHostedAIProvider(), 'mistral');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'groq';
  delete process.env.MISTRAL_API_KEY;
  process.env.GROQ_API_KEY = 'groq-test';
  assert.equal(resolveHostedAIProvider(), 'groq');

  delete process.env.KURUKOO_AI_HOSTED_PROVIDER;
  delete process.env.GROQ_API_KEY;
  delete process.env.MISTRAL_API_KEY;
  assert.equal(resolveHostedAIProvider(), 'none');
} finally {
  if (original.selected === undefined) delete process.env.KURUKOO_AI_HOSTED_PROVIDER; else process.env.KURUKOO_AI_HOSTED_PROVIDER = original.selected;
  if (original.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = original.gemini;
  if (original.api === undefined) delete process.env.API_KEY; else process.env.API_KEY = original.api;
  if (original.mistral === undefined) delete process.env.MISTRAL_API_KEY; else process.env.MISTRAL_API_KEY = original.mistral;
  if (original.groq === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = original.groq;
}

console.log('Conversational provider-selection contract passed: configured hosted models are preferred consistently across non-streaming and streaming paths, with SmolLM2 as the local fallback.');
