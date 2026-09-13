/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Capability & Resource Discovery Seam
 *
 * Canonical boundary through which the Intelligence Runtime discovers
 * what capabilities are available for a given skill/context and what
 * resources (providers, businesses, agents, products, channels, devices)
 * could potentially satisfy those capabilities.
 *
 * This is NOT a second provider directory, agent runtime, or execution
 * system. It reuses the existing canonical owners:
 *   - capabilityRegistry         → capability enumeration & composition
 *   - capabilityFoundation       → skill↔capability registration
 *   - skillFlows                 → economic categories, requirements, payment models
 *   - skillCatalogueConvergence  → local-market skill extensions
 *   - universalCapabilityProtocol → canonical operation descriptors
 *   - discoveryNetwork            → provider/business discovery (query-based, delegated)
 *   - agentRuntime                → agent discovery (query-based, delegated)
 *   - productSourcing             → product discovery (query-based, delegated)
 *
 * Static capability enumeration (capabilities + resource types) is synchronous
 * and cheap. Actual entity discovery (providers, agents, products) is async and
 * delegated to the canonical services — the Runtime never fabricates inventory.
 */

import { getCapabilityRegistration, resolveCapabilityComposition } from './capabilityRegistry.js';
import { ensureCapabilityFoundation } from './capabilityFoundation.js';
import { getSkillCapabilities, getEconomicCategory, getSkillRequirements, ECONOMIC_CATEGORIES, type EconomicCapability } from './skillFlows.js';
import {
  getCanonicalOperationDescriptor,
  type CapabilityActivationState,
  type CapabilityRisk,
  type UniversalCapabilityDescriptor,
} from './universalCapabilityProtocol.js';
import type { AiRoutingSignal } from './aiRoutingConvergence.js';
import type { ConversationalContextHint } from './unifiedAiEngine.js';

// --- Type re-exports for consumers ---
export type { UniversalCapabilityDescriptor, CapabilityActivationState, CapabilityRisk };

// --- Resource type mapping -------------------------------------------------

/**
 * Maps a canonical capability name to the resource types that can satisfy it.
 * This is an inference from the capability's declared owner — not a claim that
 * any specific resource is available. Actual availability comes from the
 * canonical execution boundary.
 */
const RESOURCE_TYPES_BY_CAPABILITY: Record<string, ResourceType[]> = {
  discovery: ['provider', 'business', 'agent', 'device'],
  availability: ['provider', 'business'],
  quote: ['provider', 'business', 'product'],
  verification: ['provider', 'business', 'human'],
  reservation: ['provider', 'business', 'product'],
  payment: ['channel', 'connector'],
  escrow: ['connector'],
  contract: ['human', 'provider'],
  fulfillment: ['provider', 'business', 'agent', 'device'],
  tracking: ['provider', 'business', 'agent', 'device'],
  evidence: ['provider', 'human', 'agent'],
  cancellation: ['provider', 'business', 'agent'],
  dispute: ['human', 'agent'],
  completion: ['provider', 'human', 'agent'],
  // Native atoms (from capabilityFoundation NATIVE_ATOMS)
  observe: ['device', 'agent'],
  view: ['device', 'agent', 'connector'],
  control: ['device', 'connector'],
  communicate: ['channel', 'human', 'agent'],
  notify: ['agent', 'channel'],
  schedule: ['agent'],
  remember: ['agent'],
  delegate: ['agent', 'human'],
  coordinate: ['agent', 'human'],
  locate: ['device', 'agent'],
  authenticate: ['channel', 'connector'],
  authorize: ['human', 'channel'],
  execute: ['agent', 'connector', 'device'],
  recover: ['agent', 'connector'],
  audit: ['agent', 'connector'],
  // Aggregate capabilities
  conversation: ['agent'],
  agent: ['agent', 'human'],
  channel: ['channel'],
  reminder: ['agent'],
  order: ['product', 'provider'],
  subscription: ['product'],
  points: ['product'],
  communication: ['channel', 'human', 'agent'],
  connected_resource: ['device', 'connector'],
};

export type ResourceType =
  | 'provider'
  | 'business'
  | 'agent'
  | 'product'
  | 'human'
  | 'connector'
  | 'device'
  | 'channel';

export type ExecutionMode = 'conversational' | 'economic' | 'agentic' | 'informational';

// --- Discovery result types -------------------------------------------------

export interface CapabilityDiscoveryResult {
  capability: string;
  descriptor: UniversalCapabilityDescriptor | null;
  activationState: CapabilityActivationState;
  owner: string[];
  risk: CapabilityRisk;
  actions: string[];
  resourceTypes: ResourceType[];
}

export interface DiscoveredResourceRef {
  id: string;
  type: ResourceType;
  name: string;
  capability: string;
  activationState: CapabilityActivationState;
  evidenceLevel?: string;
  available: boolean;
}

export interface PlanStep {
  step: number;
  capability: string;
  action?: string;
  resourceId?: string;
  rationale?: string;
  requiresApproval: boolean;
  commercial: boolean;
}

export interface IntelligenceStructuredPlan {
  goal: string;
  intent: string;
  capabilitiesRequired: string[];
  candidateResources: DiscoveredResourceRef[];
  sequence: PlanStep[];
  constraints: string[];
  authorizationNeeded: boolean;
  approvalNeeded: boolean;
  commercialRequirements?: string;
  executionMode: ExecutionMode;
  evidenceRequirements: string[];
  fallback?: IntelligenceFallbackPlan;
}

export interface IntelligenceFallbackPlan {
  strategy: 'alternative_resource' | 'alternative_capability' | 'defer' | 'clarify';
  alternativeCapability?: string;
  reason?: string;
}

export interface IntelligencePlanInput {
  message: string;
  routingSignal: AiRoutingSignal;
  isGuest: boolean;
  contextHint?: ConversationalContextHint;
}

// --- Capability discovery ---------------------------------------------------

/**
 * Enumerate the canonical capabilities registered for a given skill,
 * including the resource types that can satisfy each capability.
 *
 * Reuses: capabilityFoundation (registration), capabilityRegistry (composition),
 * skillFlows (economic capabilities), universalCapabilityProtocol (descriptors).
 */
export function discoverCapabilitiesForSkill(skill: string): CapabilityDiscoveryResult[] {
  ensureCapabilityFoundation();
  const results: CapabilityDiscoveryResult[] = [];
  const seen = new Set<string>();

  const skillName = String(skill || '').trim().toLowerCase();
  if (skillName && skillName !== 'general_question') {
    // 1. Skill-level capability registration
    const registration = getCapabilityRegistration(`skill.${skillName}`);
    if (registration?.descriptor) {
      const resourceTypes = RESOURCE_TYPES_BY_CAPABILITY[registration.descriptor.family] || [];
      results.push({
        capability: registration.descriptor.capability,
        descriptor: registration.descriptor,
        activationState: registration.descriptor.activationState,
        owner: registration.descriptor.owner,
        risk: registration.descriptor.risk,
        actions: registration.descriptor.actions,
        resourceTypes,
      });
      seen.add(registration.descriptor.capability);
    }
    // 2. Composition — the atomic capabilities the skill decomposes to
    const composition = resolveCapabilityComposition([`skill.${skillName}`]);
    for (const reg of composition.ordered) {
      const capName = reg.descriptor.capability;
      if (seen.has(capName) || capName.startsWith('skill.')) continue;
      seen.add(capName);
      const resourceTypes = RESOURCE_TYPES_BY_CAPABILITY[reg.descriptor.family] || [];
      results.push({
        capability: capName,
        descriptor: reg.descriptor,
        activationState: reg.descriptor.activationState,
        owner: reg.descriptor.owner,
        risk: reg.descriptor.risk,
        actions: reg.descriptor.actions,
        resourceTypes,
      });
    }
  }

    // 3. Canonical operation descriptors from the skill's economic capabilities
  const skillCaps = getSkillCapabilities(skillName);
  for (const atom of skillCaps) {
    if (seen.has(`atomic.${atom}`)) continue;
    seen.add(`atomic.${atom}`);
    const descriptor = getCanonicalOperationDescriptor(`atomic.${atom}`) || null;
    const resourceTypes = RESOURCE_TYPES_BY_CAPABILITY[atom] || [];
    results.push({
      capability: `atomic.${atom}`,
      descriptor,
      activationState: descriptor?.activationState || 'locally_available',
      owner: descriptor?.owner || [],
      risk: descriptor?.risk || 'read_only',
      actions: descriptor?.actions || [],
      resourceTypes,
    });
  }

  return results;
}

// --- Resource candidate enumeration (static, no DB/network) -----------------

/**
 * Build a *static* list of candidate resource types that *could* satisfy
 * the capabilities for a skill. This is purely structural — it does NOT query
 * any database or external service. The Intelligence Runtime uses this to
 * understand which resource types are relevant; actual resource resolution
 * remains the canonical service's job.
 */
export function enumerateCandidateResourceTypes(skill: string): ResourceType[] {
  const caps = discoverCapabilitiesForSkill(skill);
  const types = new Set<ResourceType>();
  for (const cap of caps) {
    for (const rt of cap.resourceTypes) types.add(rt);
  }
    return [...types];
}

// --- Structured plan construction -------------------------------------------

/**
 * Determine the execution mode for a skill based on its category and
 * routing signal. Reuses skillFlows.getEconomicCategory + getSkillCapabilities.
 */
function resolveExecutionMode(signal: AiRoutingSignal, skill: string): ExecutionMode {
  if (signal.conversationAct && ['greeting', 'thanks', 'farewell', 'confirmation', 'rejection'].includes(signal.conversationAct)) return 'conversational';
  if (skill && skill === 'autonomous_agent') return 'agentic';
  if (skill && skill === 'general_question') return 'conversational';
  const category = getEconomicCategory(skill);
  const infoCategories = ['classifieds-marketplace', 'price-check', 'government-civic', 'education-learning', 'spiritual-religious'];
  if (category && infoCategories.includes(category)) return 'informational';
  if (category && ECONOMIC_CATEGORIES.includes(category as (typeof ECONOMIC_CATEGORIES)[number])) return 'economic';
  const caps = getSkillCapabilities(skill);
  if (caps.some(c => c === 'payment' || c === 'escrow' || c === 'fulfillment' || c === 'quote')) return 'economic';
  return 'conversational';
}

/**
 * Determine whether authorization and/or explicit approval is needed.
 */
function resolveAuthorizationNeeds(signal: AiRoutingSignal, skill: string, isGuest: boolean): { authorization: boolean; approval: boolean } {
  const conversationActs = ['greeting', 'thanks', 'farewell', 'confirmation', 'rejection'];
  const needsAuth = Boolean(signal.skill)
    && signal.skill !== 'general_question'
    && signal.skill !== 'autonomous_agent'
    && signal.skill !== 'reminder'
    && signal.skill !== 'notification'
    && !signal.conversationAct
    && !conversationActs.includes(signal.conversationAct || '');
  const caps = getSkillCapabilities(skill);
  const commercial = caps.some(c => c === 'payment' || c === 'escrow');
  const mode = resolveExecutionMode(signal, skill);
  const approval = Boolean(needsAuth && (commercial || mode === 'economic') && !isGuest);
  return { authorization: needsAuth, approval };
}

/**
 * Build a structured intelligence plan from the routing signal and skill flow.
 *
 * This is synchronous and stateless — it derives the plan structure from the
 * canonical capability/skill registrations without invoking any model.
 */
export function buildIntelligenceStructuredPlan(
  input: IntelligencePlanInput,
  reasoning?: { confidence: number; intent: string; requiresEscalation: boolean },
): IntelligenceStructuredPlan {
    // When skill is null (pure conversation act: greeting, thanks, etc.),
  // no capability discovery is performed — these are conversational turns.
  const rawSkill = input.routingSignal.skill;
  const skill = rawSkill || 'general';
  const caps = (rawSkill && rawSkill !== 'general_question')
    ? discoverCapabilitiesForSkill(rawSkill)
    : [];
  const executionMode = resolveExecutionMode(input.routingSignal, skill);
  const authNeeds = resolveAuthorizationNeeds(input.routingSignal, skill, input.isGuest);
  const capsRequired = caps.map(c => c.capability);
  const requirements = getSkillRequirements(skill);
  const skillCaps = getSkillCapabilities(skill);
    const isCommercial = skillCaps.some(c => c === 'payment' || c === 'escrow');
  const candidateResources: DiscoveredResourceRef[] = capsRequired.flatMap(cap => {
    const capDef = caps.find(c => c.capability === cap);
    const types = capDef?.resourceTypes || RESOURCE_TYPES_BY_CAPABILITY[cap] || [];
    return types.map(type => ({
      id: '',
      type,
      name: '',
      capability: cap,
      activationState: 'repository_ready_external_activation' as CapabilityActivationState,
      available: false,
    } as DiscoveredResourceRef));
  });
  const needsClarification = Boolean(
    input.routingSignal.conversationAct === 'clarification'
    || (reasoning?.confidence !== undefined && reasoning.confidence < 0.6),
  );
  const needsEscalation = Boolean(reasoning?.requiresEscalation);
  const fallback: IntelligenceFallbackPlan =
    executionMode === 'economic' && candidateResources.length === 0
      ? { strategy: 'defer', reason: 'No resource types registered for economic capability' }
      : needsClarification
        ? { strategy: 'clarify', reason: 'Low reasoning confidence; asking for clarification' }
        : needsEscalation
          ? { strategy: 'alternative_resource', reason: 'Escalated to model; canonical service discovers live resources' }
          : { strategy: 'alternative_capability', reason: 'Default replan strategy' };
  const sequence: PlanStep[] = capsRequired.map((cap, idx) => ({
    step: idx + 1,
    capability: cap,
    action: caps.find(c => c.capability === cap)?.actions[0],
        requiresApproval: authNeeds.approval && idx === 0,
    commercial: isCommercial,
  }));

  return {
    goal: input.message,
    intent: reasoning?.intent || input.routingSignal.skill || input.routingSignal.intent || 'general',
    capabilitiesRequired: capsRequired,
    candidateResources,
    sequence,
    constraints: requirements.map(r => r.label),
    authorizationNeeded: authNeeds.authorization,
    approvalNeeded: authNeeds.approval,
    commercialRequirements: isCommercial ? 'payment_after_quote_or_confirmation' : undefined,
    executionMode,
    evidenceRequirements: requirements.map(r => r.label),
    fallback,
  };
}

// --- Resource substitution / replanning -------------------------------------

/**
 * Replan when a selected resource is unavailable or unsuitable.
 *
 * Returns a new structured plan with either:
 *   - an alternative resource/type substituted, or
 *   - a `defer` / `clarify` fallback with a truthful explanation.
 *
 * This function does NOT fabricate availability. It only works with the
 * statically-discovered resource types — actual resource resolution
 * remains the canonical execution boundary's job.
 */
export function replanIfUnavailable(
  currentPlan: IntelligenceStructuredPlan,
  unavailableResourceId: string,
): IntelligenceStructuredPlan {
  // If the unavailable resource was not actually a candidate, there is nothing
  // to replan — defer to the canonical execution boundary.
  const wasCandidate = currentPlan.candidateResources.some(r => r.id === unavailableResourceId);
  if (!wasCandidate) {
    return {
      ...currentPlan,
      fallback: {
        strategy: 'defer',
        reason: `Resource ${unavailableResourceId} was not among candidate resources; deferred to canonical service`,
      },
    };
  }

  const remaining = currentPlan.candidateResources.filter(r => r.id !== unavailableResourceId);
  if (remaining.length > 0) {
    const alt = remaining.find(r => r.available) || remaining[0];
    const newSequence = currentPlan.sequence.map(step => {
      if (step.resourceId === unavailableResourceId && alt) {
        return { ...step, resourceId: alt.id, rationale: `Substituted ${alt.type} resource after ${unavailableResourceId} was unavailable` };
      }
      return step;
    });
    return {
      ...currentPlan,
      candidateResources: remaining,
      sequence: newSequence,
      fallback: {
        strategy: 'alternative_resource',
        reason: `Replanned using alternative resources; original ${unavailableResourceId} was unavailable`,
      },
    };
  }
  return {
    ...currentPlan,
    candidateResources: [],
    fallback: {
      strategy: 'defer',
      reason: `No alternative resources available for ${unavailableResourceId}; deferred to canonical service`,
    },
  };
}

export default {
  discoverCapabilitiesForSkill,
  enumerateCandidateResourceTypes,
  buildIntelligenceStructuredPlan,
  replanIfUnavailable,
};

