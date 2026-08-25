export type AiProvider = 'mistral' | 'gemini' | 'groq' | 'openrouter' | 'poolside';
export type AiProviderHealthState = 'healthy' | 'degraded' | 'open' | 'half_open';

export interface AiProviderHealthSnapshot {
  provider: AiProvider;
  state: AiProviderHealthState;
  consecutiveFailures: number;
  successes: number;
  failures: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  cooldownUntil?: string;
  lastLatencyMs?: number;
  lastError?: string;
}

interface MutableState extends AiProviderHealthSnapshot {}

const states = new Map<AiProvider, MutableState>();
const FAILURE_THRESHOLD = Math.max(1, Number(process.env.KURUKOO_AI_CIRCUIT_FAILURE_THRESHOLD || 3));
const OPEN_COOLDOWN_MS = Math.max(5_000, Number(process.env.KURUKOO_AI_CIRCUIT_COOLDOWN_MS || 30_000));
const DEGRADED_LATENCY_MS = Math.max(500, Number(process.env.KURUKOO_AI_DEGRADED_LATENCY_MS || 4_000));

function stateFor(provider: AiProvider): MutableState {
  const current = states.get(provider);
  if (current) return current;
  const created: MutableState = { provider, state: 'healthy', consecutiveFailures: 0, successes: 0, failures: 0 };
  states.set(provider, created);
  return created;
}

export function getAiProviderHealth(provider: AiProvider): AiProviderHealthSnapshot {
  const current = stateFor(provider);
  if (current.state === 'open' && current.cooldownUntil && Date.parse(current.cooldownUntil) <= Date.now()) {
    current.state = 'half_open';
  }
  return { ...current };
}

export function listAiProviderHealth(): AiProviderHealthSnapshot[] {
  return (['mistral', 'gemini', 'groq', 'openrouter', 'poolside'] as AiProvider[]).map(getAiProviderHealth);
}

export function isAiProviderUsable(provider: AiProvider): boolean {
  const current = getAiProviderHealth(provider);
  return current.state !== 'open';
}

export function recordAiProviderSuccess(provider: AiProvider, latencyMs: number): void {
  const current = stateFor(provider);
  current.successes += 1;
  current.consecutiveFailures = 0;
  current.lastSuccessAt = new Date().toISOString();
  current.lastLatencyMs = Math.max(0, Math.round(latencyMs));
  current.lastError = undefined;
  if (current.state === 'half_open' || current.state === 'degraded') current.state = 'healthy';
  if (latencyMs >= DEGRADED_LATENCY_MS) current.state = 'degraded';
  current.cooldownUntil = undefined;
}

export function recordAiProviderFailure(provider: AiProvider, error: unknown, latencyMs: number): void {
  const current = stateFor(provider);
  current.failures += 1;
  current.consecutiveFailures += 1;
  current.lastFailureAt = new Date().toISOString();
  current.lastLatencyMs = Math.max(0, Math.round(latencyMs));
  current.lastError = String(error instanceof Error ? error.message : error || 'provider_failure').slice(0, 240);
  if (current.consecutiveFailures >= FAILURE_THRESHOLD) {
    current.state = 'open';
    current.cooldownUntil = new Date(Date.now() + OPEN_COOLDOWN_MS).toISOString();
  } else {
    current.state = 'degraded';
  }
}

export function resetAiProviderHealth(provider?: AiProvider): void {
  if (provider) states.delete(provider);
  else states.clear();
}
