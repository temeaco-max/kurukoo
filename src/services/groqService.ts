/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getFeatureFlag } from './featureFlags.js';
import { hasConfiguredSecret } from './providerCapabilities.js';

let dailyCalls = 0;
let lastResetDate = new Date().toDateString();
let activeRequests = 0;
const MAX_CONCURRENT = Math.max(1, Math.min(32, Number(process.env.GROQ_MAX_CONCURRENT || 8)));
const MAX_DAILY_CALLS = Math.max(1, Number(process.env.GROQ_DAILY_CALL_LIMIT || 1000));
const DEFAULT_TIMEOUT_MS = 15_000;

export interface GroqOptions { systemPrompt?: string; temperature?: number; maxTokens?: number; includeThinking?: boolean; signal?: AbortSignal; }
function resetCounter(): void { const today = new Date().toDateString(); if (today !== lastResetDate) { dailyCalls = 0; lastResetDate = today; } }
function buildMessages(prompt: string, options?: GroqOptions) {
  const systemPrompt = options?.systemPrompt || 'You are Kurukoo, a calm and capable everyday assistant. Be natural, concise and specific. Help the user understand things and move useful work forward, but never claim that a provider action, payment, booking, delivery or other external action happened without confirmation from Kurukoo’s canonical services.';
  return [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }];
}
async function acquireSlot(): Promise<void> { while (activeRequests >= MAX_CONCURRENT) await new Promise(resolve => setTimeout(resolve, 25)); activeRequests++; }
function releaseSlot(): void { activeRequests = Math.max(0, activeRequests - 1); }
function groqEnabled(): boolean { return getFeatureFlag(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'hosted_groq'); }
function getApiKey(): string { const key = String(process.env.GROQ_API_KEY || '').trim(); if (!hasConfiguredSecret(key)) throw new Error('GROQ_API_KEY is not configured'); return key; }
function timeoutMs(): number { return Math.max(1_000, Math.min(60_000, Number(process.env.GROQ_TIMEOUT_MS || DEFAULT_TIMEOUT_MS))); }

async function callGroq(prompt: string, options: GroqOptions | undefined, stream: boolean): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const signal = options?.signal || controller.signal;
    return await fetch(String(process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant', messages: buildMessages(prompt, options), temperature: Math.max(0, Math.min(2, Number.isFinite(options?.temperature) ? Number(options?.temperature) : 0.4)), max_tokens: Math.min(options?.maxTokens ?? 768, 1536), stream }),
      signal,
    });
  } finally { clearTimeout(timeout); }
}

export async function queryGroq(prompt: string, options?: GroqOptions): Promise<string> {
  resetCounter();
  if (dailyCalls >= MAX_DAILY_CALLS) throw new Error('Groq daily rate limit reached');
  if (!groqEnabled()) throw new Error('Groq external execution is disabled by feature flag');
  await acquireSlot();
  try {
    dailyCalls++;
    let response: Response;
    try { response = await callGroq(prompt, options, false); } catch (error: any) { if (error?.name === 'AbortError') throw new Error('Groq request timed out'); throw error; }
    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
    const data = await response.json() as any;
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('Groq returned no usable response');
    return text;
  } finally { releaseSlot(); }
}

export async function* streamGroq(prompt: string, options?: GroqOptions): AsyncGenerator<string> {
  resetCounter();
  if (dailyCalls >= MAX_DAILY_CALLS) throw new Error('Groq daily rate limit reached');
  if (!groqEnabled()) throw new Error('Groq external execution is disabled by feature flag');
  await acquireSlot();
  try {
    dailyCalls++;
    const response = await callGroq(prompt, options, true);
    if (!response.ok || !response.body) throw new Error(`Groq streaming error: ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find(v => v.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') return;
          try { const data = JSON.parse(payload); const delta = data?.choices?.[0]?.delta?.content; if (delta) yield String(delta); } catch { /* ignore malformed SSE frames */ }
        }
      }
    } finally { reader.releaseLock(); }
  } finally { releaseSlot(); }
}
