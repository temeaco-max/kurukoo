import { getFeatureFlag } from './featureFlags.js';

let dailyCalls = 0;
let lastResetDate = new Date().toDateString();
let activeRequests = 0;
const MAX_CONCURRENT = Number(process.env.GROQ_MAX_CONCURRENT || 8);

export interface GroqOptions {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    includeThinking?: boolean;
}

function resetCounter() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        dailyCalls = 0;
        lastResetDate = today;
    }
}

function buildMessages(prompt: string, options?: GroqOptions) {
    const systemPrompt = options?.systemPrompt || `You are Kurukoo, an AI-powered Economic OS for the informal economy across Nigeria, Ghana, Kenya, and the UK.
You help users with transit (Okada/Keke/rides), food ordering, finding local artisans, logistics, trade, and life admin.
Be helpful, proactive, concise, and localized. Do not expose private chain-of-thought. Give concise conclusions and actionable next steps.`;
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
    ];
}

async function acquireSlot(): Promise<void> {
    while (activeRequests >= MAX_CONCURRENT) await new Promise(resolve => setTimeout(resolve, 25));
    activeRequests++;
}

function releaseSlot() { activeRequests = Math.max(0, activeRequests - 1); }
function groqEnabled(): boolean { return getFeatureFlag(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'hosted_groq'); }

export async function queryGroq(prompt: string, options?: GroqOptions): Promise<string> {
    resetCounter();
    if (dailyCalls >= 1000) throw new Error('Groq daily rate limit reached');
    if (!groqEnabled()) throw new Error('Groq external execution is disabled by feature flag');
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
    await acquireSlot();
    try {
        dailyCalls++;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                messages: buildMessages(prompt, options),
                temperature: options?.temperature ?? 0.4,
                max_tokens: Math.min(options?.maxTokens ?? 768, 1536),
                stream: false
            })
        });
        if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
        const data: any = await response.json();
        return data.choices?.[0]?.message?.content || 'Request processed successfully.';
    } finally {
        releaseSlot();
    }
}

export async function* streamGroq(prompt: string, options?: GroqOptions): AsyncGenerator<string> {
    resetCounter();
    if (dailyCalls >= 1000) throw new Error('Groq daily rate limit reached');
    if (!groqEnabled()) throw new Error('Groq external execution is disabled by feature flag');
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
    await acquireSlot();
    try {
        dailyCalls++;
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                messages: buildMessages(prompt, options),
                temperature: options?.temperature ?? 0.4,
                max_tokens: Math.min(options?.maxTokens ?? 768, 1536),
                stream: true
            })
        });
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
                    try {
                        const data = JSON.parse(payload);
                        const delta = data.choices?.[0]?.delta?.content;
                        if (delta) yield String(delta);
                    } catch { /* ignore malformed SSE frames */ }
                }
            }
        } finally {
            reader.releaseLock();
        }
    } finally {
        releaseSlot();
    }
}
