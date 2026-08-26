import { ensureCapabilityFoundation } from './capabilityFoundation.js';
import { getCapabilityRegistration, resolveCapabilityComposition } from './capabilityRegistry.js';
import type { CapabilityActionProposal } from './universalCapabilityProtocol.js';

export interface CapabilityExecutionPlan {
  skill: string;
  registeredSkill: string;
  composition: string[];
  executableCandidates: Array<{ capability: string; actions: string[]; owner: string[]; risk: string; activationState: string }>;
  unresolved: string[];
  cycle?: string[];
}

export function resolveCapabilityExecutionPlan(skill: string): CapabilityExecutionPlan {
  ensureCapabilityFoundation();
  const normalized = String(skill || '').trim().toLowerCase();
  const registration = getCapabilityRegistration(normalized.startsWith('skill.') ? normalized : `skill.${normalized}`) || getCapabilityRegistration(normalized.replace(/^skill\./, ''));
  if (!registration) {
    return { skill: normalized, registeredSkill: normalized, composition: [], executableCandidates: [], unresolved: [normalized] };
  }
  const composition = resolveCapabilityComposition([registration.descriptor.capability]);
  const executableCandidates = composition.ordered
    .filter(item => item.descriptor.kind === 'operation')
    .map(item => ({
      capability: item.descriptor.capability,
      actions: [...item.descriptor.actions],
      owner: [...item.descriptor.owner],
      risk: item.descriptor.risk,
      activationState: item.descriptor.activationState,
    }));
  return {
    skill: normalized.replace(/^skill\./, ''),
    registeredSkill: registration.descriptor.capability,
    composition: composition.ordered.map(item => item.descriptor.capability),
    executableCandidates,
    unresolved: composition.unresolved,
    cycle: composition.cycle,
  };
}

export function resolveCapabilityActionForSkill(skill: string, preferredAction?: string): CapabilityActionProposal | null {
  const plan = resolveCapabilityExecutionPlan(skill);
  if (plan.unresolved.length || plan.cycle?.length || !plan.executableCandidates.length) return null;
  for (const candidate of plan.executableCandidates) {
    const action = preferredAction && candidate.actions.includes(preferredAction) ? preferredAction : undefined;
    if (action) return { capability: candidate.capability, action, arguments: {}, reason: `Resolved ${skill} through the canonical capability composition.` };
  }
  const candidate = plan.executableCandidates[0];
  const fallbackAction = candidate.actions.find(action => !['inspect', 'status', 'recover'].includes(action)) || candidate.actions[0];
  return fallbackAction ? { capability: candidate.capability, action: fallbackAction, arguments: {}, reason: `Resolved ${skill} through the canonical capability composition.` } : null;
}

export default resolveCapabilityExecutionPlan;
