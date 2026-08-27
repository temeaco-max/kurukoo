import type { AIProvider, ConversationalContextHint } from './unifiedAiEngine.js';
import { queryUnifiedAI } from './unifiedAiEngine.js';
import { assessConversationQuality } from './conversationQualityService.js';
import { buildConversationTurnContract, buildConversationalSystemDirective } from './conversationTurnContractService.js';
import { interpretConversationSemantics } from './semanticConversationInterpreter.js';
import { routeIntent as legacyRouteIntent } from './legacyIntentRouter.js';
import type { IntentRoutingResult } from '../types.js';

const CANONICAL_LOOKUP_RE = /^(remember that|what do you remember|what do you know about me|what notifications|show (?:my )?notifications|what updates|show (?:my )?updates|show nearby|nearby active|radar|where are providers|balance|points|wallet|credits|remind me|set (?:me )?a reminder|cancel (?:the )?reminder|pause(?: that| it)?$|resume(?: that| it)?$|cancel that$|cancel it$|stop following$|stop checking$|continue checking$|what provider and model|what have you been doing|what are you doing|reset onboarding)/i;
const SAFETY_RE = /\b(?:emergency|immediate danger|life[- ]threatening|ambulance|fire service|police|safety contact|security interruption|stolen phone|otp|recovery code)\b/i;
const DEVICE_SUPPORT_RE = /\b(?:check|diagnose|troubleshoot|investigate|help(?: me)? with)\b.*\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b|\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b.*\b(?:slow|slowly|sluggish|offline|not working|won't connect|will not connect|malware|virus|charging|diagnostic|diagnostics)\b/i;

function shouldDelegateToCanonicalRouter(message: string, semantic: Awaited<ReturnType<typeof interpretConversationSemantics>>): boolean {
  if (CANONICAL_LOOKUP_RE.test(message.trim())) return true;
  if (SAFETY_RE.test(message)) return true;
  if (DEVICE_SUPPORT_RE.test(message)) return true;
  if (semantic.mode === 'action' || semantic.mode === 'control' || semantic.mode === 'reference') return true;
  if (semantic.explicitAuthorization) return true;
  return false;
}

function progressFor(mode: string): IntentRoutingResult['progressStage'] {
  if (mode === 'clarification') return 'understanding';
  if (mode === 'exploration') return 'information';
  return 'complete';
}

export async function routeIntent(query: string, phone?: string, provider?: AIProvider, contextHint?: ConversationalContextHint, threadId?: string): Promise<IntentRoutingResult> {
  const message = query.trim();
  if (!message) return legacyRouteIntent(query, phone, provider, contextHint, threadId);

  const semantic = await interpretConversationSemantics({
    message,
    phone,
    threadId,
    provider: provider || 'auto',
    contextHint,
    activeGoals: contextHint?.activeContexts?.map(context => `${context.type}:${context.contextId}:${context.state || 'active'}`),
    pendingFields: contextHint?.activeContexts?.flatMap(context => context.pendingFields || []).slice(0, 12),
  });

  if (shouldDelegateToCanonicalRouter(message, semantic) || semantic.confidence < 0.55) {
    return legacyRouteIntent(query, phone, provider, contextHint, threadId);
  }

  const contract = buildConversationTurnContract({
    latestUserMessage: message,
    userMessage: message,
    assistantReply: '',
    activeContextIds: contextHint?.activeContexts?.map(context => context.contextId),
    pendingFields: semantic.missingInformation,
    semanticInterpretation: semantic,
  });
  const prompt = [
    buildConversationalSystemDirective(contract),
    'Respond naturally to the user’s latest turn.',
    'You are answering, exploring, clarifying, or continuing a conversation—not executing an action.',
    'Do not turn conversation into a booking, purchase, payment, cancellation, dispatch, provider claim, reminder creation, or other irreversible action.',
    'Do not mention routing, semantic interpretation, models, prompts, policies, internal IDs, or implementation details.',
  ].join('\n');

  const ai = await queryUnifiedAI(message, {
    provider: provider || 'auto',
    phone,
    threadId,
    systemPrompt: prompt,
    conversational: true,
    contextHint,
  });
  let reply = ai.text.trim();
  const quality = assessConversationQuality({
    latestUserMessage: message,
    assistantReply: reply,
    activeContextIds: contextHint?.activeContexts?.map(context => context.contextId),
    selectedContextId: contextHint?.selectedContext,
    relation: contextHint?.relation,
    pendingFields: semantic.missingInformation,
  });

  if (!reply || !quality.conversational) {
    const repair = await queryUnifiedAI(message, {
      provider: provider || 'auto',
      phone,
      threadId,
      systemPrompt: `${prompt}\nRepair the response so it is natural, direct, context-preserving, and free of internal metadata or premature action language. Ask at most one useful clarification when needed.`,
      conversational: true,
      contextHint,
    });
    reply = repair.text.trim() || reply;
  }

  return {
    skill: 'general_question',
    reply,
    cardData: { type: 'semantic_conversation', hidden: true },
    modelProvider: ai.provider,
    model: ai.model,
    classificationSource: ai.provider === 'Kurukoo Template' ? 'fallback' : 'rules',
    intentConfidence: semantic.confidence,
    extractionSource: Object.keys(semantic.entities).length ? 'generative' : 'none',
    extractedEntities: semantic.entities,
    progressStage: progressFor(semantic.mode),
  };
}
