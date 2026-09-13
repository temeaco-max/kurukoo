/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Model / Provider Router
 *
 * Single boundary for model selection and execution. Application code depends
 * on this contract rather than directly on a particular model such as
 * SmolLM2, Gemini, Mistral, or any future candidate (Qwen3, Llama, etc.).
 *
 * Model/provider selection happens here. Local models are loaded on demand
 * and remain cache-aware. The router is provider-agnostic: it delegates to
 * the existing unifiedAiEngine for actual execution while owning the
 * decision of which provider to use.
 */

import { chooseInferenceProvider, type InferenceDecision, type InferenceTask } from './aiInferencePolicy.js';
import { queryUnifiedAI, streamUnifiedAI, type AIProvider, type UnifiedAIOptions, type AIResponse, type AIStreamChunk, type ConversationalContextHint, resolveConfiguredHostedProvider } from './unifiedAiEngine.js';
import { getSmolLM2RuntimeStatus } from './smolLm2Service.js';

export type { AIProvider, ConversationalContextHint, InferenceTask };

export type ModelTier = 'local' | 'compact' | 'strong';

/** A model selection result — provider-agnostic metadata about the chosen model. */
export interface ModelSelection {
  provider: AIProvider;
  model: string;
  tier: ModelTier;
  reason: string;
  escalationReason?: string;
}

/** Options for a text-completion request through the Intelligence Runtime. */
export interface ModelCompletionOptions {
  task: InferenceTask;
  prompt: string;
  preferred?: AIProvider;
  systemPrompt?: string;
  temperature?: number;
  phone?: string;
  threadId?: string;
  skipMemory?: boolean;
  contextHint?: ConversationalContextHint;
  classificationPrompt?: string;
  conversational?: boolean;
}

export interface ModelCompletionResult {
  provider: string;
  model: string;
  text: string;
  thought?: string;
  latencyMs: number;
  cost: string;
  intent?: string;
  confidence?: number;
}

/**
 * Select the cheapest sufficient model for a task, consulting the canonical
 * inference policy. Returns provider-agnostic metadata only — execution is
 * deferred to `complete()` or `streamCompletion()` so callers cannot wire
 * directly to a named model.
 */
export function selectModel(task: InferenceTask, prompt: string, preferred?: AIProvider): ModelSelection {
  const decision: InferenceDecision = chooseInferenceProvider({ task, prompt, preferred });
  const modelName = modelNameForProvider(decision.provider);
  const tier: ModelTier = (decision.maxComplexity === 'high') ? 'strong'
    : (decision.maxComplexity === 'medium') ? 'compact'
    : 'local';
  return {
    provider: decision.provider,
    model: modelName,
    tier,
    reason: decision.reason,
    escalationReason: decision.escalationReason,
  };
}

function modelNameForProvider(provider: AIProvider): string {
  switch (provider) {
    case 'gemini': return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    case 'mistral': return process.env.MISTRAL_MODEL || 'mistral-small-latest';
    case 'groq': return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    case 'openrouter': return process.env.OPENROUTER_MODEL || 'openrouter-unconfigured';
    case 'poolside': return process.env.POOLSIDE_MODEL || 'poolside/laguna-xs-2.1';
    case 'smollm2': {
      const runtime = getSmolLM2RuntimeStatus();
      return runtime.available ? (runtime.model.split('/').pop() || runtime.model) : 'template-fallback';
    }
    case 'local_intent': return 'kurukoo_intent';
    default: return 'template-fallback';
  }
}

/**
 * Convenience: report which hosted provider is currently configured for
 * escalation paths (used by diagnostics and the Intelligence Runtime).
 */
export function getConfiguredHostedProvider(): string | null {
  const provider = resolveConfiguredHostedProvider();
  return provider ? provider : null;
}

/**
 * Complete a prompt using the model selected by the routing policy.
 * Delegates actual execution to the canonical unified engine while owning
 * the model/provider decision boundary.
 */
export async function complete(options: ModelCompletionOptions): Promise<ModelCompletionResult> {
  const decision = selectModel(options.task, options.prompt, options.preferred);
  const ai = await queryUnifiedAI(options.prompt, {
    provider: decision.provider,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    phone: options.phone,
    threadId: options.threadId,
    skipMemory: options.skipMemory,
    conversational: options.conversational,
    contextHint: options.contextHint,
    classificationPrompt: options.classificationPrompt,
  });
  return {
    provider: ai.provider,
    model: ai.model,
    text: ai.text,
    thought: ai.thought,
    latencyMs: ai.latencyMs,
    cost: ai.cost,
    intent: ai.intent,
    confidence: ai.confidence,
  };
}

/**
 * Stream a prompt using the model selected by the routing policy.
 * Delegates actual execution to the canonical streaming engine.
 */
export async function* streamCompletion(options: ModelCompletionOptions): AsyncGenerator<AIStreamChunk> {
  const decision = selectModel(options.task, options.prompt, options.preferred);
  for await (const chunk of streamUnifiedAI(options.prompt, {
    provider: decision.provider,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    phone: options.phone,
    threadId: options.threadId,
    skipMemory: options.skipMemory,
    conversational: options.conversational,
    contextHint: options.contextHint,
    classificationPrompt: options.classificationPrompt,
  })) {
    yield chunk;
  }
}

export { queryUnifiedAI, streamUnifiedAI, type AIResponse, type AIStreamChunk, type UnifiedAIOptions, type InferenceDecision };
