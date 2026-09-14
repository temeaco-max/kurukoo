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
 * Known limits (measured on 2026-09-14, compact prompts, raw ChatML):
 *  - strict-JSON tool/argument extraction is unreliable on BOTH local
 *    candidates (Qwen 0.5B Q4_K_M and SmolLM2 360M F16 equally failed all
 *    strict variants tested);
 *  - both candidates failed the no-evidence/no-outcome boundary probe in the
 *    same direction (affirming completion without evidence);
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