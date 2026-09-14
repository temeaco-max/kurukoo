/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getStudentModelRuntimeSelection } from './studentModelRegistryService.js';
export interface LocalModelSelection {
  /** The configured/preferred local fast checkpoint (no canonical execution authority). */
  model: string;
  /** Bounded local fallback/comparison checkpoint. */
  fallbackModel: string;
  /** Where the selection came from, for diagnostics only. */
  source: 'explicit' | 'registry' | 'policy-default';
}

/**
 * Local-model selection policy.
 *
 * Qualified fast default: Qwen2.5-0.5B-Instruct (Qwen2.5-0.5B Q4_K_M) —
 * conversation, clarification, context continuation, long context,
 * multilingual, diagnostic.  SmolLM2 360M is retained as the bounded local
 * fallback/comparison checkpoint — not deleted.
 *
 * Known limits (measured on 2026-09-14, compact prompts, raw ChatML,
 * report: docs/verification/local-model-qualification.json):
 *  - strict-JSON tool/argument extraction is unreliable on the small local
 *    tier for multi-tool and compound payloads: Qwen2.5-0.5B passed single and
 *    malformed-JSON recovery but failed multi/compound (truncated invalid
 *    JSON); the follow-up next-tier probe (Qwen2.5-0.5B vs
 *    Qwen2.5-1.5B-uncensored, compact prompts) scored 7/12 with the same
 *    pattern — single/args pass, multi/compound fail, and the hallucination
 *    guard produced a polluted {"tool":"none","args":{"name":"Zorblax",...}}
 *    refusal instead of the exact {"tool":"none","args":{}};
 *  - the canonical 15-case harness measured Qwen2.5-0.5B 6/15 PASS at
 *    ~234ms/tok vs SmolLM2 360M 9/15 PASS at ~340ms/tok, and both candidates
 *    failed the no-evidence/no-outcome boundary probe in the same direction
 *    (affirming completion without evidence);
 *  - Qwen 0.5B failed the concept-boundary wording probe that SmolLM2 360M
 *    passed (Qwen omitted the literal word "capability" while describing the
 *    other five concepts correctly).
 * Therefore: local candidates may author ordinary conversational language;
 * anything that becomes a canonical tool call, Economic Request, payment,
 * provider lookup, booking, dispatch, persistence, or claimed outcome MUST
 * route through hosted/frontier reasoning and the owning canonical
 * Kurukoo service.
 */
export const LOCAL_MODEL_POLICY = {
  /** Qualified local fast default (Ollama tag). */
  defaultModel: 'qwen2.5-0.5b',
  /** Bounded local fallback/comparison checkpoint (Ollama tag). */
  fallbackModel: 'smollm2:360m',
  roles: {
    localFast: 'qwen2.5-0.5b' as const,
    localFallback: 'smollm2:360m' as const,
    complexReasoning: 'hosted' as const,
    specialist: 'conditional' as const,
  },
  /** Task classes the local fast candidate may attempt first. */
  localFirstTasks: ['conversation', 'support', 'skill_intake', 'presentation'] as const,
  hostedRequiredTasks: ['planning', 'agent_execution', 'high_stakes'] as const,
};

function resolveLocalFallbackModel(): string {
  const explicit = String(process.env.SMOLLM2_FALLBACK_MODEL || '').trim();
  if (explicit) return explicit;
  return LOCAL_MODEL_POLICY.fallbackModel;
}

function baseLocalModel(): string {
  try {
    const selection = getStudentModelRuntimeSelection().model;
    if (selection && selection.trim()) return selection.trim();
  } catch { /* registry unavailable — fall through to policy default */ }
  return LOCAL_MODEL_POLICY.defaultModel;
}

export function resolveLocalModelSelection(): LocalModelSelection {
  const explicit = String(process.env.SMOLLM2_MODEL || '').trim()
    || String(process.env.KURUKOO_LOCAL_MODEL || '').trim();
  if (explicit) return { model: explicit, fallbackModel: resolveLocalFallbackModel(), source: 'explicit' };
  const base = baseLocalModel();
  if (base !== LOCAL_MODEL_POLICY.defaultModel) return { model: base, fallbackModel: resolveLocalFallbackModel(), source: 'registry' };
  return { model: LOCAL_MODEL_POLICY.defaultModel, fallbackModel: resolveLocalFallbackModel(), source: 'policy-default' };
}

/** True when the configured primary local checkpoint is the Qwen fast candidate. */
export function isQwenLocalDefault(model?: string): boolean {
  const tag = String(model || resolveLocalModelSelection().model).toLowerCase();
  return tag.startsWith('qwen2.5') || tag.startsWith('qwen2-5');
}

/** True for task classes the local fast candidate may attempt first. */
export function isLocalFirstTask(task: string): boolean {
  return (LOCAL_MODEL_POLICY.localFirstTasks as readonly string[]).includes(String(task || ''));
}

/** True for task classes that must not stop at the local candidate. */
export function isHostedRequiredTask(task: string): boolean {
  return (LOCAL_MODEL_POLICY.hostedRequiredTasks as readonly string[]).includes(String(task || ''));
}