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
  const capabilityEscalatedToAi = shouldEscalateToAi(understanding.routingSignal, input.message);

  // Capability orchestration is deferred to canonicalChatTurnService which has
  // the full turn contract (profile facts, routing card fields, etc.).
  return { routing, capabilityOrchestration: null, capabilityEscalatedToAi };
}

export interface IntelligenceTurnResult {
  understanding: IntelligenceUnderstanding;
  routing: IntelligenceRoutingDecision;
}

// ---------------------------------------------------------------------------
// Full turn: understand → select capabilities
// ---------------------------------------------------------------------------

/**
 * Full Intelligence Runtime turn: understand → select capabilities.
 *
 * This is the canonical entry point that the Chat path delegates to for
 * intelligence processing. It does NOT execute actions — execution remains
 * the responsibility of the canonical domain services.
 */
export async function processIntelligenceTurn(
  input: IntelligenceInput,
  options?: { compound?: boolean; continued?: IntentRoutingResult | null },
): Promise<IntelligenceTurnResult> {
  const understanding = await understand(input);
  const routing = await selectCapabilities(input, understanding, options);
  return { understanding, routing };
}

export default processIntelligenceTurn;
