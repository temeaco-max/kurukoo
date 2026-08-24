import {
  hasConfiguredSecret,
  type ProviderCapabilityStatus,
  type ProviderReadiness,
  unknownLimits,
} from './providerCapabilities.js';
import { buildConversationTurnContract, buildConversationalSystemDirective } from './conversationTurnContractService.js';
import { getFeatureFlag } from './featureFlags.js';

export class PoolsideProviderError extends Error {
  readonly code: 'POOLSIDE_NOT_CONFIGURED' | 'POOLSIDE_DISABLED' | 'POOLSIDE_REQUEST_FAILED' | 'POOLSIDE_EMPTY_RESPONSE';

  constructor(code: PoolsideProviderError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PoolsideProviderError';
    this.code = code;
  }
}

export interface PoolsideChatOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  conversationalContract?: boolean;
}

function getPoolsideApiKey(): string {
  return String(process.env.POOLSIDE_API_KEY || '').trim();
}

function getPoolsideApiBase(): string {
  const base = String(process.env.POOLSIDE_API_BASE || 'https://inference.poolside.ai/v1').replace(/\/$/, '');
  return base;
}

function getPoolsideModel(): string {
  return String(process.env.POOLSIDE_MODEL || 'poolside/laguna-xs-2.1').trim();
}

function getPoolsideTimeoutMs(): number {
  return Number(process.env.POOLSIDE_TIMEOUT_MS || 15_000);
}

export function getActivePoolsideModel(): string {
  return getPoolsideModel();
}

export function getPoolsideStatus(): {
  configured: boolean;
  enabled: boolean;
  reachable: boolean;
  model: string;
  base: string;
  note: string;
} {
  const key = getPoolsideApiKey();
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  const configured = hasConfiguredSecret(key);
  const enabled = getFeatureFlag(country, 'hosted_poolside');
  const note = !configured
    ? 'Poolside is not configured: POOLSIDE_API_KEY is not set.'
    : !enabled
      ? 'Poolside is configured but the hosted_poolside feature flag is disabled.'
      : 'Poolside is configured and the feature flag is enabled.';
  return { configured, enabled, reachable: configured && enabled, model: getPoolsideModel(), base: getPoolsideApiBase(), note };
}

function augmentConversationInstruction(prompt: string, base: string, enabled: boolean): string {
  if (!enabled) return base;
  const contract = buildConversationTurnContract({ userMessage: prompt, latestUserMessage: prompt, assistantReply: '' });
  return `${base}\n\n${buildConversationalSystemDirective(contract)}`;
}

export async function queryPoolside(prompt: string, options: PoolsideChatOptions = {}): Promise<string> {
  const key = getPoolsideApiKey();
  if (!hasConfiguredSecret(key)) {
    throw new PoolsideProviderError('POOLSIDE_NOT_CONFIGURED', 'Poolside is not configured: POOLSIDE_API_KEY is missing.');
  }
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  if (!getFeatureFlag(country, 'hosted_poolside')) {
    throw new PoolsideProviderError('POOLSIDE_DISABLED', 'Poolside is disabled via the hosted_poolside feature flag.');
  }
  if (!String(prompt || '').trim()) {
    throw new PoolsideProviderError('POOLSIDE_REQUEST_FAILED', 'Poolside requires a non-empty prompt.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getPoolsideTimeoutMs());

  try {
    const baseSystemInstruction =
      options.systemInstruction ||
      'You are Kurukoo, a concise and evidence-based utility assistant. Never claim an external action without authoritative confirmation.';
    const systemInstruction = augmentConversationInstruction(prompt, baseSystemInstruction, options.conversationalContract !== false);

    const response = await fetch(`${getPoolsideApiBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: options.signal || controller.signal,
      body: JSON.stringify({
        model: getPoolsideModel(),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxOutputTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      throw new PoolsideProviderError('POOLSIDE_REQUEST_FAILED', `Poolside request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      throw new PoolsideProviderError('POOLSIDE_EMPTY_RESPONSE', 'Poolside returned no usable response.');
    }
        return text;
  } catch (error) {
    if (error instanceof PoolsideProviderError) throw error;
    throw new PoolsideProviderError('POOLSIDE_REQUEST_FAILED', 'Poolside request failed; no synthetic fallback response was generated.', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export async function testPoolsideConnection(): Promise<{ configured: boolean; reachable: boolean; status: number; note: string }> {
  const key = getPoolsideApiKey();
  const configured = hasConfiguredSecret(key);
  if (!configured) {
    return { configured: false, reachable: false, status: 0, note: 'Poolside API key is not configured.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getPoolsideTimeoutMs());
  try {
    const response = await fetch(`${getPoolsideApiBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: getPoolsideModel(),
        messages: [{ role: 'user', content: 'Reply exactly: POOLSIDE_OK' }],
        temperature: 0,
        max_tokens: 16,
      }),
    });
    const note =
      'Poolside endpoint responded; account limits, production suitability and cost remain unverified.';
    if (!response.ok) {
      return { configured: true, reachable: false, status: response.status, note: `Poolside chat endpoint returned HTTP ${response.status}. ${note}` };
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    const reachable = text.length > 0;
    return { configured: true, reachable, status: response.status, note: `${note} Response received.` };
  } catch {
    return { configured: true, reachable: false, status: 0, note: 'Poolside endpoint could not be reached; no provider availability is claimed.' };
  } finally {
    clearTimeout(timeout);
  }
}

export const poolsideProviderCapabilities: ProviderReadiness = {
  provider: 'poolside',
  configured: false,
  available: false,
  capabilities: [],
  failover: 'canonical-local',
};

export function getPoolsideProviderReadiness(): ProviderReadiness {
  const status = getPoolsideStatus();
  return {
    provider: 'poolside',
    configured: status.configured,
    available: status.reachable,
    capabilities: status.reachable
      ? [{
          configured: true,
          available: true,
          provider: 'poolside',
          capability: 'text',
          model: getPoolsideModel(),
          limits: unknownLimits('Poolside text-chat capability is configured; explicit limits are unknown.'),
          note: 'Poolside Laguna XS 2.1 hosted text chat.',
        }]
      : [{
          configured: status.configured,
          available: false,
          provider: 'poolside',
          capability: 'text',
          model: getPoolsideModel(),
          limits: unknownLimits(status.note),
          note: status.note,
        }],
    failover: 'canonical-local',
  };
}

export function getPoolsideCapabilityStatus(): ProviderCapabilityStatus | null {
  const readiness = getPoolsideProviderReadiness();
  return readiness.capabilities[0] || null;
}


