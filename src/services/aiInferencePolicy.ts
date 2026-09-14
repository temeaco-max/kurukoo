/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import type { AIProvider } from './unifiedAiEngine.js';
import { classifyAiRoutingSignal } from './aiRoutingConvergence.js';
import { isAiProviderUsable } from './aiProviderHealth.js';
import { getFeatureFlag } from './featureFlags.js';

export type InferenceTask = 'conversation' | 'support' | 'skill_intake' | 'planning' | 'agent_execution' | 'high_stakes' | 'presentation';
export interface InferenceDecision { provider: AIProvider; reason: string; maxComplexity: 'low' | 'medium' | 'high'; escalationReason?: string; }

type HostedProvider = Exclude<AIProvider, 'auto' | 'smollm2' | 'local_intent'>;
const HOSTED_ESCALATION_ORDER: HostedProvider[] = ['mistral', 'groq', 'gemini', 'openrouter', 'poolside'];

function hostedEnabled(provider: HostedProvider): boolean {
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  if (!isAiProviderUsable(provider)) return false;
  if (provider === 'mistral') return Boolean(process.env.MISTRAL_API_KEY) && getFeatureFlag(country, 'hosted_mistral');
  if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY) && getFeatureFlag(country, 'hosted_groq');
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY) && getFeatureFlag(country, 'hosted_gemini');
  if (provider === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY && String(process.env.OPENROUTER_MODEL || '').trim()) && getFeatureFlag(country, 'hosted_openrouter');
  if (provider === 'poolside') return Boolean(process.env.POOLSIDE_API_KEY) && getFeatureFlag(country, 'hosted_poolside');
  return false;
}

function configuredMistral(): boolean { return hostedEnabled('mistral'); }
function configuredHostedCandidates(): HostedProvider[] { return HOSTED_ESCALATION_ORDER.filter(hostedEnabled); }

// Local fast/default candidates are selected by the local-model policy
// (localModelPolicy.ts: Qwen2.5-0.5B default, SmolLM2 360M fallback).
function localFirst(reason: string, maxComplexity: InferenceDecision['maxComplexity'] = 'medium'): InferenceDecision {
  return { provider: 'smollm2', reason, maxComplexity, escalationReason: 'local_first' };
}

export function chooseInferenceProvider(input: { task: InferenceTask; prompt: string; preferred?: AIProvider }): InferenceDecision {
  if (input.preferred && input.preferred !== 'auto') {
    if (input.preferred === 'smollm2' || input.preferred === 'local_intent') {
      return { provider: input.preferred, reason: 'explicit local provider requested', maxComplexity: input.preferred === 'local_intent' ? 'low' : 'medium' };
    }
    if (input.preferred === 'mistral' || input.preferred === 'groq' || input.preferred === 'gemini' || input.preferred === 'openrouter' || input.preferred === 'poolside') {
      if (hostedEnabled(input.preferred)) return { provider: input.preferred, reason: `explicit ${input.preferred} provider requested`, maxComplexity: 'high', escalationReason: 'explicit_provider_request' };
      return localFirst(`requested ${input.preferred} provider is unavailable; bounded local fallback selected`);
    }
  }

  const signal = classifyAiRoutingSignal(input.prompt);

  if (input.task === 'high_stakes') {
    if (configuredMistral()) return { provider: 'mistral', reason: 'high-stakes reasoning requires the configured Mistral boundary', maxComplexity: 'high', escalationReason: 'high_stakes' };
    return localFirst('no healthy high-stakes hosted provider configured; bounded local fallback', 'medium');
  }

  if (input.task === 'planning' || input.task === 'agent_execution') {
    const candidates = configuredHostedCandidates();
    if (candidates.includes('poolside')) return { provider: 'poolside', reason: 'complex planning and agent execution use the dedicated Poolside reasoning boundary', maxComplexity: 'high', escalationReason: 'planning_or_agent_execution' };
    const hostedFallback = candidates.find(provider => provider !== 'poolside');
    if (hostedFallback) return { provider: hostedFallback, reason: `Poolside unavailable; ${hostedFallback} is the next hosted reasoning escalation`, maxComplexity: 'high', escalationReason: 'planning_poolside_unavailable' };
    return localFirst('no hosted planner available; bounded local fallback', 'medium');
  }

  if (signal.conversationAct && ['greeting', 'thanks', 'farewell', 'confirmation', 'rejection'].includes(signal.conversationAct)) {
    return localFirst(`deterministic conversational act: ${signal.conversationAct}`, 'low');
  }

  if (signal.skill && ['repairs-maintenance', 'transport-mobility', 'accommodation-lodging', 'professional-services', 'logistics-freight'].includes(signal.category || '')) {
    return localFirst(`skill-aware intake for ${signal.skill}; canonical services remain authoritative`, 'medium');
  }

  if (signal.confidence < 0.72 || signal.source === 'none') {
    return localFirst('uncertain routing signal; use bounded local semantic interpretation before hosted escalation', 'medium');
  }

  if (input.task === 'support') return localFirst('routine support uses the local-first conversational boundary', 'low');
  if (input.task === 'presentation') return localFirst('presentation remains on the local conversational first pass', 'low');
  return localFirst('default conversational policy: local model first; hosted providers are escalation only', 'medium');
}
