/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { hasConfiguredSecret, type ProviderCapabilityStatus, type ProviderReadiness, unknownLimits } from './providerCapabilities.js';
import { buildConversationTurnContract, buildConversationalSystemDirective } from './conversationTurnContractService.js';
import { getFeatureFlag } from './featureFlags.js';

export class PoolsideProviderError extends Error {
  readonly code: 'POOLSIDE_NOT_CONFIGURED' | 'POOLSIDE_DISABLED' | 'POOLSIDE_REQUEST_FAILED' | 'POOLSIDE_EMPTY_RESPONSE';
  constructor(code: PoolsideProviderError['code'], message: string, options?: { cause?: unknown }) { super(message, options); this.name = 'PoolsideProviderError'; this.code = code; }
}
export interface PoolsideChatOptions { systemInstruction?: string; temperature?: number; maxOutputTokens?: number; signal?: AbortSignal; conversationalContract?: boolean; }
function getPoolsideApiKey(): string { return String(process.env.POOLSIDE_API_KEY || '').trim(); }
function getPoolsideApiBase(): string { return String(process.env.POOLSIDE_API_BASE || 'https://inference.poolside.ai/v1').replace(/\/$/, ''); }
function getPoolsideModel(): string { return String(process.env.POOLSIDE_MODEL || 'poolside/laguna-xs-2.1').trim(); }
function getPoolsideTimeoutMs(): number { return Math.max(1_000, Math.min(60_000, Number(process.env.POOLSIDE_TIMEOUT_MS || 15_000))); }
export function getActivePoolsideModel(): string { return getPoolsideModel(); }

let lastConnection: { keyMarker: string; reachable: boolean; testedAt: string; note: string } | null = null;
function keyMarker(value: string): string { return `${value.length}:${value.slice(-4)}`; }
function rememberConnection(key: string, reachable: boolean, note: string): void { lastConnection = { keyMarker: keyMarker(key), reachable, testedAt: new Date().toISOString(), note }; }
function connectionVerified(key: string): boolean { return Boolean(lastConnection && lastConnection.keyMarker === keyMarker(key) && lastConnection.reachable); }

export function getPoolsideStatus(): { configured: boolean; enabled: boolean; reachable: boolean; model: string; base: string; note: string } {
  const key = getPoolsideApiKey();
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  const configured = hasConfiguredSecret(key);
  const enabled = getFeatureFlag(country, 'hosted_poolside');
  const reachable = configured && enabled && connectionVerified(key);
  const note = !configured ? 'Poolside is not configured: POOLSIDE_API_KEY is not set.' : !enabled ? 'Poolside is configured but hosted execution is disabled.' : reachable ? 'Poolside connectivity was verified by the protected connection check.' : 'Poolside is configured and enabled, but reachability has not been verified in this process.';
  return { configured, enabled, reachable, model: getPoolsideModel(), base: getPoolsideApiBase(), note };
}

function augmentConversationInstruction(prompt: string, base: string, enabled: boolean): string {
  if (!enabled) return base;
  const contract = buildConversationTurnContract({ userMessage: prompt, latestUserMessage: prompt, assistantReply: '' });
  return `${base}\n\n${buildConversationalSystemDirective(contract)}`;
}

export async function queryPoolside(prompt: string, options: PoolsideChatOptions = {}): Promise<string> {
  const key = getPoolsideApiKey();
  if (!hasConfiguredSecret(key)) throw new PoolsideProviderError('POOLSIDE_NOT_CONFIGURED', 'Poolside is not configured: POOLSIDE_API_KEY is missing.');
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  if (!getFeatureFlag(country, 'hosted_poolside')) throw new PoolsideProviderError('POOLSIDE_DISABLED', 'Poolside is disabled via the hosted_poolside feature flag.');
  if (!String(prompt || '').trim()) throw new PoolsideProviderError('POOLSIDE_REQUEST_FAILED', 'Poolside requires a non-empty prompt.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getPoolsideTimeoutMs());
  try {
    const baseSystemInstruction = options.systemInstruction || 'You are Kurukoo’s complex planning assistant. Think through multi-step work clearly, but never claim that an external action happened unless the canonical Kurukoo system confirms it.';
    const systemInstruction = augmentConversationInstruction(prompt, baseSystemInstruction, options.conversationalContract !== false);
    const response = await fetch(`${getPoolsideApiBase()}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: options.signal || controller.signal, body: JSON.stringify({ model: getPoolsideModel(), messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }], temperature: options.temperature ?? 0.3, max_tokens: options.maxOutputTokens ?? 1024 }) });
    if (!response.ok) throw new PoolsideProviderError('POOLSIDE_REQUEST_FAILED', `Poolside request failed with HTTP ${response.status}.`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new PoolsideProviderError('POOLSIDE_EMPTY_RESPONSE', 'Poolside returned no usable response.');
    return text;
  } catch (error) {
    if (error instanceof PoolsideProviderError) throw error;
    throw new PoolsideProviderError('POOLSIDE_REQUEST_FAILED', 'Poolside request failed; no synthetic fallback response was generated.', { cause: error });
  } finally { clearTimeout(timeout); }
}

export async function testPoolsideConnection(): Promise<{ configured: boolean; reachable: boolean; status: number; note: string }> {
  const key = getPoolsideApiKey();
  const configured = hasConfiguredSecret(key);
  if (!configured) { rememberConnection('', false, 'Poolside API key is not configured.'); return { configured: false, reachable: false, status: 0, note: 'Poolside API key is not configured.' }; }
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  if (!getFeatureFlag(country, 'hosted_poolside')) { rememberConnection(key, false, 'Poolside is disabled by feature flag.'); return { configured: true, reachable: false, status: 0, note: 'Poolside is configured but disabled by feature flag.' }; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getPoolsideTimeoutMs());
  try {
    const response = await fetch(`${getPoolsideApiBase()}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: getPoolsideModel(), messages: [{ role: 'user', content: 'Reply exactly: POOLSIDE_OK' }], temperature: 0, max_tokens: 16 }) });
    if (!response.ok) { const note = `Poolside chat endpoint returned HTTP ${response.status}.`; rememberConnection(key, false, note); return { configured: true, reachable: false, status: response.status, note }; }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    const reachable = text.length > 0;
    const note = reachable ? 'Poolside chat endpoint responded with usable content.' : 'Poolside chat endpoint responded without usable content.';
    rememberConnection(key, reachable, note);
    return { configured: true, reachable, status: response.status, note };
  } catch {
    const note = 'Poolside endpoint could not be reached; no provider availability is claimed.';
    rememberConnection(key, false, note);
    return { configured: true, reachable: false, status: 0, note };
  } finally { clearTimeout(timeout); }
}

export const poolsideProviderCapabilities: ProviderReadiness = { provider: 'poolside', configured: false, available: false, capabilities: [], failover: 'canonical-local' };
export function getPoolsideProviderReadiness(): ProviderReadiness {
  const status = getPoolsideStatus();
  const capability: ProviderCapabilityStatus = { configured: status.configured, available: status.reachable, provider: 'poolside', capability: 'text', model: getPoolsideModel(), limits: unknownLimits(status.note), note: status.note };
  return { provider: 'poolside', configured: status.configured, available: status.reachable, capabilities: [capability], failover: 'canonical-local' };
}
export function getPoolsideCapabilityStatus(): ProviderCapabilityStatus | null { return getPoolsideProviderReadiness().capabilities[0] || null; }
