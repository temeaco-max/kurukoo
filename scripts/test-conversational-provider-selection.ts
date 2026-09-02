/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/conversationalGenerationService.ts', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../src/services/aiInferencePolicy.ts', import.meta.url), 'utf8');
const unified = fs.readFileSync(new URL('../src/services/unifiedAiEngine.ts', import.meta.url), 'utf8');

assert(source.includes("const conversationProvider = input.provider && input.provider !== 'auto' ? input.provider : decision.provider;"), 'Conversation generation must use the shared inference decision for automatic routing.');
assert(source.includes("if (generationMode === 'generate' && conversationProvider === 'smollm2' && response.provider === 'Kurukoo Template')"), 'Local-first chat must escalate when SmolLM2 cannot produce a real response.');
assert(source.includes("const providers: AiProvider[] = ['mistral','gemini','groq','openrouter','poolside'];"), 'Provider health must include Poolside.');
assert(policy.includes("ordinary conversation starts with local SmolLM2"), 'Ordinary conversation must start with SmolLM2.');
assert(policy.includes("input.task === 'planning' || input.task === 'agent_execution'"), 'Planning and agent execution must have their own provider tier.');
assert(policy.includes("poolsideConfigured()"), 'Poolside must be reserved for complex planning/agentic work when configured.');
assert(policy.includes("HOSTED_FALLBACK_ORDER: HostedProvider[] = ['mistral', 'gemini', 'groq', 'openrouter']"), 'Poolside must not be part of the routine hosted escalation order.');
assert(unified.includes("export type AIProvider = 'auto' | 'gemini' | 'mistral' | 'smollm2' | 'groq' | 'openrouter' | 'local_intent' | 'poolside';"), 'Unified AI must expose all agreed providers.');
assert(unified.includes("provider: provider === 'mistral' ? 'Mistral'"), 'Unified AI must retain canonical hosted execution labels.');

console.log('Conversational provider-selection contract passed: SmolLM2 is the local-first chat pass, hosted providers are escalation boundaries, and Poolside is reserved for complex planning/agentic work.');
