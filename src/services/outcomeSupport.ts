export const USER_OUTCOME_VERBS = ['help','fix','solve','check','diagnose','find','get','book','buy','order','arrange','organise','clean','configure','connect','recover','replace','deliver','contact','schedule','monitor','watch'] as const;
export type UserOutcomeVerb = typeof USER_OUTCOME_VERBS[number];
const VERB_PATTERNS: Array<[RegExp, UserOutcomeVerb]> = [
  ...USER_OUTCOME_VERBS.map(verb => [new RegExp(`\\b${verb}(?:ing|ed)?\\b`, 'i'), verb] as [RegExp, UserOutcomeVerb]),
  [/\bkeep an eye on\b|\btell me if anything changes\b/i, 'monitor'],
  [/\blook after\b|\bwatch for\b/i, 'watch'],
];
export function detectUserOutcomeVerb(text: string): UserOutcomeVerb | undefined {
  return VERB_PATTERNS.find(([pattern]) => pattern.test(String(text || '')))?.[1];
}
export function hasUserOutcomeLanguage(text: string): boolean {
  return Boolean(detectUserOutcomeVerb(text));
}
export function isDirectOutcomeRequest(text: string): boolean {
  const value = String(text || '').trim();
  if (!value) return false;
  return hasUserOutcomeLanguage(value) || /^(?:can|could|would|please|i need|i want|help me|something is wrong|what can you do)\b/i.test(value);
}
