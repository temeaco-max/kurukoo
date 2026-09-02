/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import type { AIProvider } from './unifiedAiEngine.js';
import { isAiProviderUsable } from './aiProviderHealth.js';
import { getFeatureFlag } from './featureFlags.js';
import { hasConfiguredSecret } from './providerCapabilities.js';

export type InferenceTask = 'conversation' | 'support' | 'skill_intake' | 'planning' | 'agent_execution' | 'high_stakes' | 'presentation';
export interface InferenceDecision { provider: AIProvider; reason: string; maxComplexity: 'low'|'medium'|'high'; escalationReason?: string; }

type HostedProvider = Exclude<AIProvider, 'auto' | 'smollm2' | 'local_intent'>;
const HOSTED_FALLBACK_ORDER: HostedProvider[] = ['mistral', 'gemini', 'groq', 'openrouter'];

function country(): string { return process.env.KURUKOO_DEFAULT_COUNTRY || 'ng'; }
function enabled(provider: HostedProvider): boolean {
  const flag = provider === 'mistral' ? 'hosted_mistral' : provider === 'gemini' ? 'hosted_gemini' : provider === 'groq' ? 'hosted_groq' : provider === 'openrouter' ? 'hosted_openrouter' : 'hosted_poolside';
  return getFeatureFlag(country(), flag);
}
function configured(provider: HostedProvider): boolean {
  if (!isAiProviderUsable(provider)) return false;
  if (provider === 'mistral') return hasConfiguredSecret(process.env.MISTRAL_API_KEY) && enabled(provider);
  if (provider === 'gemini') return hasConfiguredSecret(process.env.GEMINI_API_KEY || process.env.API_KEY) && enabled(provider);
  if (provider === 'groq') return hasConfiguredSecret(process.env.GROQ_API_KEY) && enabled(provider);
  if (provider === 'openrouter') return hasConfiguredSecret(process.env.OPENROUTER_API_KEY) && Boolean(String(process.env.OPENROUTER_MODEL || '').trim()) && enabled(provider);
  return hasConfiguredSecret(process.env.POOLSIDE_API_KEY) && enabled(provider);
}
function firstHosted(): HostedProvider | null { return HOSTED_FALLBACK_ORDER.find(configured) || null; }
function poolsideConfigured(): boolean { return configured('poolside'); }

/**
 * Chat policy is intentionally simple:
 * - SmolLM2 is the first pass for ordinary conversation and skill intake.
 * - Hosted providers are escalation, not the default chat engine.
 * - Poolside Laguna XS 2.1 is reserved for planning/agentic/high-complexity work.
 * - Explicit provider selection remains authoritative when callers deliberately choose one.
 */
export function chooseInferenceProvider(input: { task: InferenceTask; prompt: string; preferred?: AIProvider }): InferenceDecision {
  if (input.preferred && input.preferred !== 'auto') {
    if (input.preferred === 'poolside' && !poolsideConfigured()) {
      return { provider: 'smollm2', reason: 'requested Poolside is unavailable; bounded local fallback selected', maxComplexity: 'medium', escalationReason: 'provider_unavailable' };
    }
    if (['mistral','gemini','groq','openrouter'].includes(input.preferred) && !configured(input.preferred as HostedProvider)) {
      return { provider: 'smollm2', reason: `requested ${input.preferred} is unavailable; bounded local fallback selected`, maxComplexity: 'medium', escalationReason: 'provider_unavailable' };
    }
    return { provider: input.preferred, reason: 'caller preference', maxComplexity: input.preferred === 'poolside' ? 'high' : 'medium' };
  }

  if (input.task === 'planning' || input.task === 'agent_execution') {
    if (poolsideConfigured()) return { provider: 'poolside', reason: 'planning/agent execution uses the dedicated complex reasoning provider', maxComplexity: 'high', escalationReason: input.task };
    const hosted = firstHosted();
    if (hosted) return { provider: hosted, reason: `Poolside unavailable; ${hosted} is the configured hosted reasoning fallback`, maxComplexity: 'high', escalationReason: 'poolside_unavailable' };
    return { provider: 'smollm2', reason: 'no hosted reasoning provider is available; bounded local fallback selected', maxComplexity: 'medium', escalationReason: 'no_healthy_hosted_provider' };
  }

  if (input.task === 'high_stakes') {
    const hosted = configured('mistral') ? 'mistral' : firstHosted();
    if (hosted) return { provider: hosted, reason: `${hosted} is the strongest configured hosted boundary for high-stakes response generation`, maxComplexity: 'high', escalationReason: 'high_stakes_hosted' };
    return { provider: 'smollm2', reason: 'no hosted high-stakes provider is configured; local response is bounded and must not execute actions', maxComplexity: 'medium', escalationReason: 'no_healthy_hosted_provider' };
  }

  // Ordinary conversation/support/skill-intake/presentation always begins locally.
  return {
    provider: 'smollm2',
    reason: input.task === 'conversation' ? 'ordinary conversation starts with local SmolLM2' : 'bounded local inference is the first pass; hosted providers are escalation only',
    maxComplexity: input.task === 'skill_intake' ? 'medium' : 'low',
  };
}
