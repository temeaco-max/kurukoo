import { listAgentTools, type AgentToolName } from './agentToolRegistry.js';
import { listCapabilityRegistrations, validateCapabilityRegistry } from './capabilityRegistry.js';
import { listUniversalCapabilities, type UniversalCapabilityDescriptor } from './universalCapabilityProtocol.js';
import { discoverExternalAgentCapabilities, getExternalAgentParticipant, type ExternalAgentDiscoveryRecord, type ExternalAgentParticipantRegistration } from './externalAgentCoordination.js';
import { getAgentGoal, listAgentGoalEvents, type AgentGoal, type AgentGoalEvent } from './agentRuntime.js';

export const KURUKOO_AGENT_OPERATING_MODEL_VERSION = '1.1' as const;

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

export interface AgentExternalParticipantSummary {
  participantId: string;
  displayName: string;
  protocol: ExternalAgentDiscoveryRecord['protocol'];
  verificationState: ExternalAgentDiscoveryRecord['verificationState'];
  agentVerified: boolean;
  capabilities: ExternalAgentDiscoveryRecord['capability'][];
  declarationOnly: true;
  executionAuthorized: false;
  outcomeVerified: false;
}

export interface AgentRunSummary {
  goal: AgentGoal;
  events: AgentGoalEvent[];
  correlatedObjectIds: string[];
  delegated: boolean;
  executionPath: 'agent_runtime' | 'delegated_agent';
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
  'externalAgentCoordination',
  'memoryProfile',
  'notificationQueue',
  'evidenceBoundary',
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

function summarizeExternalParticipant(discoveries: ExternalAgentDiscoveryRecord[]): AgentExternalParticipantSummary[] {
  const grouped = new Map<string, AgentExternalParticipantSummary>();
  for (const item of discoveries) {
    const existing = grouped.get(item.participantId);
    if (existing) {
      existing.capabilities.push(item.capability);
      existing.capabilities.sort((a, b) => a.capability.localeCompare(b.capability));
      if (item.agentVerified) existing.agentVerified = true;
      continue;
    }
    grouped.set(item.participantId, {
      participantId: item.participantId,
      displayName: item.displayName,
      protocol: item.protocol,
      verificationState: item.verificationState,
      agentVerified: item.agentVerified,
      capabilities: [item.capability],
      declarationOnly: true,
      executionAuthorized: false,
      outcomeVerified: false,
    });
  }
  return [...grouped.values()].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.participantId.localeCompare(b.participantId));
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

export async function listAgentExternalParticipants(input: { capability?: string; includeUnavailable?: boolean } = {}): Promise<AgentExternalParticipantSummary[]> {
  const discoveries = await discoverExternalAgentCapabilities(input);
  return summarizeExternalParticipant(discoveries);
}

export async function getAgentExternalParticipant(participantId: string): Promise<AgentExternalParticipantSummary | null> {
  const participant = await getExternalAgentParticipant(participantId);
  if (!participant) return null;
  const discoveries = await discoverExternalAgentCapabilities({ capability: undefined, includeUnavailable: true });
  const matching = discoveries.filter(item => item.participantId === participant.participantId);
  return summarizeExternalParticipant(matching)[0] || {
    participantId: participant.participantId,
    displayName: participant.manifest.displayName,
    protocol: participant.manifest.protocol,
    verificationState: participant.verificationState,
    agentVerified: participant.verificationState === 'verified',
    capabilities: [],
    declarationOnly: true,
    executionAuthorized: false,
    outcomeVerified: false,
  };
}

export async function getAgentRunSummary(phone: string, goalId: string): Promise<AgentRunSummary | null> {
  const goal = await getAgentGoal(phone, goalId);
  if (!goal) return null;
  const events = await listAgentGoalEvents(phone, goalId);
  const correlatedObjectIds = [...new Set([
    goal.id,
    goal.conversationId,
    goal.economicRequestId,
    ...events.map(event => event.detail?.match(/(?:request|execution|object|resource|notification|delegation)[:=]([A-Za-z0-9._:-]+)/i)?.[1]).filter(Boolean) as string[],
  ].filter(Boolean) as string[])];
  const delegated = String((goal as any).goalType || (goal as any).goal_type || '').toLowerCase() === 'delegated_agent'
    || String((goal as any).source || '').toLowerCase() === 'network'
    || events.some(event => /delegated_run_(?:started|completed|blocked|failed)/i.test(event.action));
  return {
    goal,
    events,
    correlatedObjectIds,
    delegated,
    executionPath: delegated ? 'delegated_agent' : 'agent_runtime',
  };
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
