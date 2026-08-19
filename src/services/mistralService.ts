import { hasConfiguredSecret, unknownLimits, type ProviderCapabilityStatus, type ProviderReadiness } from './providerCapabilities.js';
import { buildConversationTurnContract, buildConversationalSystemDirective } from './conversationTurnContractService.js';
import { getFeatureFlag } from './featureFlags.js';

export class MistralProviderError extends Error {
  readonly code: 'MISTRAL_NOT_CONFIGURED' | 'MISTRAL_DISABLED' | 'MISTRAL_REQUEST_FAILED' | 'MISTRAL_EMPTY_RESPONSE';

  constructor(code: MistralProviderError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MistralProviderError';
    this.code = code;
  }
}

export interface MistralChatOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  conversationalContract?: boolean;
}

export interface MistralTranscriptionInput {
  data: Buffer;
  mimeType: string;
  filename?: string;
  language?: string;
  signal?: AbortSignal;
}

export interface MistralTranscriptionResult {
  text: string;
  model: string;
  language?: string;
}

function transcriptionModel(): string {
  return String(process.env.MISTRAL_TRANSCRIPTION_MODEL || 'voxtral-mini-latest').trim();
}

function transcriptionEnabled(): boolean {
  return process.env.KURUKOO_MISTRAL_TRANSCRIPTION_ENABLED === 'true';
}

let lastConnection: { keyMarker: string; reachable: boolean; testedAt: string; note: string } | null = null;

function keyMarker(value: string): string { return `${value.length}:${value.slice(-4)}`; }
function rememberConnection(key: string, reachable: boolean, note: string): void {
  lastConnection = { keyMarker: keyMarker(key), reachable, testedAt: new Date().toISOString(), note };
}
function connectionVerified(key: string): boolean {
  return Boolean(lastConnection && lastConnection.keyMarker === keyMarker(key) && lastConnection.reachable);
}
function mistralEnabled(): boolean { return getFeatureFlag(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'hosted_mistral'); }
function apiKey(): string {
  const value = String(process.env.MISTRAL_API_KEY || '').trim();
  if (!hasConfiguredSecret(value)) throw new MistralProviderError('MISTRAL_NOT_CONFIGURED', 'Mistral is not configured for this deployment.');
  if (!mistralEnabled()) throw new MistralProviderError('MISTRAL_DISABLED', 'Mistral external execution is disabled by feature flag.');
  return value;
}

export function getMistralModel(): string {
  return String(process.env.MISTRAL_MODEL || 'mistral-small-latest').trim();
}

export function getMistralStatus(): ProviderReadiness {
  const configured = hasConfiguredSecret(process.env.MISTRAL_API_KEY);
  const enabled = mistralEnabled();
  const verified = configured && enabled && connectionVerified(String(process.env.MISTRAL_API_KEY || '').trim());
  const text: ProviderCapabilityStatus = {
    configured,
    available: verified,
    provider: 'mistral',
    capability: 'text',
    model: getMistralModel(),
    limits: configured
      ? unknownLimits('Mistral account limits are not exposed by environment configuration; no allowance is assumed.')
      : { status: 'unavailable', note: 'MISTRAL_API_KEY is not configured.' },
    note: !configured
      ? 'Optional hosted text generation is not configured.'
      : !enabled
        ? 'Mistral credentials are present, but external execution is disabled by feature flag.'
      : verified
        ? 'Mistral models endpoint was independently verified in this process; routing policy must still select it.'
        : 'Mistral credentials are present, but provider availability is unverified until the protected connection test succeeds.',
  };
  return {
    provider: 'mistral',
    configured,
    available: verified,
    capabilities: [
      text,
      { ...text, capability: 'transcription', model: transcriptionModel(), available: verified && transcriptionEnabled(), note: !configured ? 'MISTRAL_API_KEY is not configured.' : !verified ? 'Mistral credentials are present, but provider availability is unverified until the protected connection test succeeds.' : transcriptionEnabled() ? 'Voxtral transcription is available through the bounded voice audio boundary; provider limits remain deployment-dependent.' : 'Voxtral transcription is configured but disabled by feature flag.', limits: configured ? unknownLimits('Mistral transcription limits are not safely discoverable from environment configuration.') : { status: 'unavailable', note: 'MISTRAL_API_KEY is not configured.' } },
      { ...text, capability: 'tts', model: String(process.env.MISTRAL_TTS_MODEL || ''), available: false, note: 'No verified Mistral TTS adapter is present in the current repository; no audio is fabricated.', limits: { status: 'unavailable', note: 'Mistral TTS is not implemented at this boundary.' } },
      { ...text, capability: 'vision', model: String(process.env.MISTRAL_VISION_MODEL || 'pixtral-large-latest'), available: false, note: 'Vision is not selected without a canonical attachment/evidence owner and explicit enablement.', limits: configured ? unknownLimits('Mistral vision limits are not safely discoverable from environment configuration.') : { status: 'unavailable', note: 'MISTRAL_API_KEY is not configured.' } },
      { ...text, capability: 'moderation', available: false, note: 'Mistral moderation is not assumed or silently substituted for the existing moderation boundary.', limits: { status: 'unavailable', note: 'No Mistral moderation adapter is implemented at this boundary.' } },
    ],
    failover: 'canonical-local',
  };
}

export async function transcribeMistralAudio(input: MistralTranscriptionInput): Promise<MistralTranscriptionResult> {
  if (!input?.data?.length) throw new MistralProviderError('MISTRAL_REQUEST_FAILED', 'Mistral transcription requires audio data.');
  if (input.data.length > 10 * 1024 * 1024) throw new MistralProviderError('MISTRAL_REQUEST_FAILED', 'Mistral transcription audio is limited to 10 MB.');
  if (!transcriptionEnabled()) throw new MistralProviderError('MISTRAL_NOT_CONFIGURED', 'Mistral transcription is disabled for this deployment.');
  const key = apiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MISTRAL_TIMEOUT_MS || 15_000));
  try {
    const form = new FormData();
    form.append('model', transcriptionModel());
    form.append('file', new Blob([input.data], { type: input.mimeType || 'application/octet-stream' }), input.filename || 'kurukoo-audio');
    if (input.language) form.append('language', input.language.slice(0, 16));
    const response = await fetch(`${String(process.env.MISTRAL_API_BASE || 'https://api.mistral.ai/v1').replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      signal: input.signal || controller.signal,
      body: form,
    });
    if (!response.ok) throw new MistralProviderError('MISTRAL_REQUEST_FAILED', `Mistral transcription failed with status ${response.status}.`);
    const payload = await response.json() as any;
    const text = String(payload?.text || '').trim();
    if (!text) throw new MistralProviderError('MISTRAL_EMPTY_RESPONSE', 'Mistral transcription returned no usable text.');
    return { text, model: String(payload?.model || transcriptionModel()), language: payload?.language ? String(payload.language) : undefined };
  } catch (error) {
    if (error instanceof MistralProviderError) throw error;
    throw new MistralProviderError('MISTRAL_REQUEST_FAILED', 'Mistral transcription failed; no synthetic transcript was generated.', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export async function testMistralConnection(): Promise<{ configured: boolean; reachable: boolean; modelCount?: number; status: number; note: string }> {
  const key = String(process.env.MISTRAL_API_KEY || '').trim();
  if (!hasConfiguredSecret(key)) {
    rememberConnection('', false, 'Mistral API key is not configured.');
    return { configured: false, reachable: false, status: 0, note: 'Mistral API key is not configured.' };
  }
  if (!mistralEnabled()) return { configured: true, reachable: false, status: 0, note: 'Mistral external execution is disabled by feature flag.' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MISTRAL_TIMEOUT_MS || 15_000));
  try {
    const response = await fetch(`${String(process.env.MISTRAL_API_BASE || 'https://api.mistral.ai/v1').replace(/\/$/, '')}/models`, {
      method: 'GET', headers: { Authorization: `Bearer ${key}` }, signal: controller.signal,
    });
    if (!response.ok) {
      const note = `Mistral models endpoint returned HTTP ${response.status}.`;
      rememberConnection(key, false, note);
      return { configured: true, reachable: false, status: response.status, note };
    }
    const payload = await response.json() as any;
    const models = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const note = 'Mistral models endpoint responded successfully; account limits and production suitability remain unverified.';
    rememberConnection(key, true, note);
    return { configured: true, reachable: true, modelCount: models.length, status: response.status, note };
  } catch {
    const note = 'Mistral models endpoint could not be reached; no provider availability is claimed.';
    rememberConnection(key, false, note);
    return { configured: true, reachable: false, status: 0, note };
  } finally {
    clearTimeout(timeout);
  }
}

function augmentConversationInstruction(prompt: string, base: string, enabled: boolean): string {
  if (!enabled) return base;
  const contract = buildConversationTurnContract({ userMessage: prompt, latestUserMessage: prompt, assistantReply: '' });
  return `${base}\n\n${buildConversationalSystemDirective(contract)}`;
}

export async function queryMistral(prompt: string, options: MistralChatOptions = {}): Promise<string> {
  if (!String(prompt || '').trim()) throw new MistralProviderError('MISTRAL_REQUEST_FAILED', 'Mistral requires a non-empty prompt.');
  const key = apiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MISTRAL_TIMEOUT_MS || 15_000));
  try {
    const baseSystemInstruction = options.systemInstruction || 'You are Kurukoo, a concise and evidence-based utility assistant. Never claim an external action without authoritative confirmation.';
    const systemInstruction = augmentConversationInstruction(prompt, baseSystemInstruction, options.conversationalContract !== false);
    const response = await fetch(`${String(process.env.MISTRAL_API_BASE || 'https://api.mistral.ai/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: options.signal || controller.signal,
      body: JSON.stringify({
        model: getMistralModel(),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxOutputTokens ?? 512,
      }),
    });
    if (!response.ok) throw new MistralProviderError('MISTRAL_REQUEST_FAILED', `Mistral request failed with status ${response.status}.`);
    const payload = await response.json() as any;
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new MistralProviderError('MISTRAL_EMPTY_RESPONSE', 'Mistral returned no usable response.');
    return text;
  } catch (error) {
    if (error instanceof MistralProviderError) throw error;
    throw new MistralProviderError('MISTRAL_REQUEST_FAILED', 'Mistral request failed; no synthetic fallback response was generated.', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
