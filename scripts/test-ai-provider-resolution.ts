import { resolveHostedAIProvider } from '../src/services/providerCapabilities.js';

const original = {
  selected: process.env.KURUKOO_AI_HOSTED_PROVIDER,
  gemini: process.env.GEMINI_API_KEY,
  api: process.env.API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  groq: process.env.GROQ_API_KEY,
};

function restore() {
  if (original.selected === undefined) delete process.env.KURUKOO_AI_HOSTED_PROVIDER; else process.env.KURUKOO_AI_HOSTED_PROVIDER = original.selected;
  if (original.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = original.gemini;
  if (original.api === undefined) delete process.env.API_KEY; else process.env.API_KEY = original.api;
  if (original.mistral === undefined) delete process.env.MISTRAL_API_KEY; else process.env.MISTRAL_API_KEY = original.mistral;
  if (original.groq === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = original.groq;
}

try {
  delete process.env.KURUKOO_AI_HOSTED_PROVIDER;
  process.env.GEMINI_API_KEY = 'gemini-test';
  delete process.env.API_KEY;
  delete process.env.MISTRAL_API_KEY;
  delete process.env.GROQ_API_KEY;
  if (resolveHostedAIProvider() !== 'gemini') throw new Error('Configured Gemini must be selected when no explicit provider is set.');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'mistral';
  process.env.MISTRAL_API_KEY = 'mistral-test';
  if (resolveHostedAIProvider() !== 'mistral') throw new Error('Explicitly configured Mistral must be selected.');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  process.env.API_KEY = 'gemini-alt-test';
  if (resolveHostedAIProvider() !== 'gemini') throw new Error('Gemini alternate API key must count as configured.');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  delete process.env.API_KEY;
  process.env.MISTRAL_API_KEY = 'mistral-test';
  if (resolveHostedAIProvider() !== 'mistral') throw new Error('Unavailable explicit provider must fall through to an actually configured provider.');

  process.env.KURUKOO_AI_HOSTED_PROVIDER = 'groq';
  delete process.env.MISTRAL_API_KEY;
  process.env.GROQ_API_KEY = 'groq-test';
  if (resolveHostedAIProvider() !== 'groq') throw new Error('Configured Groq must be selected when explicitly requested.');

  delete process.env.KURUKOO_AI_HOSTED_PROVIDER;
  delete process.env.GROQ_API_KEY;
  delete process.env.MISTRAL_API_KEY;
  if (resolveHostedAIProvider() !== 'none') throw new Error('No configured hosted provider must resolve to none.');

  console.log('AI provider-resolution contract passed.');
} finally {
  restore();
}
