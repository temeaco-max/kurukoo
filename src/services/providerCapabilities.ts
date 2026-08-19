export type ProviderName = 'local' | 'fasttext' | 'gemini' | 'mistral' | 'groq';
export type ProviderCapability = 'text' | 'transcription' | 'tts' | 'live' | 'vision' | 'moderation';
export type ProviderLimitStatus = 'configured' | 'unknown' | 'unavailable';

export interface ProviderCapabilityStatus {
  configured: boolean;
  available: boolean;
  provider: ProviderName;
  capability: ProviderCapability;
  model?: string;
  limits: {
    status: ProviderLimitStatus;
    requestsRemaining?: number;
    tokensRemaining?: number;
    note: string;
  };
  note: string;
}

export interface ProviderReadiness {
  provider: ProviderName;
  configured: boolean;
  available: boolean;
  capabilities: ProviderCapabilityStatus[];
  failover: 'none' | 'canonical-local' | 'canonical-template';
}

export type HostedAIProvider = 'gemini' | 'mistral' | 'groq' | 'none';

export function hasConfiguredSecret(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return Boolean(text) && !['stub', 'unconfigured'].includes(text) && !text.startsWith('change_me');
}

/**
 * Resolve the configured hosted conversational provider from explicit preference
 * first, then from actually configured credentials. This keeps all AI entrypoints
 * (including streaming) on the same provider-selection contract.
 */
export function resolveHostedAIProvider(preferred?: string | null): HostedAIProvider {
  const explicit = String(preferred || process.env.KURUKOO_AI_HOSTED_PROVIDER || '').trim().toLowerCase();
  const hasGemini = hasConfiguredSecret(process.env.GEMINI_API_KEY || process.env.API_KEY);
  const hasMistral = hasConfiguredSecret(process.env.MISTRAL_API_KEY);
  const hasGroq = hasConfiguredSecret(process.env.GROQ_API_KEY);

  if (explicit === 'gemini' && hasGemini) return 'gemini';
  if (explicit === 'mistral' && hasMistral) return 'mistral';
  if (explicit === 'groq' && hasGroq) return 'groq';

  // Explicitly requested but unavailable: fall through to the strongest
  // actually-configured provider instead of reporting "none" and losing a
  // usable hosted model.
  if (hasGemini) return 'gemini';
  if (hasMistral) return 'mistral';
  if (hasGroq) return 'groq';
  return 'none';
}

export function unknownLimits(note: string): ProviderCapabilityStatus['limits'] {
  return { status: 'unknown', note };
}
