import { getEconomicRequest } from './skillFlows.js';
import { getAllAIAgents, type AIAgent } from './aiAgentService.js';
import { addEconomicParticipant, getEconomicParticipants, type EconomicParticipant } from './economicParticipants.js';

export interface AgentNetworkCandidate {
  agentId: string;
  name: string;
  capability: string;
  locality: string;
  availability: 'registered_active' | 'paused' | 'not_matched';
  localityMatch: 'declared_exact' | 'declared_global' | 'not_matched';
  assignmentStatus: EconomicParticipant['status'] | null;
  boundary: string;
}

function normalise(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function requestLocality(requirements: Record<string, unknown>): string {
  for (const key of ['location', 'lga', 'origin', 'destination']) {
    const value = normalise(requirements[key]);
    if (value) return value;
  }
  return '';
}

function localityMatch(agent: AIAgent, locality: string): AgentNetworkCandidate['localityMatch'] {
  const declared = normalise(agent.lga);
  if (!declared || declared === 'all' || declared === 'global') return 'declared_global';
  return locality && declared === locality ? 'declared_exact' : 'not_matched';
}

async function requireOwnerRequest(requestId: string, ownerPhone: string) {
  const request = await getEconomicRequest(requestId);
  if (!request || request.phone !== ownerPhone) throw new Error('Economic request ownership is required');
  return request;
}

/**
 * A registry-only assignment view. It does not infer physical proximity,
 * start an agent run, reserve provider capacity, or change the request’s
 * quote, escrow, payment, or fulfilment state.
 */
export async function listAgentNetworkCandidates(input: { requestId: string; ownerPhone: string }): Promise<AgentNetworkCandidate[]> {
  const requestId = input.requestId.trim();
  if (!requestId || !input.ownerPhone) throw new Error('Request id and owner identity are required');
  const request = await requireOwnerRequest(requestId, input.ownerPhone);
  const locality = requestLocality(request.requirements || {});
  const [agents, participants] = await Promise.all([getAllAIAgents(), getEconomicParticipants(requestId)]);
  const selectedByAgent = new Map(participants.filter((participant) => participant.role === 'agent').map((participant) => [participant.providerPhone, participant]));
  return agents
    .filter((agent) => agent.status === 'active' && Array.isArray(agent.skills) && agent.skills.includes(request.skill))
    .map((agent) => {
      const match = localityMatch(agent, locality);
      const participant = selectedByAgent.get(agent.id);
      return {
        agentId: agent.id,
        name: agent.name,
        capability: request.skill,
        locality: agent.lga || 'All',
        availability: 'registered_active' as const,
        localityMatch: match,
        assignmentStatus: participant?.status || null,
        boundary: 'Registered software capability only. Selection records internal coordination; it does not start autonomous work, dispatch a service, or create a payment or fulfilment claim.',
      };
    })
    .filter((candidate) => candidate.localityMatch !== 'not_matched')
    .sort((left, right) => Number(right.localityMatch === 'declared_exact') - Number(left.localityMatch === 'declared_exact') || left.name.localeCompare(right.name));
}

export async function assignAgentNetworkCandidate(input: { requestId: string; ownerPhone: string; agentId: string }): Promise<EconomicParticipant> {
  const requestId = input.requestId.trim();
  const agentId = input.agentId.trim();
  if (!requestId || !agentId || !input.ownerPhone) throw new Error('Request id, agent id, and owner identity are required');
  const candidates = await listAgentNetworkCandidates({ requestId, ownerPhone: input.ownerPhone });
  const candidate = candidates.find((item) => item.agentId === agentId);
  if (!candidate) throw new Error('No registered active agent is eligible for this request capability and locality');
  return addEconomicParticipant({
    requestId,
    ownerPhone: input.ownerPhone,
    role: 'agent',
    providerPhone: candidate.agentId,
    capability: candidate.capability,
    status: 'selected',
    evidence: {
      assignment_source: 'agent_network_registry',
      provider_type: 'software_service',
      declared_locality: candidate.locality,
      locality_match: candidate.localityMatch,
      availability: candidate.availability,
      execution_state: 'not_started',
      payment_state: 'not_applicable',
      fulfilment_state: 'not_started',
    },
  });
}

export async function listRequestAgentAssignments(input: { requestId: string; ownerPhone: string }): Promise<EconomicParticipant[]> {
  await requireOwnerRequest(input.requestId.trim(), input.ownerPhone);
  return (await getEconomicParticipants(input.requestId.trim())).filter((participant) => participant.role === 'agent');
}
