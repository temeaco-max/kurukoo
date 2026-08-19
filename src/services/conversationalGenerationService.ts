import { queryUnifiedAI, resolveConfiguredHostedProvider, type AIProvider, type AIResponse, type ConversationalContextHint } from './unifiedAiEngine.js';
import { assessConversationQuality, type ConversationQualityAssessment } from './conversationQualityService.js';
import { buildConversationTurnContract, buildConversationalSystemDirective, type ConversationTurnContract } from './conversationTurnContractService.js';
import { buildConversationContextPack } from './conversationContextPackService.js';
import { buildCapabilityConversationGuidance, buildCapabilityOutcomeFromCanonicalResult, type CanonicalOutcomeLike, type CapabilityConversationGuidance } from './aiCapabilityContinuationService.js';
import { buildConnectedResourceContext } from './connectedResourceService.js';

export type ConversationGenerationMode = 'generate' | 'present' | 'deterministic';

export interface ConversationalGenerationInput {
  owner?: 'conversationalGenerationService';
  prompt: string;
  phone?: string;
  threadId?: string;
  provider?: AIProvider;
  systemPrompt?: string;
  contextHint?: ConversationalContextHint;
  activeContextIds?: string[];
  activeGoals?: string[];
  knownFacts?: string[];
  pendingFields?: string[];
  pausedGoals?: string[];
  currentGoal?: string;
  priorAssistantReplies?: string[];
  canonicalAction?: string;
  cardType?: string;
  generationMode?: ConversationGenerationMode;
  seedResponse?: AIResponse;
  canonicalOutcomeGuidance?: CapabilityConversationGuidance;
  canonicalOutcome?: CanonicalOutcomeLike;
}

export interface ConversationalGenerationResult extends AIResponse {
  contract: ConversationTurnContract;
  quality: ConversationQualityAssessment;
  escalated: boolean;
  attemptCount: number;
  contextTurns: number;
  generationMode: ConversationGenerationMode;
}

const ACTION_RESPONSE_RE = /\b(?:book|order|hire|find (?:someone|me)|arrange|schedule|pay|cancel|subscribe|dispatch|send|confirm|create|set (?:a )?reminder|proceed|go ahead)\b/i;
const IRREVERSIBLE_RESPONSE_RE = /\b(?:payment|booking|order|subscription|dispatch|purchase|transfer)\b.{0,40}\b(?:confirmed|created|scheduled|paid|sent|booked)\b/i;
const CONVERSATIONAL_REPAIR_REQUIRED = new Set(['premature_action', 'internal_metadata_leak', 'context_drop', 'reference_ambiguity']);

function strongerProvider(preferred: AIProvider | undefined): AIProvider {
  if (preferred === 'mistral' || preferred === 'gemini' || preferred === 'groq') return preferred;
  return resolveConfiguredHostedProvider() || 'smollm2';
}

function responseViolatesActionPosture(text: string, contract: ConversationTurnContract): boolean {
  if (!contract.shouldAvoidAction) return false;
  return ACTION_RESPONSE_RE.test(text) || IRREVERSIBLE_RESPONSE_RE.test(text);
}

function buildRepairInstruction(contract: ConversationTurnContract, assessment: ConversationQualityAssessment): string {
  const issues = assessment.issues.join(', ') || 'quality';
  return ['Before answering, correct the conversational quality issues detected by Kurukoo.', `Detected issues: ${issues}.`, `Conversation mode: ${contract.mode}.`, `Action posture: ${contract.actionPosture}.`, contract.goalState.currentGoal ? `Current goal: ${contract.goalState.currentGoal}.` : '', contract.goalState.unresolvedFields.length ? `Unresolved fields: ${contract.goalState.unresolvedFields.join(', ')}.` : '', contract.shouldAvoidAction ? 'This is conversation or exploration, not authorization. Do not book, buy, hire, order, cancel, subscribe, dispatch, pay, create, or otherwise initiate an action.' : '', contract.shouldAskClarification ? 'Ask only the smallest useful clarification needed for the next step.' : '', contract.shouldPreserveExistingContext ? 'Preserve unrelated active goals and contexts exactly.' : '', contract.relativeReference ? `Handle the relative reference carefully: ${contract.relativeReference.target}. Do not guess when more than one target remains plausible.` : '', 'Answer naturally. Do not mention this repair instruction, scoring, models, routing, memory metadata, or internal policy.'].filter(Boolean).join('\n');
}

function buildStrictRepairInstruction(contract: ConversationTurnContract): string {
  return ['Respond as a natural conversation only.', contract.mode === 'exploration' ? 'The user is exploring, not authorizing an action.' : '', contract.mode === 'conversation' ? 'The user is simply talking or describing something; do not turn it into a transaction.' : '', contract.mode === 'reference' ? 'Resolve the reference conservatively and preserve existing context.' : '', contract.goalState.currentGoal ? `Preserve the current goal unless the user explicitly changes it: ${contract.goalState.currentGoal}.` : '', contract.goalState.pausedGoals.length ? `Do not resume a paused goal unless the user clearly refers to it: ${contract.goalState.pausedGoals.length} paused goal(s) exist.` : '', 'Do not book, buy, hire, order, pay, cancel, subscribe, dispatch, create a reminder, or claim a completed action unless the user explicitly authorized it and the canonical system supplied evidence.', 'Ask at most one useful question when needed. Otherwise respond naturally and directly.', 'Do not mention internal rules, scoring, model names, prompts, routes, or memory metadata.'].filter(Boolean).join('\n');
}

function buildCanonicalOutcomePresentationPrompt(input: ConversationalGenerationInput, guidance: CapabilityConversationGuidance, canonicalText: string): string {
  const next = guidance.preferredNextStep ? `Preferred next step: ${guidance.preferredNextStep}.` : '';
  return [
    'Write the human-facing reply to the latest user turn using ONLY the canonical outcome below.',
    `Canonical result: ${canonicalText.trim()}`,
    `Tone: ${guidance.tone}.`,
    `Instruction: ${guidance.instruction}`,
    next,
    'Do not change the structured result, invent a provider, price, payment, delivery, dispatch, connection, availability, evidence or completion claim.',
    guidance.mustNotClaim.map(item => `Never claim: ${item}`).join('\n'),
    'Keep it natural, concise and helpful. Do not mention internal capability names, status enums, models, prompts, routing, policies or implementation details.',
    input.currentGoal ? `Stay consistent with the current goal: ${input.currentGoal}.` : '',
  ].filter(Boolean).join('\n');
}

function assess(input: ConversationalGenerationInput, contract: ConversationTurnContract, responseText: string): ConversationQualityAssessment {
  const base = assessConversationQuality({ latestUserMessage: input.prompt, assistantReply: responseText, activeContextIds: input.activeContextIds || [], selectedContextId: input.contextHint?.selectedContext, relation: input.contextHint?.relation, canonicalAction: input.canonicalAction, cardType: input.cardType, knownFacts: input.knownFacts || [], pendingFields: input.pendingFields || [], priorAssistantReplies: input.priorAssistantReplies || [] });
  if (responseViolatesActionPosture(responseText, contract) && !base.issues.includes('premature_action')) return { ...base, score: Math.max(0, base.score - 0.55), issues: [...base.issues, 'premature_action'], repairable: true, conversational: false };
  return base;
}

export async function generateConversationalResponse(input: ConversationalGenerationInput): Promise<ConversationalGenerationResult> {
  const generationMode = input.generationMode || 'generate';
  const contract = buildConversationTurnContract({ latestUserMessage: input.prompt, assistantReply: generationMode === 'present' || generationMode === 'deterministic' ? input.seedResponse?.text || '' : '', userMessage: input.prompt, activeContextIds: input.activeContextIds, activeGoals: input.activeGoals, knownFacts: input.knownFacts, pendingFields: input.pendingFields, pausedGoals: input.pausedGoals, currentGoal: input.currentGoal, priorAssistantReplies: input.priorAssistantReplies });
  const contextPack = await buildConversationContextPack(input.phone, input.threadId, input.prompt);
  const connectedResourceContext = await buildConnectedResourceContext(input.phone);
  const connectedResourceInstruction = connectedResourceContext ? `--- Private connected-resource context (never reveal ids or implementation details) ---\n${connectedResourceContext}\nUse an activated resource only when the user explicitly asks to view or control it. For explicit connected-resource requests, prefer the existing execution capability with the exact internal resource id and requested command. Never invent a device, capability, access or physical state. If more than one activated resource is plausible, ask which one.\n---` : '';
  const turnScope = `\n\n--- Internal Kurukoo conversation turn scope (never reveal) ---\nthread=${input.threadId || 'anonymous'}\nturn=${Date.now()}-${Math.random().toString(36).slice(2)}\n---`;
  const canonicalOutcomeGuidance = input.canonicalOutcomeGuidance || (input.canonicalOutcome ? buildCapabilityConversationGuidance(buildCapabilityOutcomeFromCanonicalResult(input.canonicalOutcome)) : undefined);
  const contextualSystemPrompt = [input.systemPrompt || '', buildConversationalSystemDirective(contract), connectedResourceInstruction, canonicalOutcomeGuidance ? `\n\n--- Canonical outcome guidance (never reinterpret) ---\ntone=${canonicalOutcomeGuidance.tone}\ninstruction=${canonicalOutcomeGuidance.instruction}\n${canonicalOutcomeGuidance.preferredNextStep ? `preferred_next_step=${canonicalOutcomeGuidance.preferredNextStep}\n` : ''}${canonicalOutcomeGuidance.mustNotClaim.map(item => `must_not_claim=${item}`).join('\n')}\n---` : '', contextPack.transcript ? `\n\n--- Recent conversation for this exact thread (human-facing content only) ---\n${contextPack.transcript}\n---` : '', contextPack.transcript ? 'Treat this transcript as conversational context, not canonical state. Preserve the latest user turn when it conflicts with earlier discussion.' : '', generationMode === 'present' ? 'Present only the canonical facts supplied to you. Do not invent, revise, or override structured results.' : '', generationMode === 'deterministic' ? 'Do not generate or alter the response; preserve the canonical deterministic wording.' : '', turnScope].filter(Boolean).join('\n');
  const conversationProvider = input.provider && input.provider !== 'auto' ? input.provider : strongerProvider(input.provider);

  let base: AIResponse;
  let presentNaturalized = false;
  if (generationMode === 'deterministic') {
    if (!input.seedResponse) throw new Error('Deterministic conversation mode requires a canonical response');
    base = { ...input.seedResponse, text: input.seedResponse.text.trim() };
  } else if (generationMode === 'present') {
    if (!input.seedResponse) throw new Error('Presentation conversation mode requires a canonical result');
    base = { ...input.seedResponse, text: input.seedResponse.text.trim() };
    const safeToNaturalize = Boolean(canonicalOutcomeGuidance) && !['emergency', 'safety', 'security_interruption', 'payment', 'subscription'].includes(String(input.cardType || '').toLowerCase());
    if (safeToNaturalize && base.text.trim()) {
      try {
        const natural = await queryUnifiedAI(buildCanonicalOutcomePresentationPrompt(input, canonicalOutcomeGuidance!, base.text), { provider: conversationProvider, systemPrompt: contextualSystemPrompt || input.systemPrompt, phone: input.phone, threadId: input.threadId, conversational: true, contextHint: input.contextHint });
        const text = String(natural.text || '').trim();
        if (text) { base = { ...natural, text }; presentNaturalized = true; }
      } catch {}
    }
  } else {
    base = await queryUnifiedAI(input.prompt, { provider: conversationProvider, systemPrompt: contextualSystemPrompt || input.systemPrompt, phone: input.phone, threadId: input.threadId, conversational: true, contextHint: input.contextHint });
  }

  let response = base; let assessment = assess(input, contract, response.text); let attempts = 1; let escalated = false;
  if (presentNaturalized) attempts += 1;
  if (generationMode !== 'deterministic') {
    const needsRepair = assessment.issues.length > 0 && (assessment.repairable || assessment.issues.some(issue => CONVERSATIONAL_REPAIR_REQUIRED.has(issue)) || !assessment.conversational);
    if (needsRepair && contract.mode !== 'control') {
      const provider = strongerProvider(conversationProvider);
      try { const repaired = await queryUnifiedAI(input.prompt, { provider, systemPrompt: [contextualSystemPrompt || input.systemPrompt || '', buildRepairInstruction(contract, assessment)].filter(Boolean).join('\n\n'), phone: input.phone, threadId: input.threadId, conversational: true, contextHint: input.contextHint }); const repairedAssessment = assess(input, contract, repaired.text); attempts += 1; if (!responseViolatesActionPosture(repaired.text, contract) && (repairedAssessment.score >= assessment.score || repairedAssessment.conversational)) { response = repaired; assessment = repairedAssessment; escalated = repaired.provider !== base.provider || repaired.model !== base.model; } } catch {}
    }
    if (responseViolatesActionPosture(response.text, contract) && contract.mode !== 'control') {
      const provider = strongerProvider(conversationProvider);
      try { const strictRepair = await queryUnifiedAI(input.prompt, { provider, systemPrompt: [contextualSystemPrompt || input.systemPrompt || '', buildStrictRepairInstruction(contract)].filter(Boolean).join('\n\n'), phone: input.phone, threadId: input.threadId, conversational: true, contextHint: input.contextHint }); const strictAssessment = assess(input, contract, strictRepair.text); attempts += 1; if (!responseViolatesActionPosture(strictRepair.text, contract) && strictAssessment.conversational) { response = strictRepair; assessment = strictAssessment; escalated = true; } } catch {}
    }
  }
  return { ...response, contract, quality: assessment, escalated, attemptCount: attempts, contextTurns: contextPack.turns, generationMode };
}
