import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = path.join(os.tmpdir(), `kurukoo-hosted-provider-resolution-${process.pid}-${Date.now()}.sqlite`);
const { resolveConfiguredHostedProvider } = await import('../src/services/unifiedAiEngine.js');

const reset = () => {
  delete process.env.MISTRAL_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.API_KEY;
  delete process.env.GROQ_API_KEY;
};

reset();
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'mistral';
process.env.GEMINI_API_KEY = 'configured-gemini-key';
assert.equal(resolveConfiguredHostedProvider(), 'gemini', 'A usable Gemini key must be selected when the requested Mistral provider is unavailable.');

reset();
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'stub';
process.env.GROQ_API_KEY = 'configured-groq-key';
assert.equal(resolveConfiguredHostedProvider(), 'groq', 'A placeholder Gemini value must not block an available Groq fallback.');

reset();
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.GEMINI_API_KEY = 'configured-gemini-key';
assert.equal(resolveConfiguredHostedProvider(), null, 'An explicit disabled hosted-provider setting must not silently create hosted traffic.');

reset();
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'auto';
process.env.MISTRAL_API_KEY = 'configured-mistral-key';
process.env.GEMINI_API_KEY = 'configured-gemini-key';
assert.equal(resolveConfiguredHostedProvider(), 'mistral', 'Automatic provider resolution must retain the documented stable preference order.');

console.log('Hosted conversational provider-resolution regression passed: usable configured providers are selected safely, placeholder credentials are ignored, and explicit local mode remains authoritative.');
