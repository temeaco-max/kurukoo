/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-provider-policy-${process.pid}-${Date.now()}.sqlite`;
const { chooseInferenceProvider } = await import('../src/services/aiInferencePolicy.js');

const source = fs.readFileSync(path.join(process.cwd(), 'src/services/unifiedAiEngine.ts'), 'utf8');

assert.equal(chooseInferenceProvider({ task: 'conversation', prompt: 'hello' }).provider, 'smollm2', 'ordinary conversation must begin with SmolLM2');
assert.equal(chooseInferenceProvider({ task: 'support', prompt: 'how do I use this?' }).provider, 'smollm2', 'support conversation must begin with SmolLM2');
assert.equal(chooseInferenceProvider({ task: 'skill_intake', prompt: 'I need my phone repaired' }).provider, 'smollm2', 'skill intake must begin with SmolLM2');
assert.equal(chooseInferenceProvider({ task: 'presentation', prompt: 'explain the confirmed result' }).provider, 'smollm2', 'presentation should not unexpectedly bypass the local first pass');

assert.equal(chooseInferenceProvider({ task: 'conversation', prompt: 'hello', preferred: 'mistral' }).provider, 'smollm2', 'unavailable explicit hosted providers must fail closed to local inference');
assert(source.includes('useFastText?: boolean'), 'Unified AI must expose an explicit FastText boundary');
assert(source.includes("options.useFastText === true || (options.useFastText !== false && options.conversational !== true)"), 'Unified AI must keep FastText out of ordinary conversational calls');
assert(source.includes('localFirstConversation'), 'Unified AI must have an explicit local-first conversational path');
assert(source.includes("provider: provider === 'mistral' ? 'Mistral'"), 'Hosted provider responses must retain truthful provider identity');
assert(source.includes("provider: 'poolside'"), 'Unified AI must retain the dedicated Poolside provider');

console.log('AI provider policy contract passed: SmolLM2-first conversation, explicit FastText routing boundaries, hosted escalation, and dedicated Poolside planning are aligned.');
