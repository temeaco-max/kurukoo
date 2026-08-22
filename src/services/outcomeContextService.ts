import { getDb } from '../database.js';
import { getEconomicRequest } from './skillFlows.js';
import { getAgentNetworkSummary } from './agentNetworkCommerce.js';
import { getPointsBalance } from './pointsEngine.js';
import { listPlatformJourneyEvents } from './platformJourneyWeaver.js';

export type OutcomeKind = 'economic_request' | 'dispatch' | 'product' | 'booking' | 'reminder' | 'agent_goal' | 'topic' | 'discovery' | 'generic';
export type OutcomeState = 'draft' | 'needs_input' | 'requested' | 'awaiting_confirmation' | 'awaiting_match' | 'matched' | 'quoted' | 'payment_pending' | 'paid' | 'reserved' | 'in_fulfillment' | 'accepted' | 'arrived' | 'in_progress' | 'waiting' | 'fulfilled' | 'completed' | 'cancelled' | 'failed' | 'disputed' | 'unknown';

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
  timeline: Array<{ eventType: string; occurredAt: string; objectId?: string; points?: number; metadata?: Record<string, unknown> }>;
  points?: { enabled: boolean; balance: number };
  agentNetwork?: { activePosAgents: number; totalAgents: number; pendingAgents: number };
  generatedAt: string;
}

const STATE_ALIASES: Record<string, OutcomeState> = {
  pending: 'requested', requested: 'requested', awaiting_input: 'needs_input', needs_details: 'needs_input',
  awaiting_confirmation: 'awaiting_confirmation', awaiting_match: 'awaiting_match', matching: 'awaiting_match',
  matched: 'matched', quoting: 'quoted', quoted: 'quoted', payment_pending: 'payment_pending', awaiting_payment: 'payment_pending',
  paid: 'paid', reserved: 'reserved', in_fulfillment: 'in_fulfillment', fulfilling: 'in_fulfillment', accepted: 'accepted',
  arrived: 'arrived', in_progress: 'in_progress', waiting: 'waiting', fulfilled: 'fulfilled', completed: 'completed',
  cancelled: 'cancelled', canceled: 'cancelled', failed: 'failed', disputed: 'disputed',
};
function normalizeState(value: unknown): OutcomeState { return STATE_ALIASES[String(value || '').toLowerCase()] || 'unknown'; }

function actionsFor(context: Pick<OutcomeContext, 'state' | 'requestId' | 'communicationSessionId'>): OutcomeContext['actions'] {
  const actions: OutcomeContext['actions'] = [];
  if (['draft', 'needs_input', 'requested'].includes(context.state)) actions.push({ id: 'continue', label: 'Continue', method: 'chat' });
  if (context.state === 'awaiting_confirmation') actions.push({ id: 'review-confirm', label: 'Review and confirm', method: 'open', href: context.requestId ? `/confirmation?request=${encodeURIComponent(context.requestId)}` : undefined, requiresConfirmation: true });
  if (context.state === 'awaiting_match') actions.push({ id: 'refresh', label: 'Find available providers', method: 'get' });
  if (['quoted', 'payment_pending'].includes(context.state)) actions.push({ id: 'payment', label: 'Continue to payment', method: 'open', href: context.requestId ? `/payment?request=${encodeURIComponent(context.requestId)}` : undefined, requiresConfirmation: true });
  if (['matched', 'accepted', 'arrived', 'in_progress', 'in_fulfillment'].includes(context.state) && context.communicationSessionId) actions.push({ id: 'communicate', label: 'Contact provider', method: 'open', href: `/call?session=${encodeURIComponent(context.communicationSessionId)}` });
  if (['completed', 'fulfilled'].includes(context.state)) actions.push({ id: 'review', label: 'Leave a review', method: 'open', href: context.requestId ? `/requests?request=${encodeURIComponent(context.requestId)}&review=1` : undefined });
  if (context.state === 'disputed') actions.push({ id: 'support', label: 'Get support', method: 'open', href: '/help' });
  if (!['completed', 'fulfilled', 'cancelled', 'failed', 'disputed'].includes(context.state)) actions.push({ id: 'view', label: 'Open details', method: 'open' });
  return actions;
}

export async function getOutcomeContext(input: { ownerPhone: string; requestId?: string; contextId?: string; kind?: OutcomeKind }): Promise<OutcomeContext | null> {
  const ownerPhone = String(input.ownerPhone || '').trim();
  if (!ownerPhone || ownerPhone.startsWith('anon_')) return null;
  const requestId = input.requestId || (input.contextId?.startsWith('economic:') ? input.contextId.slice('economic:'.length) : undefined);
  if (!requestId) return null;
  const request = await getEconomicRequest(requestId);
  if (!request || request.phone !== ownerPhone) return null;
  const db = await getDb();
  const commRows = db.exec('SELECT id, provider_phone FROM provider_communication_sessions WHERE economic_request_id=? ORDER BY updated_at DESC LIMIT 1', [requestId]);
  const comm = commRows[0]?.values?.[0];
  const communicationSessionId = comm?.[0] ? String(comm[0]) : undefined;
  const providerPhone = comm?.[1] ? String(comm[1]) : (request.providerId ? String(request.providerId) : undefined);
  const events = await listPlatformJourneyEvents({ economicRequestId: requestId, phone: ownerPhone, limit: 50 });
  const context: OutcomeContext = {
    contextId: `economic:${requestId}`,
    kind: input.kind || 'economic_request', ownerPhone,
    title: request.skill ? request.skill.replace(/[_-]+/g, ' ') : 'Kurukoo request',
    state: normalizeState(request.status), skill: request.skill, requestId, providerPhone, communicationSessionId,
    actions: [],
    facts: { category: request.category, requirements: request.requirements, quote: request.quote || null, fulfillment: request.fulfillment || null, status: request.status },
    timeline: events.map(event => ({ eventType: event.eventType, occurredAt: event.occurredAt, objectId: event.objectId, points: event.points, metadata: event.metadata })),
    points: { enabled: true, balance: await getPointsBalance(ownerPhone) },
    agentNetwork: await getAgentNetworkSummary(),
    generatedAt: new Date().toISOString(),
  };
  context.actions = actionsFor(context);
  return context;
}

export async function getOutcomeContextSummary(ownerPhone: string): Promise<Pick<OutcomeContext, 'points' | 'agentNetwork'>> {
  return { points: { enabled: true, balance: await getPointsBalance(ownerPhone) }, agentNetwork: await getAgentNetworkSummary() };
}
