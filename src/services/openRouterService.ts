import { getFeatureFlagStatus } from './featureFlags.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PROMPT_CHARS = 24_000;
const MAX_SYSTEM_CHARS = 12_000;

export type OpenRouterResult = {
  text: string;
  model: string;
  generationId?: string;
  actualProvider?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; cost?: number };
};

export type OpenRouterRuntimeStatus = {
  configured: boolean;
  enabled: boolean;
  model: string | null;
  baseUrl: string;
  reason?: string;
};

function typedError(code: string, message: string, retryable = false): Error & { code: string; retryable: boolean } {
  return Object.assign(new Error(message), { code, retryable });
}

function settings() {
  const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
  const model = String(process.env.OPENROUTER_MODEL || '').trim();
  const baseUrl = String(process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const timeoutMs = Math.max(1_000, Math.min(60_000, Number(process.env.OPENROUTER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS));
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  const feature = getFeatureFlagStatus(country, 'hosted_openrouter');
  return { apiKey, model, baseUrl, timeoutMs, configured: Boolean(apiKey && model), enabled: feature.enabled, featureFlagState: feature.status };
}

function errorCodeForStatus(status: number): { code: string; retryable: boolean } {
  if (status === 401 || status === 403) return { code: 'OPENROUTER_AUTH_FAILED', retryable: false };
  if (status === 402) return { code: 'OPENROUTER_CREDITS_REQUIRED', retryable: false };
  if (status === 400 || status === 413 || status === 422) return { code: 'OPENROUTER_REQUEST_INVALID', retryable: false };
  if (status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 524 || status === 529) return { code: 'OPENROUTER_TEMPORARILY_UNAVAILABLE', retryable: true };
  return { code: 'OPENROUTER_REQUEST_FAILED', retryable: status >= 500 };
}

function strings(value: unknown, limit: number): string {
  return String(value || '').trim().slice(0, limit);
}

export function getOpenRouterRuntimeStatus(): OpenRouterRuntimeStatus {
  const current = settings();
  const reason = !current.configured
    ? 'OpenRouter requires an API key and an explicit approved model.'
    : !current.enabled
      ? 'OpenRouter is configured but disabled by feature flag.'
      : undefined;
  return { configured: current.configured, enabled: current.enabled, model: current.model || null, baseUrl: current.baseUrl, ...(reason ? { reason } : {}) };
}

export async function queryOpenRouter(prompt: string, options: { systemInstruction?: string; temperature?: number; user?: string } = {}): Promise<OpenRouterResult> {
  const current = settings();
  if (!current.configured) throw typedError('OPENROUTER_NOT_CONFIGURED', 'OpenRouter requires an API key and an explicit approved model.');
  if (!current.enabled) throw typedError('OPENROUTER_FEATURE_DISABLED', 'OpenRouter is disabled by feature flag.');
  const userPrompt = strings(prompt, MAX_PROMPT_CHARS);
  if (!userPrompt) throw typedError('OPENROUTER_PROMPT_INVALID', 'OpenRouter requires a non-empty prompt.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), current.timeoutMs);
  try {
    const base = String(process.env.KURUKOO_PUBLIC_BASE_URL || '').trim();
    const response = await fetch(`${current.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${current.apiKey}`,
        'Content-Type': 'application/json',
        'X-OpenRouter-Metadata': 'enabled',
        ...(base ? { 'HTTP-Referer': base } : {}),
        'X-OpenRouter-Title': 'Kurukoo',
      },
      body: JSON.stringify({
        model: current.model,
        messages: [
          ...(options.systemInstruction ? [{ role: 'system', content: strings(options.systemInstruction, MAX_SYSTEM_CHARS) }] : []),
          { role: 'user', content: userPrompt },
        ],
        temperature: Math.max(0, Math.min(2, Number.isFinite(options.temperature) ? Number(options.temperature) : 0.4)),
        max_tokens: Math.max(32, Math.min(1_024, Number(process.env.OPENROUTER_MAX_TOKENS) || 384)),
        stream: false,
        ...(options.user ? { user: strings(options.user, 256) } : {}),
      }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, any>;
    if (!response.ok) {
      const mapped = errorCodeForStatus(response.status);
      throw typedError(mapped.code, `OpenRouter request was not accepted (HTTP ${response.status}).`, mapped.retryable);
    }
    const text = strings(body?.choices?.[0]?.message?.content, 40_000);
    if (!text) throw typedError('OPENROUTER_RESPONSE_INVALID', 'OpenRouter returned no usable assistant content.');
    const metadata = body.openrouter_metadata || {};
    const endpoints = Array.isArray(metadata?.endpoints?.available) ? metadata.endpoints.available : [];
    const selected = endpoints.find((entry: any) => entry && entry.selected);
    const usage = body.usage || {};
    return {
      text,
      model: strings(body.model || current.model, 200),
      ...(body.id ? { generationId: strings(body.id, 256) } : {}),
      ...(selected?.provider ? { actualProvider: strings(selected.provider, 200) } : {}),
      usage: { promptTokens: Number(usage.prompt_tokens) || undefined, completionTokens: Number(usage.completion_tokens) || undefined, totalTokens: Number(usage.total_tokens) || undefined, cost: Number(usage.cost) || undefined },
    };
  } catch (cause) {
    if ((cause as { name?: string })?.name === 'AbortError') throw typedError('OPENROUTER_TIMEOUT', 'OpenRouter request timed out.', true);
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}
