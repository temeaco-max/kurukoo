import { classifyWithFastText, type FastTextResult } from './fastTextService.js';
import { resolveConvergedSkillBehaviour, getAllConvergedSkillNames } from './skillBehaviourConvergence.js';
import { getSkillCategoryConverged } from './skillCatalogueConvergence.js';

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

function normalizeFastTextSkill(intent: string | undefined): string | null {
  if (!intent) return null;
  const prefix = 'skill_route_';
  const candidate = intent.startsWith(prefix) ? intent.slice(prefix.length) : intent;
  return getAllConvergedSkillNames().includes(candidate) ? candidate : null;
}

function catalogueSkill(text: string): string | null {
  const lower = text.toLowerCase();
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
  const fast: FastTextResult | null = classifyWithFastText(text);
  const fastSkill = fast?.skill && getAllConvergedSkillNames().includes(fast.skill)
    ? fast.skill
    : normalizeFastTextSkill(fast?.intent);
  const skill = fastSkill || catalogueSkill(text);
  const intent = fast?.intent || skill;
  const category = skill ? getSkillCategoryConverged(skill) : null;
  if (fast && skill) return { conversationAct: null, intent: fastSkill ? skill : intent, skill, category, confidence: Math.max(fast.confidence, fastSkill ? 0.93 : 0), source: fast.source === 'rules' ? 'rules' : fastSkill ? 'fasttext' : 'catalogue' };
  if (fast) return { conversationAct: null, intent: fast.intent, skill: null, category: null, confidence: fast.confidence, source: fast.source === 'rules' ? 'rules' : 'fasttext' };
  if (skill) return { conversationAct: null, intent: skill, skill, category, confidence: 0.95, source: 'catalogue' };
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
