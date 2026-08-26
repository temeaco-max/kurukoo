import { ensureCapabilityFoundation } from './capabilityFoundation.js';
import { getCapabilityRegistration, listCapabilityRegistrations, resolveCapabilityComposition, validateCapabilityRegistry } from './capabilityRegistry.js';
import { listCapabilityExecutionAdapters } from './capabilityExtensionService.js';

export type CapabilityRuntimeSnapshot = {
  capabilityCount: number;
  skillCount: number;
  operationCount: number;
  agentToolCount: number;
  adapterCount: number;
  activationCounts: Record<string, number>;
  familyCounts: Record<string, number>;
  invalid: ReturnType<typeof validateCapabilityRegistry>;
};

export type ExecutableCapabilityPlan = {
  skill: string;
  composition: string[];
  executable: Array<{
    capability: string;
    actions: string[];
    owner: string[];
    risk: string;
    activationState: string;
    adapterBound: boolean;
  }>;
  unresolved: string[];
  cycle?: string[];
};

export function resolveSkillCapabilityPlan(skill: string): string[] {
  ensureCapabilityFoundation();
  const normalized = String(skill || '').trim().toLowerCase();
  const registration = getCapabilityRegistration(`skill.${normalized}`) || getCapabilityRegistration(normalized);
  if (!registration) return [];
  const composition = resolveCapabilityComposition([registration.descriptor.capability]);
  if (composition.unresolved.length || composition.cycle?.length) return [];
  return composition.ordered
    .filter(item => item.descriptor.capability !== registration.descriptor.capability)
    .map(item => item.descriptor.capability);
}

export function resolveExecutableCapabilityPlan(skill: string): ExecutableCapabilityPlan {
  ensureCapabilityFoundation();
  const normalized = String(skill || '').trim().toLowerCase();
  const capabilityName = normalized.replace(/^skill\./, '');
  const registration = getCapabilityRegistration(normalized.startsWith('skill.') ? normalized : `skill.${normalized}`) || getCapabilityRegistration(capabilityName);
  if (!registration) return { skill: capabilityName, composition: [], executable: [], unresolved: [`skill.${capabilityName}`] };
  const composition = resolveCapabilityComposition([registration.descriptor.capability]);
  const adapters = new Set(listCapabilityExecutionAdapters().map(adapter => adapter.capability));
  return {
    skill: capabilityName,
    composition: composition.ordered.map(item => item.descriptor.capability),
    executable: composition.ordered
      .filter(item => item.descriptor.kind === 'operation')
      .map(item => ({
        capability: item.descriptor.capability,
        actions: [...item.descriptor.actions],
        owner: [...item.descriptor.owner],
        risk: item.descriptor.risk,
        activationState: item.descriptor.activationState,
        adapterBound: adapters.has(item.descriptor.capability),
      })),
    unresolved: composition.unresolved,
    cycle: composition.cycle,
  };
}

export function resolveCapabilityDependencies(skill: string): string[] {
  return resolveSkillCapabilityPlan(skill);
}

export function resolveSkillCapabilityComposition(skill: string) {
  ensureCapabilityFoundation();
  const normalized = String(skill || '').trim().toLowerCase();
  const registration = getCapabilityRegistration(`skill.${normalized}`) || getCapabilityRegistration(normalized);
  if (!registration) return { requested: [], ordered: [], unresolved: [`skill.${String(skill || '').trim().toLowerCase()}`] };
  return resolveCapabilityComposition([registration.descriptor.capability]);
}

export function getCapabilityRuntimeSnapshot(): CapabilityRuntimeSnapshot {
  ensureCapabilityFoundation();
  const registrations = listCapabilityRegistrations();
  const adapters = listCapabilityExecutionAdapters();
  const activationCounts: Record<string, number> = {};
  const familyCounts: Record<string, number> = {};
  for (const registration of registrations) {
    const descriptor = registration.descriptor;
    activationCounts[descriptor.activationState] = (activationCounts[descriptor.activationState] || 0) + 1;
    familyCounts[descriptor.family] = (familyCounts[descriptor.family] || 0) + 1;
  }
  return {
    capabilityCount: registrations.length,
    skillCount: registrations.filter(item => item.descriptor.kind === 'skill').length,
    operationCount: registrations.filter(item => item.descriptor.kind === 'operation').length,
    agentToolCount: registrations.filter(item => item.descriptor.kind === 'agent_tool').length,
    adapterCount: adapters.length,
    activationCounts,
    familyCounts,
    invalid: validateCapabilityRegistry(),
  };
}
