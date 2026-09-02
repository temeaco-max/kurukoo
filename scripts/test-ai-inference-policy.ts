/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import { chooseInferenceProvider } from '../src/services/aiInferencePolicy.js';

const hello = chooseInferenceProvider({ task: 'conversation', prompt: 'hello' });
assert.equal(hello.provider, 'smollm2');
assert.equal(hello.maxComplexity, 'low');

const repair = chooseInferenceProvider({ task: 'skill_intake', prompt: 'My iPhone 13 screen is broken and I need collection and same-day return' });
assert.equal(repair.provider, 'smollm2');
assert.equal(repair.maxComplexity, 'medium');

const unclear = chooseInferenceProvider({ task: 'conversation', prompt: 'I need that thing sorted somehow' });
assert.equal(unclear.provider, 'smollm2');

const support = chooseInferenceProvider({ task: 'support', prompt: 'how do I unlink my phone?' });
assert.equal(support.provider, 'smollm2');

const planning = chooseInferenceProvider({ task: 'planning', prompt: 'plan a multi-step fulfilment flow' });
assert.ok(['smollm2', 'mistral', 'gemini', 'groq', 'openrouter', 'poolside'].includes(planning.provider));
assert.equal(planning.maxComplexity, 'high');

console.log('AI inference policy regression passed: local-first conversation is stable and complex planning has an explicit high-complexity path.');
