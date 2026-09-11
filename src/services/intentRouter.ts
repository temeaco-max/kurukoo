/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import type { AIProvider, ConversationalContextHint } from './unifiedAiEngine.js';
import { queryUnifiedAI } from './unifiedAiEngine.js';
import { assessConversationQuality } from './conversationQualityService.js';
import { buildConversationTurnContract, buildConversationalSystemDirective } from './conversationTurnContractService.js';
import { interpretConversationSemantics } from './semanticConversationInterpreter.js';
import { routeIntent as legacyRouteIntent } from './legacyIntentRouter.js';
import { isFeatureEnabled } from './featureFlags.js';
import type { IntentRoutingResult } from '../types.js';

/** Derive a market country code from phone number or context hint. Used by
 * feature flag gating so intent routing respects UK vs NG market rules. */
function deriveMarketCountry(phone?: string, contextHint?: ConversationalContextHint): string {
  if (contextHint && typeof contextHint.marketCountry === 'string' && contextHint.marketCountry) return contextHint.marketCountry.toLowerCase();
  if (!phone) return 'ng';
  const cleaned = String(phone).replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+234')) return 'ng';
  if (cleaned.startsWith('+44')) return 'gb';
  if (cleaned.startsWith('+233')) return 'gh';
  if (cleaned.startsWith('+254')) return 'ke';
  if (cleaned.startsWith('+')) {
    const cc = cleaned.slice(1, 3);
    if (cc === '234') return 'ng';
    if (cc === '44') return 'gb';
    if (cc === '233') return 'gh';
    if (cc === '254') return 'ke';
  }
  return 'ng';
}

/** Check whether the detected market is gated for a feature family.
 * Returns true when the feature is enabled for the market — meaning the
 * market is *open* for that capability. Returns false when gated off. */
function isMarketOpenFor(flagName: string, phone?: string, contextHint?: ConversationalContextHint): boolean {
  const country = deriveMarketCountry(phone, contextHint);
  return isFeatureEnabled(country, flagName);
}
const CANONICAL_LOOKUP_RE = /^(remember that|what do you remember|what do you know about me|what notifications|show (?:my )?notifications|what updates|show (?:my )?updates|mark (?:all\s+)?(?:notifications?|updates?)(?:\s+#?\d+)?\s+(?:as\s+)?(?:read|seen|handled)|dismiss (?:all\s+)?(?:notifications?|updates?)(?:\s+#?\d+)?\s+(?:as\s+)?(?:read|seen|handled)|show nearby|nearby active|radar|where are providers|balance|points|wallet|credits|remind me|set (?:me )?a reminder|cancel (?:the )?reminder|pause(?: that| it)?$|resume(?: that| it)?$|cancel that$|cancel it$|stop following$|stop checking$|continue checking$|what provider and model|what have you been doing|what are you doing|reset onboarding|(?:get|take|drive|bring)\s+me\s+(?:to|from)|(?:need|want)\s+to\s+(?:get|be)\s+(?:to|in)|(?:find|book|hire)\s+(?:me\s+)?(?:a\s+)?(?:bus|taxi|ride|driver|train|ferry|car)\b|(?:airport|station|transport|ride|travel|bus|taxi|train|ferry|journey|trip)\b[\s\S]*\b(?:tomorrow|today|tonight|by\s+\d|arrive|arrival|leave|leaving|cheapest|fastest|quickest)\b)/i;
const TRANSPORT_OUTCOME_RE = /\b(?:get|take|drive|bring)\s+me\s+(?:to|from)\b|\b(?:need|want)\s+to\s+(?:get|be)\s+(?:to|in)\b|\b(?:find|book|hire)\s+(?:me\s+)?(?:a\s+)?(?:bus|taxi|ride|driver|train|ferry|car)\b|\b(?:airport|station|transport|ride|travel|bus|taxi|train|ferry|journey|trip)\b[\s\S]*\b(?:tomorrow|today|tonight|by\s+\d|arrive|arrival|leave|leaving|cheapest|fastest|quickest)\b/i;
const SAFETY_RE = /\b(?:emergency|immediate danger|life[- ]threatening|ambulance|fire service|police|safety contact|security interruption|stolen phone|otp|recovery code)\b/i;
const DEVICE_SUPPORT_RE = /\b(?:check|diagnose|troubleshoot|investigate|help(?: me)? with)\b.*\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b|\b(?:wi-?fi|network|internet|device|phone|iphone|ipad|laptop|macbook|computer|tv|camera|cctv|router|iot)\b.*\b(?:slow|slowly|sluggish|offline|not working|won't connect|will not connect|malware|virus|charging|diagnostic|diagnostics)\b/i;
const GUIDED_DEVICE_RE = /\b(?:walk|guide) me through\b.*\b(?:safe checks?|checks?|phone|device|laptop|computer|wi-?fi|internet|network)\b|\b(?:safe checks?|what can i check)\b.*\b(?:phone|device|laptop|computer|wi-?fi|internet|network)\b/i;
const TUTOR_OUTCOME_RE = /\b(?:find|hire|book|get|need|want|looking)\b[\s\S]*\b(?:tutor|tutoring|teacher|teach(?:ing)?|lesson|lessons|guitar)\b|\b(?:tutor|tutoring|teacher|teach(?:ing)?|lesson|lessons|guitar)\b[\s\S]*\b(?:find|hire|book|get|need|want|looking)\b/i;
const AUTOMOTIVE_SERVICE_OUTCOME_RE = /\b(?:car|vehicle|auto|engine|tyre|tire|brake|battery)\b[\s\S]*\b(?:mechanic|repair|fix|service|diagnos(?:e|is)|breakdown|broken)\b|\b(?:mechanic|repair|fix|service|diagnos(?:e|is)|breakdown|broken)\b[\s\S]*\b(?:car|vehicle|auto|engine|tyre|tire|brake|battery)\b/i;
const INTERNET_SERVICE_OUTCOME_RE = /\b(?:sort out|fix|install|set[ -]?up|arrange|find|book|need|want|help)\b[\s\S]*\b(?:wi-?fi|internet|broadband|router|network)\b|\b(?:wi-?fi|internet|broadband|router|network)\b[\s\S]*\b(?:installer|technician|provider|repair|fix|set[ -]?up|not working|slow)\b/i;
const HEALTHCARE_OUTCOME_RE = /\b(?:find|book|arrange|need|want|see|speak(?:\s+to)?|consult)\b[\s\S]*\b(?:doctor|clinic|hospital|healthcare|health care|dermatologist|dentist|paediatrician|pediatrician|nurse|specialist|appointment)\b|\b(?:doctor|clinic|hospital|healthcare|health care|dermatologist|dentist|paediatrician|pediatrician|nurse|specialist)\b[\s\S]*\b(?:appointment|available|availability|consult|see|book)\b/i;
const TOPIC_OUTCOME_RE = /^(?:ask|share|post)\s+(?:with|to)\s+the\s+community\b/i;
const COMMUNICATION_CONTINUATION_RE = /^(?:resolve the recipient for this message|choose an available channel for this message|confirm(?: and)? send(?:ing)? this message|copy this message)\b/i;

function shouldDelegateDeterministically(message: string): boolean {
  // Deterministic prefix of shouldDelegateToCanonicalRouter: these regex
  // outcomes never require AI interpretation, so evaluate them before any
  // model call (AGENTS.md §20 — cheapest sufficient mechanism first).
  if (CANONICAL_LOOKUP_RE.test(message.trim()) || TRANSPORT_OUTCOME_RE.test(message)) return true;
  if (SAFETY_RE.test(message)) return true;
  if (GUIDED_DEVICE_RE.test(message)) return true;
  if (DEVICE_SUPPORT_RE.test(message)) return true;
  if (TUTOR_OUTCOME_RE.test(message)) return true;
  if (AUTOMOTIVE_SERVICE_OUTCOME_RE.test(message)) return true;
  if (INTERNET_SERVICE_OUTCOME_RE.test(message)) return true;
  if (HEALTHCARE_OUTCOME_RE.test(message)) return true;
  if (TOPIC_OUTCOME_RE.test(message)) return true;
  if (COMMUNICATION_CONTINUATION_RE.test(message)) return true;
  return false;
}

function shouldDelegateToCanonicalRouter(message: string, semantic: Awaited<ReturnType<typeof interpretConversationSemantics>>): boolean {
  if (shouldDelegateDeterministically(message)) return true;
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

  // Derive the market country for feature-flag gating.
  // The roadmap (PA-3) requires the intent router to consult featureFlags
  // so UK vs NG market gating (Points/currency, available skills) happens
  // on the critical path — not just in a registry nobody reads.
  const marketCountry = deriveMarketCountry(phone, contextHint);

  // Feature-flag gate: if a country is restricted for a capability family,
  // route through the legacy router which already handles availability fallback.
  // Currently gates `pointsEngine` (Points/currency availability) and
  // country-specific skills (UK life-admin, diaspora payments).
  if (phone && !phone.startsWith('anon_')) {
    const pointsGated = isFeatureEnabled(marketCountry, 'points_engine');
    if (!pointsGated) {
      // Points/currency not available in this market — route to legacy which
      // knows how to fall back without assuming a points economy exists.
      return legacyRouteIntent(query, phone, provider, contextHint, threadId);
    }
  }

  // Deterministic gate first: route without any model call when the regex
  // layer already resolves the turn (AGENTS.md §20/§35). AI interpretation
  // is the exception, not the operating system.
  if (shouldDelegateDeterministically(message)) {
    return legacyRouteIntent(query, phone, provider, contextHint, threadId);
  }

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
