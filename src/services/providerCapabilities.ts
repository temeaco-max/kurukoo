/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getFeatureFlag } from './featureFlags.js';

export type ProviderName = 'local' | 'fasttext' | 'gemini' | 'mistral' | 'groq' | 'openrouter' | 'poolside';
export type ProviderCapability = 'text' | 'transcription' | 'tts' | 'live' | 'vision' | 'moderation';
export type ProviderLimitStatus = 'configured' | 'unknown' | 'unavailable';

export interface ProviderCapabilityStatus {
  configured: boolean;
  available: boolean;
  provider: ProviderName;
  capability: ProviderCapability;
  model?: string;
  limits: { status: ProviderLimitStatus; requestsRemaining?: number; tokensRemaining?: number; note: string };
  note: string;
}
export interface ProviderReadiness { provider: ProviderName; configured: boolean; available: boolean; capabilities: ProviderCapabilityStatus[]; failover: 'none' | 'canonical-local' | 'canonical-template'; }
export type HostedAIProvider = 'mistral' | 'gemini' | 'groq' | 'openrouter' | 'poolside' | 'none';

export function hasConfiguredSecret(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && !['stub', 'unconfigured', 'test', 'test-key'].includes(text) && !text.startsWith('change_me');
}

function enabled(provider: Exclude<HostedAIProvider, 'none'>): boolean {
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  const flag = provider === 'mistral' ? 'hosted_mistral' : provider === 'gemini' ? 'hosted_gemini' : provider === 'groq' ? 'hosted_groq' : provider === 'openrouter' ? 'hosted_openrouter' : 'hosted_poolside';
  return getFeatureFlag(country, flag);
}

function configured(provider: Exclude<HostedAIProvider, 'none'>): boolean {
  if (provider === 'mistral') return hasConfiguredSecret(process.env.MISTRAL_API_KEY) && enabled(provider);
  if (provider === 'gemini') return hasConfiguredSecret(process.env.GEMINI_API_KEY || process.env.API_KEY) && enabled(provider);
  if (provider === 'groq') return hasConfiguredSecret(process.env.GROQ_API_KEY) && enabled(provider);
  if (provider === 'openrouter') return hasConfiguredSecret(process.env.OPENROUTER_API_KEY) && Boolean(String(process.env.OPENROUTER_MODEL || '').trim()) && enabled(provider);
  return hasConfiguredSecret(process.env.POOLSIDE_API_KEY) && enabled(provider);
}

/**
 * Shared hosted-provider capability resolver. It answers only whether a provider
 * is configured and explicitly enabled; reachability remains an execution-time fact.
 */
export function resolveHostedAIProvider(preferred?: string | null): HostedAIProvider {
  const explicit = String(preferred || process.env.KURUKOO_AI_HOSTED_PROVIDER || '').trim().toLowerCase();
  if (['none', 'smollm2', 'local_intent'].includes(explicit)) return 'none';

  const order: Array<Exclude<HostedAIProvider, 'none'>> = ['mistral', 'gemini', 'groq', 'openrouter', 'poolside'];
  const reordered = order.includes(explicit as any)
    ? [explicit as Exclude<HostedAIProvider, 'none'>, ...order.filter(item => item !== explicit)]
    : order;
  return reordered.find(configured) || 'none';
}

export function unknownLimits(note: string): ProviderCapabilityStatus['limits'] {
  return { status: 'unknown', note };
}
