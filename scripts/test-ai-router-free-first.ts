/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-router-free-first-${process.pid}-${Date.now()}.sqlite`;
const { chooseInferenceProvider } = await import('../src/services/aiInferencePolicy.js');

process.env.KURUKOO_AI_FREE_FIRST = 'true';
process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'test-mistral-key';
process.env.FF_HOSTED_MISTRAL = 'true';
const simple = chooseInferenceProvider({ task: 'conversation', prompt: 'What is the weather today?' });
assert.ok(['smollm2','groq','gemini','openrouter'].includes(simple.provider), `unexpected simple provider: ${simple.provider}`);
const complex = chooseInferenceProvider({ task: 'planning', prompt: 'Compare these options and coordinate the booking.' });
assert.ok(['smollm2','groq','gemini','openrouter','mistral'].includes(complex.provider), `unexpected complex provider: ${complex.provider}`);
const explicit = chooseInferenceProvider({ task: 'conversation', prompt: 'hello', preferred: 'mistral' });
assert.equal(explicit.provider, 'mistral');
console.log(JSON.stringify({ passed: true, simple: simple.provider, complex: complex.provider, explicit: explicit.provider }, null, 2));
