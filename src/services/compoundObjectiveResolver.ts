/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Compound objective recognition and decomposition.
 *
 * A compound objective expresses multiple sub-objectives with an explicit
 * dependency relationship (e.g. "Fix my laptop and sell it when it's ready").
 * The resolver recognises these patterns deterministically — it never invents
 * providers, prices, availability, payment or completion.
 *
 * The resolver is a language-understanding layer only; canonical services
 * remain the sole authority for goal creation, dependency attachment,
 * Economic Request lifecycle, confirmation policy, evidence and notifications.
 */

/** Deterministic conjunction patterns that indicate a compound objective. */
const COMPOUND_CONJUNCTIONS = [
  /\b(.+?)\s+and\s+(.+?)\s+when\s+(.+?)(?:[.!?]|$)/i,
  /\b(.+?)\s*,?\s*and\s+then\s+(.+?)(?:[.!?]|$)/i,
  /^\s*(.+?)\s*,?\s*then\s+(.+?)(?:[.!?]|$)/i,
  /\b(.+?)\s*,?\s*after\s+(.+?)(?:[.!?]|$)/i,
];

function inferSkill(text: string): string {
  const lower = text.toLowerCase();
  if (/laptop|macbook|computer|pc\b/.test(lower)) return 'laptop_repairer';
  if (/tablet|ipad|galaxy tab/.test(lower)) return 'tablet_repairer';
  if (/phone|iphone|android|screen/.test(lower)) return 'phone_repairer';
  if (/sell|market|advertise|list.*for sale/.test(lower)) return 'find_worker';
  if (/clean|tidy/.test(lower)) return 'house_cleaner';
  if (/plumb|leak|pipe|tap|faucet/.test(lower)) return 'plumber';
  if (/electric|wiring|socket|light/.test(lower)) return 'electrician';
  if (/paint|decorat/.test(lower)) return 'painter';
  if (/car|vehicle|engine|brake/.test(lower)) return 'mechanic';
  if (/bike|bicycle/.test(lower)) return 'mechanic';
  return 'find_worker';
}

export interface CompoundSubObjective { skill: string; objective: string; dependsOn?: number }
export interface CompoundDecomposition { parentObjective: string; subObjectives: CompoundSubObjective[] }

export function recognizeCompoundObjective(text: string): CompoundDecomposition | null {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.length < 10) return null;
  const lower = trimmed.toLowerCase();
  const broadOutcome = (subObjectives: CompoundSubObjective[]): CompoundDecomposition => ({ parentObjective: trimmed, subObjectives });
  if (/\b(?:get|sort)\s+(?:my|this)\s+(?:laptop|computer|phone|device)\s+(?:sorted|working|fixed|ready)\b/.test(lower)) return broadOutcome([
    { skill: 'phone_repairer', objective: 'Understand and inspect the device issue' },
    { skill: 'find_worker', objective: 'Find an expert if the device cannot be resolved locally', dependsOn: 0 },
    { skill: 'reminder', objective: 'Keep a follow-up reminder for the device outcome', dependsOn: 1 },
  ]);
  if (/\b(?:somewhere to stay|a place to stay|accommodation|hotel)\b.*\b(?:next week|tomorrow|tonight|this week)\b/.test(lower)) return broadOutcome([
    { skill: 'hotel_deals', objective: 'Find a suitable place to stay for the requested dates' },
    { skill: 'reminder', objective: 'Remind me to review and confirm the accommodation options', dependsOn: 0 },
  ]);
  if (/\b(?:sort out|fix|resolve|repair)\s+(?:my|the)\s+(?:internet|wi[- ]?fi|wifi|router)\b/.test(lower)) return broadOutcome([
    { skill: 'wifi_installer', objective: 'Understand and diagnose the internet or Wi-Fi problem' },
    { skill: 'find_worker', objective: 'Find an internet or network expert if guided checks cannot resolve it', dependsOn: 0 },
    { skill: 'reminder', objective: 'Keep a follow-up reminder until the internet issue is resolved', dependsOn: 1 },
  ]);
  if (/\b(?:get|take)\s+(?:me|to me)\s+to\s+(?:the\s+)?airport\b|\bneed\s+to\s+get\s+to\s+(?:the\s+)?airport\b/.test(lower)) return broadOutcome([
    { skill: 'ride_request', objective: 'Arrange transport to the airport at the requested time' },
    { skill: 'reminder', objective: 'Remind me about the airport journey', dependsOn: 0 },
  ]);
  if (/\b(?:find|buy|get)\b.*\b(?:right|replacement)\s+charger\b/.test(lower)) return broadOutcome([
    { skill: 'phone_repairer', objective: 'Identify the device and compatible charger requirements' },
    { skill: 'product_sourcing', objective: 'Find and compare the right charger from authoritative offers', dependsOn: 0 },
    { skill: 'reminder', objective: 'Keep the charger fulfilment follow-up visible until resolved', dependsOn: 1 },
  ]);
  for (const pattern of COMPOUND_CONJUNCTIONS) {
    const match = pattern.exec(lower);
    if (!match) continue;
    const first = match[1].trim();
    const second = match[2].trim();
    if (!first || !second || first.split(/\s+/).length < 2 || second.split(/\s+/).length < 2) continue;
    const firstVerb = first.split(/\s+/)[0];
    const secondVerb = second.split(/\s+/)[0];
    if (firstVerb === secondVerb && first === second) continue;
    const subObjectives: CompoundSubObjective[] = [
      { skill: inferSkill(first), objective: first },
      { skill: inferSkill(second), objective: second, dependsOn: 0 },
    ];
    return { parentObjective: trimmed, subObjectives };
  }
  return null;
}

export function resolveSubGoalSkill(subObjectiveText: string): string {
  return inferSkill(subObjectiveText);
}
