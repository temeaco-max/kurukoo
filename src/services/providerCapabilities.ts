/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
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

function featureEnabled(name: string): boolean {
  const flag = `FF_${name.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`;
  return String(process.env[flag] ?? '').trim().toLowerCase() === 'true';
}

/**
 * Shared hosted-provider availability contract for capability/readiness surfaces.
 * Conversation routing has an additional task-specific policy in aiInferencePolicy.
 * This resolver never treats credentials as reachability; a provider is eligible
 * only when configured and explicitly enabled.
 */
export function resolveHostedAIProvider(preferred?: string | null): HostedAIProvider {
  const explicit = String(preferred || process.env.KURUKOO_AI_HOSTED_PROVIDER || '').trim().toLowerCase();
  const configured: Array<{ name: Exclude<HostedAIProvider, 'none'>; ok: boolean }> = [
    { name: 'mistral', ok: hasConfiguredSecret(process.env.MISTRAL_API_KEY) && (featureEnabled('HOSTED_MISTRAL') || preferred === 'mistral') },
    { name: 'gemini', ok: hasConfiguredSecret(process.env.GEMINI_API_KEY || process.env.API_KEY) && (featureEnabled('HOSTED_GEMINI') || preferred === 'gemini') },
    { name: 'groq', ok: hasConfiguredSecret(process.env.GROQ_API_KEY) && (featureEnabled('HOSTED_GROQ') || preferred === 'groq') },
    { name: 'openrouter', ok: hasConfiguredSecret(process.env.OPENROUTER_API_KEY) && Boolean(String(process.env.OPENROUTER_MODEL || '').trim()) && (featureEnabled('HOSTED_OPENROUTER') || preferred === 'openrouter') },
    { name: 'poolside', ok: hasConfiguredSecret(process.env.POOLSIDE_API_KEY) && (featureEnabled('HOSTED_POOLSIDE') || preferred === 'poolside') },
  ];
  if (explicit === 'none' || explicit === 'smollm2' || explicit === 'local_intent') return 'none';
  const requested = configured.find(item => item.name === explicit && item.ok);
  if (requested) return requested.name;
  return configured.find(item => item.ok)?.name || 'none';
}

export function unknownLimits(note: string): ProviderCapabilityStatus['limits'] {
  return { status: 'unknown', note };
}
