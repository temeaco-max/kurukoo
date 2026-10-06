/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-inference-policy-${process.pid}-${Date.now()}.sqlite`;
const { chooseInferenceProvider } = await import('../src/services/aiInferencePolicy.js');

const hello = chooseInferenceProvider({ task: 'conversation', prompt: 'hello' });
assert.equal(hello.provider, 'smollm2');
assert.equal(hello.maxComplexity, 'low');

const repair = chooseInferenceProvider({ task: 'skill_intake', prompt: 'My iPhone 13 screen is broken and I need collection and same-day return' });
assert.equal(repair.provider, 'smollm2');
assert.notEqual(repair.maxComplexity, 'low');

const unclear = chooseInferenceProvider({ task: 'conversation', prompt: 'I need that thing sorted somehow' });
assert.equal(unclear.provider, 'smollm2');

const support = chooseInferenceProvider({ task: 'support', prompt: 'how do I unlink my phone?' });
assert.equal(support.provider, 'smollm2');

const planning = chooseInferenceProvider({ task: 'planning', prompt: 'map the steps for a complex multi-provider outcome' });
assert.ok(['smollm2', 'mistral', 'groq', 'gemini', 'openrouter', 'poolside'].includes(planning.provider));

console.log('AI inference policy regression passed: ordinary conversation and skill intake are SmolLM2-first, with hosted escalation reserved for explicit or complex cases.');
