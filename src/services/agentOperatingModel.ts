import { listAgentTools, type AgentToolName } from './agentToolRegistry.js';
import { listCapabilityRegistrations, validateCapabilityRegistry } from './capabilityRegistry.js';
import { listUniversalCapabilities, type UniversalCapabilityDescriptor } from './universalCapabilityProtocol.js';
import { getAgentGoal, listAgentGoalEvents, type AgentGoal, type AgentGoalEvent } from './agentRuntime.js';
import { getAgentEconomicRequestLink, listAgentGoalDependencies, type AgentEconomicLink, type CompoundGoalDependency } from './agentEconomicRequestOrchestrator.js';

export const KURUKOO_AGENT_OPERATING_MODEL_VERSION = '1.0' as const;

export type AgentOperatingRole =
  | 'conversation'
  | 'request_coordinator'
  | 'discovery'
  | 'provider_liaison'
  | 'fulfilment_monitor'
  | 'personal_continuity'
  | 'trust_safety'
  | 'operations';

export interface KurukooAgentCard {
  id: 'kurukoo.agent';
  version: typeof KURUKOO_AGENT_OPERATING_MODEL_VERSION;
  userFacing: true;
  purpose: string;
  roles: AgentOperatingRole[];
  capabilityNames: string[];
  toolNames: AgentToolName[];
  canonicalOwners: string[];
  externalInterfaces: Array<'conversation' | 'agent_tool' | 'mcp' | 'a2a' | 'webhook' | 'http'>;
  guardrails: {
    canonicalStateOwner: string[];
    authorizationOwner: string[];
    evidenceOwner: string[];
    idempotencyOwner: string[];
    humanApprovalRequiredForExternalExecution: true;
    recursiveDelegationAllowed: false;
  };
}

export interface AgentOperatingCapabilitySummary {
  capability: string;
  kind: UniversalCapabilityDescriptor['kind'];
  family: string;
  actions: string[];
  risk: UniversalCapabilityDescriptor['risk'];
  activationState: UniversalCapabilityDescriptor['activationState'];
  owner: string[];
  continuationContext: string[];
}

export interface AgentRunSummary {
  goal: AgentGoal;
  events: AgentGoalEvent[];
  correlatedObjectIds: string[];
  delegated: false;
  economicLink?: AgentEconomicLink;
  dependencies: CompoundGoalDependency[];
}

const OPERATING_ROLES: AgentOperatingRole[] = [
  'conversation',
  'request_coordinator',
  'discovery',
  'provider_liaison',
  'fulfilment_monitor',
  'personal_continuity',
  'trust_safety',
  'operations',
];

const CANONICAL_OWNERS = [
  'canonicalChatTurnService',
  'contextArbitration',
  'capabilityRegistry',
  'universalCapabilityProtocol',
  'agentToolRegistry',
  'agentRuntime',
  'canonicalCapabilityExecutor',
  'economicRequestService',
  'executionConnector',
  'providerCommunication',
  'providerVerification',
  'memoryProfile',
  'notificationQueue',
  'evidenceBoundary',
  'agentEconomicRequestOrchestrator',
];

function summarizeDescriptor(descriptor: UniversalCapabilityDescriptor): AgentOperatingCapabilitySummary {
  return {
    capability: descriptor.capability,
    kind: descriptor.kind,
    family: descriptor.family,
    actions: [...descriptor.actions],
    risk: descriptor.risk,
    activationState: descriptor.activationState,
    owner: [...descriptor.owner],
    continuationContext: [...descriptor.continuationContext],
  };
}

export function getKurukooAgentCard(): KurukooAgentCard {
  const registrations = listCapabilityRegistrations();
  const toolNames = listAgentTools().map(tool => tool.name);
  return {
    id: 'kurukoo.agent',
    version: KURUKOO_AGENT_OPERATING_MODEL_VERSION,
    userFacing: true,
    purpose: 'One conversational Kurukoo Agent coordinates canonical capabilities, people, providers and bounded agents without becoming the owner of canonical state.',
    roles: [...OPERATING_ROLES],
    capabilityNames: [...new Set(registrations.map(item => item.descriptor.capability))].sort(),
    toolNames,
    canonicalOwners: [...CANONICAL_OWNERS],
    externalInterfaces: ['conversation', 'agent_tool', 'mcp', 'a2a', 'webhook', 'http'],
    guardrails: {
      canonicalStateOwner: ['canonical domain services', 'canonical persistence'],
      authorizationOwner: ['capabilityInteractionPolicyService', 'canonicalCapabilityExecutor', 'request/participant authorization'],
      evidenceOwner: ['execution/evidence boundaries', 'provider verification'],
      idempotencyOwner: ['canonical persistence/idempotency records', 'execution connector'],
      humanApprovalRequiredForExternalExecution: true,
      recursiveDelegationAllowed: false,
    },
  };
}

export async function listAgentOperatingCapabilities(): Promise<AgentOperatingCapabilitySummary[]> {
  const descriptors = await listUniversalCapabilities();
  return descriptors.map(summarizeDescriptor).sort((a, b) => a.capability.localeCompare(b.capability));
}

export async function getAgentOperatingCapability(capability: string): Promise<AgentOperatingCapabilitySummary | null> {
  const normalized = String(capability || '').trim().toLowerCase();
  if (!normalized) return null;
  const all = await listAgentOperatingCapabilities();
  return all.find(item => item.capability === normalized || item.capability === `skill.${normalized}`) || null;
}

export async function getAgentRunSummary(phone: string, goalId: string): Promise<AgentRunSummary | null> {
  const goal = await getAgentGoal(phone, goalId);
  if (!goal) return null;
  const events = await listAgentGoalEvents(phone, goalId);
  const [economicLink, dependencies] = await Promise.all([
    getAgentEconomicRequestLink(phone, goalId),
    listAgentGoalDependencies(phone, goalId),
  ]);
  const correlatedObjectIds = [...new Set([
    goal.id,
    goal.conversationId,
    goal.economicRequestId,
    economicLink?.economicRequestId,
    ...dependencies.map(item => item.economicRequestId),
    ...events.map(event => event.detail?.match(/(?:request|execution|object|resource|notification)[:=]([A-Za-z0-9._:-]+)/i)?.[1]).filter(Boolean) as string[],
  ].filter(Boolean) as string[])];
  return { goal, events, correlatedObjectIds, delegated: false, ...(economicLink ? { economicLink } : {}), dependencies };
}

export function validateAgentOperatingModel(): {
  valid: boolean;
  capabilityRegistry: ReturnType<typeof validateCapabilityRegistry>;
  missingCanonicalOwners: string[];
  invalidToolAuthorization: string[];
} {
  const capabilityRegistry = validateCapabilityRegistry();
  const missingCanonicalOwners = listCapabilityRegistrations()
    .filter(item => item.descriptor.owner.length === 0)
    .map(item => item.descriptor.capability);
  const invalidToolAuthorization = listAgentTools()
    .filter(tool => !tool.authorization || !tool.audit || !tool.idempotency)
    .map(tool => tool.name);
  return {
    valid: capabilityRegistry.valid && missingCanonicalOwners.length === 0 && invalidToolAuthorization.length === 0,
    capabilityRegistry,
    missingCanonicalOwners,
    invalidToolAuthorization,
  };
}
