/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Kurukoo Intelligence Runtime
 *
 * Canonical boundary for the intelligence layer above all Kurukoo capabilities.
 *
 * Chat and Voice are the primary human interfaces to Kurukoo AI — the
 * intelligence that understands a person, reasons about what they need,
 * decides what capabilities to use, acts across digital and physical systems,
 * coordinates people/businesses/devices, remembers context, and follows
 * through to verified outcomes.
 *
 * The Runtime is an orchestration boundary, NOT a new authority. It delegates
 * to the existing canonical services:
 *   - contextArbitration  → context + memory arbitration
 *   - semanticConversationInterpreter → natural-language understanding
 *   - conversationIntelligenceService → turn-level intelligence decision
 *   - intentRouter        → intent / skill routing
 *   - aiCapabilityOrchestrator → capability selection & execution planning
 *   - modelRouter         → model / provider selection
 *
 * Application code depends on this contract rather than calling the
 * individual services directly, so the intelligence layer can evolve
 * (e.g. swapping model candidates) without touching Chat or canonical
 * domain services.
 *
 * Conceptual interface:
 *   understand(input, context)  → context + semantic interpretation + intelligence decision
  *   selectCapabilities(...)     → intent routing + escalation signal
 *   execute(action, context)    → delegated to canonical domain services
 *   respond(result, context)    → natural-language generation boundary
 */

import { arbitrateChatContext, type ContextArbitrationDecision } from './contextArbitration.js';
import { routeIntent } from './intentRouter.js';
import type { SemanticConversationInterpretation } from './semanticConversationInterpreter.js';
import decideConversationIntelligence, { type ConversationIntelligenceDecision, type ConversationIntelligenceInput } from './conversationIntelligenceService.js';
import type { AICapabilityOrchestrationDecision } from './aiCapabilityOrchestrator.js';
import type { ConversationTurnContract } from './conversationTurnContractService.js';
import { complete, type ModelCompletionResult } from './modelRouter.js';
import type { ConversationalContextHint, AIProvider } from './modelRouter.js';
import type { IntentRoutingResult } from '../types.js';
import { classifyAiRoutingSignal, shouldEscalateToAi, type AiRoutingSignal } from './aiRoutingConvergence.js';

export type { ContextArbitrationDecision, SemanticConversationInterpretation, ConversationIntelligenceDecision, AICapabilityOrchestrationDecision, ConversationTurnContract, ConversationalContextHint, AIProvider };

export interface IntelligenceInput {
  phone: string;
  message: string;
  provider?: AIProvider;
  contextHint?: ConversationalContextHint;
  isGuest: boolean;
  conversationId?: string;
}

/**
 * Phase 1: Understand.
 *
 * Determines what active context the message relates to, performs semantic
 * interpretation to understand intent, and produces an intelligence decision
 * (mode, model tier, difficulty, action policy).
 */
export interface IntelligenceUnderstanding {
  contextDecision?: ContextArbitrationDecision;
  contextHint: ConversationalContextHint | undefined;
  semantic: SemanticConversationInterpretation | null;
  intelligence: ConversationIntelligenceDecision;
  routingSignal: AiRoutingSignal;
}

export interface IntelligenceRoutingDecision {
  routing: IntentRoutingResult;
  capabilityOrchestration: AICapabilityOrchestrationDecision | null;
  capabilityEscalatedToAi: boolean;
}

/**
 * Phase 1.5: Reason.
 *
 * The Intelligence Runtime's reasoning/planning step. This is the canonical
 * boundary where the Runtime decides whether a capable model is needed for
 * planning and produces a brief plan that guides capability selection.
 *
 * A real model call (via modelRouter.complete with task 'planning') passes
 * through this step when escalation is required. When the deterministic
 * routing signal already resolved the turn (rules/catalogue with high
 * confidence and no escalation), the Runtime short-circuits — no model call
 * is made and the plan remains empty.
 */
export interface IntelligenceReasoning {
  plan: string[];
  intent: string;
  requiresEscalation: boolean;
  modelUsed?: string;
  providerUsed?: string;
  confidence: number;
  rationale?: string;
  escalationReason?: string;
}


// ---------------------------------------------------------------------------
// Phase 1: Understand — context arbitration + semantic interpretation
// ---------------------------------------------------------------------------

/**
 * Convert a ContextArbitrationDecision into a ConversationalContextHint
 * suitable for passing to routeIntent and model selection.
 */
function buildContextHintFromDecision(decision: ContextArbitrationDecision | undefined, override?: ConversationalContextHint): ConversationalContextHint | undefined {
  if (override) return override;
  if (!decision) return undefined;
  return {
    selectedContext: decision.selectedContextId,
    relation: decision.relation,
    confidence: decision.confidence,
    preserveContextIds: decision.preserveContextIds,
    activeContexts: decision.activeContexts,
  };
}

function toConversationIntelligenceInput(
  input: IntelligenceInput,
  understanding: IntelligenceUnderstanding,
): ConversationIntelligenceInput {
  const activeGoalIds = understanding.contextHint?.activeContexts
    ?.filter(context => context?.type === 'economic_request' || context?.type === 'agent_goal')
    .map(context => `${context.type}:${context.contextId}`) || [];
  return {
    latestUserMessage: input.message,
    assistantReply: '',
    activeContextIds: understanding.contextHint?.activeContexts?.map(context => context.contextId).filter(Boolean),
    knownFacts: [],
    pendingFields: understanding.contextHint?.activeContexts?.flatMap(context => context.pendingFields || []) || [],
    activeGoals: activeGoalIds,
    pausedGoals: [],
        currentGoal: understanding.contextHint?.selectedContext,
    userMessage: input.message,
  };
}

/**
 * Phase 1: Understand — context arbitration + intelligence decision +
 * routing signal.
 *
 * Delegates to the existing canonical services without adding a new authority:
 *   - contextArbitration.arbitrateChatContext
 *   - conversationIntelligenceService.decideConversationIntelligence
 *   - aiRoutingConvergence.classifyAiRoutingSignal (FastText explicitly secondary)
 *
 * Semantic interpretation (`interpretConversationSemantics`) is intentionally
 * NOT called here — it is performed inside `routeIntent` during the
 * selectCapabilities phase. Duplicating the model call would be wasteful and
 * could produce inconsistent interpretations. The `semantic` field is
 * populated during `selectCapabilities` when available.
 */
export async function understand(
  input: IntelligenceInput,
  overrideContextHint?: ConversationalContextHint,
): Promise<IntelligenceUnderstanding> {
  // --- Context arbitration (existing canonical owner) ---
  const contextDecision = input.isGuest
    ? undefined
    : await arbitrateChatContext({
        phone: input.phone,
        message: input.message,
        conversationId: input.conversationId,
      }).catch((error: unknown) => {
        void error; // read-only projection; failure must not block the turn
        return undefined;
      });

  const contextHint = buildContextHintFromDecision(contextDecision, overrideContextHint);

  // --- Intelligence decision (existing canonical owner, deterministic) ---
  const stub: IntelligenceUnderstanding = {
    contextDecision,
    contextHint,
    semantic: null,
    intelligence: {} as ConversationIntelligenceDecision,
    routingSignal: {} as AiRoutingSignal,
  };
  const intelligenceInput = toConversationIntelligenceInput(input, stub);
  const intelligence = decideConversationIntelligence(intelligenceInput);

  // --- Routing signal (FastText explicitly secondary, rules first) ---
  const routingSignal = classifyAiRoutingSignal(input.message);

  return { contextDecision, contextHint, semantic: null, intelligence, routingSignal };
}

export { buildContextHintFromDecision as _buildContextHintFromDecision };

// ---------------------------------------------------------------------------
// Phase 1.5: Reason — model-based reasoning & planning through modelRouter
// ---------------------------------------------------------------------------

const REASONING_SYSTEM_PROMPT = `You are Kurukoo's reasoning layer. You analyze the user's message and the routing signal already produced by the deterministic layer (rules + skill catalogue + FastText hint), and you produce a brief plan for how Kurukoo should respond.

You are NOT the execution authority. The canonical turn owner (canonicalChatTurnService) remains authoritative for all state mutation, authorization, payment, evidence, and real-world outcomes. You do NOT execute, mutate, or persist state. You do NOT invent providers, prices, availability, bookings, payments, delivery, ETAs, or completed outcomes.

Return ONLY valid JSON with these keys:
- plan: array of 1-5 concise next-step descriptions (string[])
- intent: concise semantic intent label (string)
- escalation: boolean — does this require a hosted/capable model rather than local first
- confidence: number 0..1
- rationale: brief internal explanation (string)

Do not include prose, notes, or code fences outside the JSON.`;

/** Parse a JSON object from model output, tolerating markdown fences and trailing text. */
function safeParseJsonObject(text: string): Record<string, unknown> | null {
  const source = String(text || '').trim();
  const candidates = [source, source.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()];
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {}
  }
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const value = JSON.parse(source.slice(first, last + 1));
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {}
  }
  return null;
}

function clampConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

/**
 * Build the reasoning prompt from the understanding output. The prompt carries
 * the deterministic routing signal, context summary, and intelligence decision
 * so the model can reason on top of — not instead of — the deterministic layer.
 */
function buildReasoningPrompt(input: IntelligenceInput, understanding: IntelligenceUnderstanding): string {
  const signal = understanding.routingSignal;
  const intel = understanding.intelligence;
  const hint = understanding.contextHint;
  const contextIds = hint?.activeContexts?.map(c => `${c.type}:${c.contextId}`).join(', ') || 'none';
  const pendingFields = hint?.activeContexts?.flatMap(c => c.pendingFields || []) || [];
  return [
    `User message: "${input.message}"`,
    `Phone: ${input.isGuest ? 'guest' : input.phone}`,
    `Conversation act: ${signal.conversationAct || 'none'}`,
    `Skill: ${signal.skill || 'none'}`,
    `Category: ${signal.category || 'none'}`,
    `Routing confidence: ${signal.confidence.toFixed(2)} (source: ${signal.source})`,
    `Intent: ${signal.intent || 'none'}`,
    `Conversation mode: ${intel.mode}`,
    `Requires canonical action: ${intel.shouldRequireCanonicalAction ? 'yes' : 'no'}`,
    `Ask clarification: ${intel.shouldAskClarification ? 'yes' : 'no'}`,
    `Active contexts: ${contextIds}`,
    `Pending fields: ${pendingFields.length ? pendingFields.join(', ') : 'none'}`,
    `Guest: ${input.isGuest ? 'yes' : 'no'}`,
    `Conversation ID: ${input.conversationId || 'new'}`,
    ``,
    `Analyze the user's intent and produce a plan. If the routing signal already resolved the intent deterministically (source is 'rules' or 'catalogue' with high confidence), keep the plan minimal and note that deterministic routing was sufficient. Do not invent providers, prices, availability, bookings, payments, or completed outcomes.`,
    ].join('\n');
}

/**
 * Phase 1.5: Reason — the Intelligence Runtime's ownership of reasoning and
 * planning.
 *
 * This is the canonical seam where the Runtime decides whether a capable model
 * is needed for planning. When the deterministic routing signal already
 * resolved the turn (rules/catalogue with high confidence, no escalation),
 * the Runtime short-circuits: no model call is made and the plan is empty.
 *
 * When escalation IS required, the Runtime invokes a model through the
 * modelRouter abstraction (task: 'planning'), which delegates to
 * aiInferencePolicy.chooseInferenceProvider → unifiedAiEngine.queryUnifiedAI.
 * This is the first point at which a real model call passes through the
 * Intelligence Runtime itself (rather than inside routeIntent during
 * selectCapabilities).
 *
 * The Runtime does NOT execute actions, mutate canonical state, bypass
 * authentication, or invent real-world outcomes.
 */
export async function reason(
  input: IntelligenceInput,
  understanding: IntelligenceUnderstanding,
): Promise<IntelligenceReasoning> {
  // Deterministic fast path: when the routing signal already resolved the turn
  // (rules/catalogue with high confidence), no model reasoning is needed.
  // shouldEscalateToAi is the canonical escalation boundary — it returns false
  // for conversational acts (greeting, thanks, farewell, etc.) and for
  // catalogue-resolved skills with confidence >= 0.72.
  const needsEscalation = shouldEscalateToAi(understanding.routingSignal, input.message);

  if (!needsEscalation) {
    return {
      plan: [],
      intent: understanding.routingSignal.skill
        || understanding.routingSignal.intent
        || understanding.routingSignal.conversationAct
        || 'general',
      requiresEscalation: false,
      confidence: understanding.routingSignal.confidence,
      rationale: 'Deterministic routing resolved the turn; no model reasoning required.',
    };
  }

  // Model-based reasoning through modelRouter (NOT a direct provider call).
  // The 'planning' task routes through aiInferencePolicy to the appropriate
  // model tier: Poolside → hosted reasoning providers → local fallback.
  try {
    const result: ModelCompletionResult = await complete({
      task: 'planning',
      prompt: buildReasoningPrompt(input, understanding),
      preferred: input.provider,
      systemPrompt: REASONING_SYSTEM_PROMPT,
      contextHint: understanding.contextHint,
      temperature: 0,
    });

    const parsed = safeParseJsonObject(result.text);
    if (parsed) {
      const plan = Array.isArray(parsed.plan)
        ? (parsed.plan as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 5)
        : [];
      const intent = typeof parsed.intent === 'string' && parsed.intent.trim()
        ? parsed.intent.trim()
        : (understanding.routingSignal.skill || 'general');
      const escalation = typeof parsed.escalation === 'boolean' ? parsed.escalation : false;
      const confidence = clampConfidence(parsed.confidence);
      const rationale = typeof parsed.rationale === 'string' && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : undefined;
      const resolvedRequiresEscalation = escalation
        || (result.provider !== 'Kurukoo Template' && result.provider !== 'SmolLM2');

      return {
        plan,
        intent,
        requiresEscalation: resolvedRequiresEscalation,
        modelUsed: result.model,
        providerUsed: result.provider,
        confidence,
        rationale,
        escalationReason: resolvedRequiresEscalation && !escalation
          ? 'model_provider_escapes_local_first'
          : undefined,
      };
    }

    // Fallback: model responded but JSON was not parseable.
    return {
      plan: [],
      intent: understanding.routingSignal.skill || 'general',
      requiresEscalation: true,
      modelUsed: result.model,
      providerUsed: result.provider,
      confidence: result.confidence ?? 0.3,
      rationale: 'Model reasoning invoked but response was not structured JSON.',
      escalationReason: 'unstructured_reasoning_response',
    };
  } catch (error: unknown) {
    // Graceful degradation: if reasoning fails, proceed with deterministic signal.
    const reason = error instanceof Error ? error.message : String(error);
    return {
      plan: [],
      intent: understanding.routingSignal.skill
        || understanding.routingSignal.intent
        || 'general',
      requiresEscalation: true,
      confidence: 0,
      rationale: `Reasoning model call failed: ${reason}. Proceeding with deterministic routing signal.`,
      escalationReason: 'reasoning_model_call_failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Select Capabilities — intent routing (capability orchestration
// is deferred to canonicalChatTurnService; see selectCapabilities docs)
// ---------------------------------------------------------------------------

/**
 * Phase 2: Select Capabilities — intent routing.
 *
 * Delegates to:
 *   - intentRouter.routeIntent (which internally calls semantic interpretation)
 *
 * Capability orchestration (`buildAICapabilityOrchestration`) is performed by
 * `canonicalChatTurnService` where the full turn contract — including profile
 * facts, routing card data, and active context IDs — is available. The
 * Intelligence Runtime returns the routed intent and the escalation signal so
 * the canonical Chat turn owner can build its own turn contract and orchestrate
 * capabilities without duplicating model calls.
 */
export async function selectCapabilities(
  input: IntelligenceInput,
  understanding: IntelligenceUnderstanding,
  reasoning?: IntelligenceReasoning,
  options?: { compound?: boolean; continued?: IntentRoutingResult | null },
): Promise<IntelligenceRoutingDecision> {
  // When compound goals are active, contextDecision is NOT passed to
  // routeIntent — matching the existing canonical behaviour in
  // canonicalChatTurnService.
  const effectiveContextHint = options?.compound ? undefined : understanding.contextHint;

  const routing = options?.continued
    ?? await routeIntent(
        input.message,
        input.phone,
        input.provider,
        effectiveContextHint,
        input.conversationId,
      );

  // Whether this turn escaped the local reasoning path to a hosted AI model.
  // The reasoning result from Phase 1.5 is authoritative when present;
  // otherwise fall back to the deterministic routing signal.
  const capabilityEscalatedToAi = Boolean(reasoning?.requiresEscalation)
    || shouldEscalateToAi(understanding.routingSignal, input.message);

  // Capability orchestration is deferred to canonicalChatTurnService which has
  // the full turn contract (profile facts, routing card fields, etc.).
  return { routing, capabilityOrchestration: null, capabilityEscalatedToAi };
}

export interface IntelligenceTurnResult {
  understanding: IntelligenceUnderstanding;
  reasoning: IntelligenceReasoning;
  routing: IntelligenceRoutingDecision;
}

// ---------------------------------------------------------------------------
// Full turn: understand → reason → select capabilities
// ---------------------------------------------------------------------------

/**
 * Full Intelligence Runtime turn: understand → reason → select capabilities.
 *
 * This is the canonical entry point that the Chat path delegates to for
 * intelligence processing. It does NOT execute actions — execution remains
 * the responsibility of the canonical domain services.
 *
 * The reason step is where the Runtime owns model-based planning through the
 * modelRouter abstraction. When the deterministic routing signal already
 * resolved the turn, reason() short-circuits without a model call.
 */
export async function processIntelligenceTurn(
  input: IntelligenceInput,
  options?: { compound?: boolean; continued?: IntentRoutingResult | null },
): Promise<IntelligenceTurnResult> {
  const understanding = await understand(input);
  const reasoning = await reason(input, understanding);
  const routing = await selectCapabilities(input, understanding, reasoning, options);
  return { understanding, reasoning, routing };
}

export default processIntelligenceTurn;
