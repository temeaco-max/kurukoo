import { getDb } from '../database.js';
import { getEconomicRequest } from './skillFlows.js';
import { getProviderCommunicationSession } from './providerCommunicationService.js';
import { getDiscoverHome } from './discoverExperience.js';
import { getAgentNetworkSummary } from './agentNetworkCommerce.js';
import { getPointsBalance } from './pointsEngine.js';

export type OutcomeKind = 'economic_request' | 'dispatch' | 'product' | 'booking' | 'reminder' | 'agent_goal' | 'topic' | 'discovery' | 'generic';
export type OutcomeState = 'draft' | 'needs_input' | 'awaiting_match' | 'matched' | 'accepted' | 'arrived' | 'in_progress' | 'waiting' | 'completed' | 'cancelled' | 'failed' | 'unknown';

export interface OutcomeContext {
  contextId: string;
  kind: OutcomeKind;
  ownerPhone: string;
  title: string;
  state: OutcomeState;
  skill?: string;
  requestId?: string;
  providerPhone?: string;
  communicationSessionId?: string;
  actions: Array<{ id: string; label: string; method: string; href?: string; requiresConfirmation?: boolean }>;
  facts: Record<string, unknown>;
  points?: { enabled: boolean; balance: number };
  agentNetwork?: { activePosAgents: number; totalAgents: number; pendingAgents: number };
  generatedAt: string;
}

function normalizeState(value: unknown): OutcomeState {
  const raw = String(value || '').toLowerCase();
  if (['draft', 'needs_input', 'awaiting_match', 'matched', 'accepted', 'arrived', 'in_progress', 'waiting', 'completed', 'cancelled', 'failed'].includes(raw)) return raw as OutcomeState;
  return 'unknown';
}

function actionsFor(context: Pick<OutcomeContext, 'kind' | 'state' | 'requestId' | 'communicationSessionId' | 'providerPhone'>): OutcomeContext['actions'] {
  const actions: OutcomeContext['actions'] = [];
  if (context.state === 'needs_input' || context.state === 'draft') actions.push({ id: 'continue', label: 'Continue', method: 'chat' });
  if (context.state === 'awaiting_match') actions.push({ id: 'refresh', label: 'Find available providers', method: 'get' });
  if (context.state === 'matched' || context.state === 'accepted' || context.state === 'arrived' || context.state === 'in_progress') {
    if (context.communicationSessionId) actions.push({ id: 'communicate', label: 'Contact provider', method: 'open', href: `/call?session=${encodeURIComponent(context.communicationSessionId)}` });
    if (context.state === 'arrived') actions.push({ id: 'confirm-start', label: 'Confirm start', method: 'post', requiresConfirmation: true });
  }
  if (context.state === 'completed') actions.push({ id: 'review', label: 'Leave a review', method: 'open', href: context.requestId ? `/requests?request=${encodeURIComponent(context.requestId)}&review=1` : undefined });
  if (!['completed', 'cancelled', 'failed'].includes(context.state)) actions.push({ id: 'view', label: 'Open details', method: 'open' });
  return actions;
}

async function buildEconomicRequestContext(ownerPhone: string, requestId: string): Promise<OutcomeContext | null> {
  const request = await getEconomicRequest(requestId);
  if (!request || request.phone !== ownerPhone) return null;
  const commRows = (await getDb()).exec('SELECT id, provider_phone, state FROM provider_communication_sessions WHERE economic_request_id=? ORDER BY updated_at DESC LIMIT 1', [requestId]);
  const comm = commRows[0]?.values?.[0];
  const communicationSessionId = comm?.[0] ? String(comm[0]) : undefined;
  const providerPhone = comm?.[1] ? String(comm[1]) : (request.providerId ? String(request.providerId) : undefined);
  const state = normalizeState(request.status);
  const context: OutcomeContext = {
    contextId: `economic:${requestId}`,
    kind: 'economic_request',
    ownerPhone,
    title: request.skill ? request.skill.replace(/[_-]+/g, ' ') : 'Kurukoo request',
    state,
    skill: request.skill,
    requestId,
    providerPhone,
    communicationSessionId,
    actions: [],
    facts: {
      category: request.category,
      requirements: request.requirements,
      quote: request.quote || null,
      fulfillment: request.fulfillment || null,
      status: request.status,
    },
    points: { enabled: true, balance: await getPointsBalance(ownerPhone) },
    agentNetwork: await getAgentNetworkSummary(),
    generatedAt: new Date().toISOString(),
  };
  context.actions = actionsFor(context);
  return context;
}

export async function getOutcomeContext(input: { ownerPhone: string; requestId?: string; contextId?: string; kind?: OutcomeKind }): Promise<OutcomeContext | null> {
  const ownerPhone = String(input.ownerPhone || '').trim();
  if (!ownerPhone || ownerPhone.startsWith('anon_')) return null;
  const requestId = input.requestId || (input.contextId?.startsWith('economic:') ? input.contextId.slice('economic:'.length) : undefined);
  if (requestId) return buildEconomicRequestContext(ownerPhone, requestId);
  return null;
}

export async function getOutcomeContextSummary(ownerPhone: string): Promise<Pick<OutcomeContext, 'points' | 'agentNetwork'>> {
  return { points: { enabled: true, balance: await getPointsBalance(ownerPhone) }, agentNetwork: await getAgentNetworkSummary() };
}
