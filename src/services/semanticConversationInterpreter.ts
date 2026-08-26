import { queryUnifiedAI, type AIProvider, type ConversationalContextHint } from './unifiedAiEngine.js';
import { buildConversationContextPack } from './conversationContextPackService.js';
import { chooseInferenceProvider } from './aiInferencePolicy.js';

export type SemanticConversationMode = 'conversation' | 'exploration' | 'action' | 'reference' | 'clarification' | 'control';
export type SemanticSpeechAct = 'greeting' | 'thanks' | 'farewell' | 'question' | 'request' | 'instruction' | 'correction' | 'confirmation' | 'rejection' | 'status' | 'conversation' | 'unknown';

export interface SemanticConversationInterpretation {
  mode: SemanticConversationMode;
  speechAct: SemanticSpeechAct;
  intent: string;
  skillHint?: string;
  capabilityHint?: string;
  explicitAuthorization: boolean;
  requiresClarification: boolean;
  topicShift: boolean;
  resumption: boolean;
  references: Array<{ text: string; target?: string; confidence: number }>;
  entities: Record<string, unknown>;
  missingInformation: string[];
  goalStatements: string[];
  responseStrategy: 'answer' | 'clarify' | 'propose' | 'continue' | 'control';
  confidence: number;
  rationale?: string;
  source: 'llm' | 'fallback';
  provider?: string;
  model?: string;
}

export interface SemanticConversationInput {
  message: string;
  phone?: string;
  threadId?: string;
  provider?: AIProvider;
  contextHint?: ConversationalContextHint;
  activeGoals?: string[];
  pausedGoals?: string[];
  knownFacts?: string[];
  pendingFields?: string[];
}

const MODES = new Set<SemanticConversationMode>(['conversation', 'exploration', 'action', 'reference', 'clarification', 'control']);
const ACTS = new Set<SemanticSpeechAct>(['greeting', 'thanks', 'farewell', 'question', 'request', 'instruction', 'correction', 'confirmation', 'rejection', 'status', 'conversation', 'unknown']);
const STRATEGIES = new Set(['answer', 'clarify', 'propose', 'continue', 'control']);

function cleanString(value: unknown, max = 220): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, max) : undefined;
}

function cleanStringArray(value: unknown, maxItems = 8, maxLength = 160): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, maxItems).map(item => item.slice(0, maxLength));
}

function parseJsonObject(text: string): Record<string, unknown> | null {
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

function normalizeConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function fallbackInterpretation(input: SemanticConversationInput): SemanticConversationInterpretation {
  const text = input.message.trim();
  const explicitAuthorization = /^(?:please\s+)?(?:book|buy|order|hire|arrange|schedule|pay|cancel|subscribe|dispatch|send|confirm|create|set (?:a )?reminder|go ahead|do it|handle it)\b/i.test(text) || /\b(?:go ahead and|please book|please order|please hire|please arrange)\b/i.test(text);
  const control = /^(?:pause|resume|cancel|stop|forget|continue|go back)\b/i.test(text);
  const reference = /^(?:back to|continue with|resume|go back to|about the .* again)\b/i.test(text) || /\b(?:that one|the other one|same place|same person|that request|this request)\b/i.test(text);
  const clarification = /\?|\b(?:which one|what do you need|where|when|how much|can you explain|why)\b/i.test(text) && !explicitAuthorization;
  const exploration = /\b(?:maybe|might|wondering|thinking about|what do you think|what would you do|considering|not sure|looking into)\b/i.test(text);
  const greeting = /^(?:hi|hello|hey|hiya|good morning|good afternoon|good evening)\b/i.test(text);
  let mode: SemanticConversationMode = 'conversation';
  if (control) mode = 'control'; else if (reference) mode = 'reference'; else if (clarification) mode = 'clarification'; else if (exploration) mode = 'exploration'; else if (explicitAuthorization) mode = 'action';
  return {
    mode,
    speechAct: greeting ? 'greeting' : explicitAuthorization ? 'instruction' : clarification ? 'question' : mode === 'exploration' ? 'question' : 'conversation',
    intent: mode === 'action' ? 'action_request' : 'general_conversation',
    explicitAuthorization,
    requiresClarification: clarification,
    topicShift: /^(?:actually|by the way|btw|different question|separately|unrelated|also|one more thing)\b/i.test(text),
    resumption: reference,
    references: [],
    entities: {},
    missingInformation: [],
    goalStatements: [],
    responseStrategy: mode === 'action' ? 'propose' : mode === 'clarification' ? 'clarify' : mode === 'control' ? 'control' : 'answer',
    confidence: 0.42,
    source: 'fallback',
  };
}

function sanitize(value: Record<string, unknown>, input: SemanticConversationInput, ai: { provider?: string; model?: string }): SemanticConversationInterpretation {
  const fallback = fallbackInterpretation(input);
  const modeValue = cleanString(value.mode, 40) as SemanticConversationMode | undefined;
  const speechValue = cleanString(value.speechAct, 40) as SemanticSpeechAct | undefined;
  const strategyValue = cleanString(value.responseStrategy, 40);
  const requestedMode = modeValue && MODES.has(modeValue) ? modeValue : fallback.mode;
  const requestedAct = speechValue && ACTS.has(speechValue) ? speechValue : fallback.speechAct;
  const references = Array.isArray(value.references) ? value.references.slice(0, 8).map(item => {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    return { text: cleanString(row.text, 160) || '', target: cleanString(row.target, 180), confidence: normalizeConfidence(row.confidence) };
  }).filter(item => item && item.text) as Array<{ text: string; target?: string; confidence: number }> : [];
  const entities = value.entities && typeof value.entities === 'object' && !Array.isArray(value.entities) ? Object.fromEntries(Object.entries(value.entities as Record<string, unknown>).slice(0, 24).map(([key, item]) => [key.slice(0, 60), typeof item === 'string' ? item.slice(0, 220) : item])) : {};
  let mode = requestedMode;
  let explicitAuthorization = Boolean(value.explicitAuthorization);
  let requiresClarification = Boolean(value.requiresClarification);
  let responseStrategy = strategyValue && STRATEGIES.has(strategyValue) ? strategyValue as SemanticConversationInterpretation['responseStrategy'] : fallback.responseStrategy;

  if (['conversation', 'exploration', 'clarification', 'reference'].includes(mode) && explicitAuthorization) explicitAuthorization = false;
  if (mode === 'exploration' && responseStrategy === 'propose') responseStrategy = 'answer';
  if (mode === 'clarification') requiresClarification = true;
  if (requiresClarification && responseStrategy === 'continue') responseStrategy = 'clarify';
  if ((mode === 'action' || mode === 'control') && !explicitAuthorization && responseStrategy === 'propose') responseStrategy = 'clarify';
  if (explicitAuthorization && !['action', 'control'].includes(mode)) explicitAuthorization = false;

  return {
    mode,
    speechAct: requestedAct,
    intent: cleanString(value.intent, 120) || fallback.intent,
    skillHint: cleanString(value.skillHint, 100),
    capabilityHint: cleanString(value.capabilityHint, 140),
    explicitAuthorization,
    requiresClarification,
    topicShift: Boolean(value.topicShift),
    resumption: Boolean(value.resumption),
    references,
    entities,
    missingInformation: cleanStringArray(value.missingInformation),
    goalStatements: cleanStringArray(value.goalStatements),
    responseStrategy,
    confidence: normalizeConfidence(value.confidence),
    rationale: cleanString(value.rationale, 320),
    source: 'llm',
    provider: ai.provider,
    model: ai.model,
  };
}

function semanticPrompt(input: SemanticConversationInput, transcript: string): string {
  const active = (input.activeGoals || []).slice(0, 6).join(' | ');
  const paused = (input.pausedGoals || []).slice(0, 6).join(' | ');
  const facts = (input.knownFacts || []).slice(0, 8).join(' | ');
  const pending = (input.pendingFields || []).slice(0, 8).join(', ');
  const selectedContext = input.contextHint?.selectedContext || '';
  const relation = input.contextHint?.relation || '';
  const activeContexts = (input.contextHint?.activeContexts || []).slice(0, 8).map(context => `${context.type}:${context.contextId}${context.state ? `:${context.state}` : ''}${context.pendingFields?.length ? ` pending=${context.pendingFields.join(',')}` : ''}`).join(' | ');
  return `Interpret the latest user turn semantically for an operating-system assistant. You are the language understanding layer, not the execution authority. Infer what the user means from natural language, conversation history and context. Do not force the utterance into a product skill merely because a keyword appears.\n\nReturn ONLY valid JSON with these keys:\nmode: one of conversation, exploration, action, reference, clarification, control\nspeechAct: one of greeting, thanks, farewell, question, request, instruction, correction, confirmation, rejection, status, conversation, unknown\nintent: concise semantic intent name\nskillHint: optional Kurukoo skill hint only when genuinely supported by meaning\ncapabilityHint: optional capability class, never an authorization claim\nexplicitAuthorization: boolean — true only when the user clearly authorizes an action\nrequiresClarification: boolean\ntopicShift: boolean\nresumption: boolean\nreferences: array of {text,target?,confidence}\nentities: object containing useful semantic entities without inventing facts\nmissingInformation: array of the few details actually needed for the next useful step\ngoalStatements: array of active user goals expressed in this turn\nresponseStrategy: answer, clarify, propose, continue, control\nconfidence: number 0..1\nrationale: brief internal explanation\n\nImportant: conversational exploration is NOT authorization. A problem description is NOT an action request. A topic change should not erase earlier goals. Resolve pronouns and references from context when possible, but keep ambiguity when it remains. Never invent providers, prices, availability, payments, evidence or completed actions. The canonical Kurukoo system remains the sole authority for execution, identity, consent, payment, Economic Requests, providers, evidence, notifications, memory persistence, Points, referrals, QR, agent state, safety and irreversible actions.\n\nLatest user turn:\n${input.message}\n\nRecent conversation:\n${transcript || '(none)'}\n\nSelected context:\n${selectedContext || '(none)'}\nContext relation:\n${relation || '(none)'}\nActive canonical contexts:\n${activeContexts || '(none)'}\nActive goals:\n${active || '(none)'}\nPaused goals:\n${paused || '(none)'}\nKnown user facts:\n${facts || '(none)'}\nPending fields:\n${pending || '(none)'}\n`;
}

export async function interpretConversationSemantics(input: SemanticConversationInput): Promise<SemanticConversationInterpretation> {
  const fallback = fallbackInterpretation(input);
  try {
    const contextPack = await buildConversationContextPack(input.phone, input.threadId, input.message);
    const decision = chooseInferenceProvider({ task: 'conversation', prompt: input.message, preferred: input.provider });
    const ai = await queryUnifiedAI(semanticPrompt(input, contextPack.transcript || ''), {
      provider: decision.provider,
      phone: input.phone,
      threadId: input.threadId,
      conversational: false,
      contextHint: input.contextHint,
      classificationPrompt: input.message,
      temperature: 0,
      skipMemory: true,
    });
    const parsed = parseJsonObject(ai.text);
    if (!parsed) return fallback;
    const result = sanitize(parsed, input, { provider: ai.provider, model: ai.model });
    if (result.confidence < 0.45) return { ...fallback, provider: ai.provider, model: ai.model };
    return result;
  } catch (error) {
    console.warn('[Semantic Interpreter] LLM interpretation failed; using deterministic fallback:', error);
    return fallback;
  }
}

export { fallbackInterpretation as fallbackSemanticConversationInterpretation };
