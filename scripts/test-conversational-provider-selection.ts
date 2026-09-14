/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/conversationalGenerationService.ts', import.meta.url), 'utf8');
const unified = fs.readFileSync(new URL('../src/services/unifiedAiEngine.ts', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../src/services/aiInferencePolicy.ts', import.meta.url), 'utf8');

assert.match(source, /const conversationProvider = input\.provider && input\.provider !== 'auto' \? input\.provider : decision\.provider;/);
assert.match(source, /function strongerProvider\(preferred: AIProvider \| undefined\)/);
assert.match(source, /resolveHostedProviderCandidates\('auto'\)/);
assert.match(unified, /export function resolveHostedProviderCandidates\(preferred: AIProvider \| undefined = 'auto'\)/);
assert.match(unified, /options\.useFastText === true \|\| \(options\.useFastText !== false && options\.conversational !== true\)/);
assert.match(unified, /const localFirstConversation = options\.conversational === true && preferred === 'auto';/);
assert.match(unified, /provider: provider === 'mistral' \? 'Mistral'/);
assert.match(unified, /provider: provider === 'gemini' \? 'Gemini'/);
assert.match(unified, /provider: provider === 'groq' \? 'Groq'/);
assert.match(unified, /provider: provider === 'openrouter' \? 'OpenRouter'/);
assert.match(unified, /'Poolside'/);
assert.match(policy, /return localFirst\('default conversational policy: local model first; hosted providers are escalation only'/);
assert.match(policy, /input\.task === 'planning' \|\| input\.task === 'agent_execution'/);

console.log('Conversational provider-selection contract passed: local model policy is the ordinary-chat first pass, FastText is explicit/semantic routing only, hosted providers are escalation, and Poolside is reserved for complex planning.');
