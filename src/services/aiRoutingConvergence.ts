/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { classifyWithFastText, type FastTextResult } from './fastTextService.js';
import { resolveConvergedSkillBehaviour, getAllConvergedSkillNames } from './skillBehaviourConvergence.js';
import { getSkillCategoryConverged } from './skillCatalogueConvergence.js';

// FASTTEXT BOUNDARY (canonical decision):
// FastText is NOT a first-line classifier for conversational routing. The canonical
// path is rules (conversation acts) → skill catalogue. classifyWithFastText() is a
// downstream, explicitly-secondary hint used only when rules and catalogue both fail,
// with capped confidence so it can never satisfy the canonical path on its own
// (shouldEscalateToAi escalates below 0.72). FastText remains valuable for cheap
// hints/enrichment, offline evaluation/training and narrow specialist support.
export const FASTTEXT_HINT_MAX_CONFIDENCE = 0.7;

export interface AiRoutingSignal {
  conversationAct: string | null;
  intent: string | null;
  skill: string | null;
  category: string | null;
  confidence: number;
  source: 'rules' | 'fasttext' | 'catalogue' | 'none';
}

const ACT_PATTERNS: Array<[RegExp, string]> = [
  [/^(hi|hello|hey|hiya|howdy|greetings|good morning|good afternoon|good evening)[!,. ]*$/i, 'greeting'],
  [/^(thanks|thank you|thx|cheers|much appreciated)[!,. ]*$/i, 'thanks'],
  [/^(bye|goodbye|see you|see ya|talk later)[!,. ]*$/i, 'farewell'],
  [/^(yes|yeah|yep|yup|okay|ok|sure|alright)[!,. ]*$/i, 'confirmation'],
  [/^(no|nope|nah|not really)[!,. ]*$/i, 'rejection'],
  [/\b(i meant|i mean|actually i meant|my mistake|correction)\b/i, 'correction'],
  [/\b(can you explain|what do you mean|what does that mean|i don't understand|explain that)\b/i, 'clarification'],
  [/\b(how do i|how to|show me how|teach me how|walk me through|tutorial|guide me)\b/i, 'how_to'],
  [/\b(status|where is my|what happened to|is it booked|is it ready|any update)\b/i, 'status'],
  [/\b(cancel|stop|never mind|forget that)\b/i, 'cancel'],
];

function detectAct(text: string): string | null {
  const value = text.trim();
  for (const [pattern, act] of ACT_PATTERNS) if (pattern.test(value)) return act;
  return null;
}

function catalogueSkill(text: string): string | null {
  const lower = text.toLowerCase();
  // Specialist disambiguation: an explicit device subtype overrides the base repair
  // skill. Without this, the base phone_repairer aliases (e.g. 'screen repair')
  // out-match the specialist skill purely by catalogue iteration order.
  const specialists: Array<[RegExp, string]> = [
    [/\bmacbook\b|\blaptop\b|\bcomputer\b|\bpc\b/, 'laptop_repairer'],
    [/\bipad\b|\btablet\b/, 'tablet_repairer'],
  ];
  for (const [pattern, specialist] of specialists) {
    if (pattern.test(lower) && getAllConvergedSkillNames().includes(specialist)) return specialist;
  }
  const pack = resolveConvergedSkillBehaviour(text);
  if (pack) return pack.skill;
  for (const name of getAllConvergedSkillNames()) {
    const phrase = name.replace(/_/g, ' ').toLowerCase();
    if (phrase.length >= 4 && lower.includes(phrase)) return name;
  }
  return null;
}

export function classifyAiRoutingSignal(text: string): AiRoutingSignal {
  const act = detectAct(text);
  if (act) return { conversationAct: act, intent: act, skill: null, category: null, confidence: 0.999, source: 'rules' };
  const skill = catalogueSkill(text);
  if (skill) return { conversationAct: null, intent: skill, skill, category: getSkillCategoryConverged(skill), confidence: 0.95, source: 'catalogue' };
  // Secondary FastText hint — only reached when rules and the skill catalogue both fail.
  // Never a first-line classification: confidence is capped below the escalation threshold.
  const fast: FastTextResult | null = classifyWithFastText(text);
  if (fast) return { conversationAct: null, intent: fast.intent, skill: null, category: null, confidence: Math.min(fast.confidence, FASTTEXT_HINT_MAX_CONFIDENCE), source: 'fasttext' };
  return { conversationAct: null, intent: null, skill: null, category: null, confidence: 0, source: 'none' };
}

export function shouldEscalateToAi(signal: AiRoutingSignal, text: string): boolean {
  if (signal.conversationAct && ['greeting', 'thanks', 'farewell', 'confirmation', 'rejection'].includes(signal.conversationAct)) return false;
  if (signal.source === 'none') return true;
  if (signal.confidence < 0.72) return true;
  // Informational/clarification/status acts require a model response — escalate.
  if (signal.conversationAct && ['how_to', 'clarification', 'status'].includes(signal.conversationAct)) return true;
  if (/\b(why|compare|which is better|negotiate|arrange|coordinate|same[- ]day|multiple|instead|actually|what are my options)\b/i.test(text)) return true;
  return false;
}
