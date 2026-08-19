import express, { Router } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getExternalIntegrationReadiness } from '../services/externalIntegrationReadiness.js';
import { getPilotReadiness } from '../services/pilotReadiness.js';
import { getClientSurfaces } from '../services/clientSurfaceRegistry.js';

const router = express.Router();

const surfaceMap = new Map([
  ['agent', { title: 'Agent', eyebrow: 'Your Kurukoo relationship', description: 'Conversation is the universal control surface for requests, reminders, memory, agents and coordinated work.', cta: '/chat', ctaLabel: 'Open Chat' }],
  ['discover', { title: 'Discover', eyebrow: 'Find what is useful', description: 'Nearby Pulse, opportunities, Topics and network signals appear here with their evidence and availability state.', cta: '/discover', ctaLabel: 'Open Discover' }],
  ['topics', { title: 'Topics', eyebrow: 'Community context', description: 'Browse and share moderated community questions, reports and experiences without turning community content into a provider, offer or payment claim.', cta: '/topics', ctaLabel: 'Open Topics' }],
  ['requests', { title: 'Requests', eyebrow: 'Work in motion', description: 'Economic Requests, orders, sourcing and confirmations remain owned by the canonical lifecycle and can always return to the originating conversation.', cta: '/requests', ctaLabel: 'Open Requests' }],
  ['reminders', { title: 'Reminders', eyebrow: 'Keep life on track', description: 'Create and review scheduled help without leaving the same memory, conversation and notification relationship.', cta: '/chat?prompt=Show%20me%20my%20reminders', ctaLabel: 'Manage in Chat' }],
  ['saved', { title: 'Saved & offers', eyebrow: 'Keep useful context close', description: 'Saved items, offers and request context remain tied to your owner-scoped memory and canonical conversation.', cta: '/chat?prompt=Show%20me%20my%20saved%20items', ctaLabel: 'Open Saved Items' }],
  ['cart', { title: 'Cart', eyebrow: 'Prepare an economic action', description: 'Review sourced items before requesting them; cart contents remain separate from payment success and final confirmation.', cta: '/cart', ctaLabel: 'Open Cart' }],
  ['tasks', { title: 'Tasks', eyebrow: 'Contribute to the network', description: 'Tasks, reminders, evidence and agent work use the same identity, policy and execution boundaries.', cta: '/tasks', ctaLabel: 'Open Tasks' }],
  ['connect', { title: 'Connect', eyebrow: 'Bring your tools together', description: 'Connect user-owned storage, communication channels, devices and external sources without creating parallel identity or memory.', cta: '/connect', ctaLabel: 'Open Connect' }],
  ['agents', { title: 'Agents', eyebrow: 'Agent runtime', description: 'Review first-class agents, goals, controls and current runtime states. Agent execution remains bounded by canonical policy and evidence.', cta: '/chat?prompt=Show%20me%20my%20agents', ctaLabel: 'Manage in Chat' }],
  ['capabilities', { title: 'Capabilities', eyebrow: 'Capability portfolio', description: 'Use multiple capabilities—provider, contributor, delivery, buyer, seller and more—under one identity and one canonical execution fabric.', cta: '/chat?prompt=Show%20me%20my%20capabilities', ctaLabel: 'Open Capability Portfolio' }],
  ['opportunities', { title: 'Opportunities', eyebrow: 'Proactive opportunity engine', description: 'Useful opportunities and quiet-user engagement are surfaced without interrupting active work or inventing offers.', cta: '/daily-picks', ctaLabel: 'Open Opportunities' }],
  ['wallet', { title: 'Wallet & money', eyebrow: 'Economic layer', description: 'Wallet, Points, Top Up, subscriptions and payment states are presented independently of whether external payment rails are currently active.', cta: '/app/wallet', ctaLabel: 'Open money controls' }],
  ['points', { title: 'Points', eyebrow: 'Kurukoo economy', description: 'Points remain a closed-loop utility/economy surface distinct from cash payment rails and external settlement.', cta: '/app/points', ctaLabel: 'Open Points' }],
  ['top-up', { title: 'Top Up', eyebrow: 'Add funds', description: 'Top-up UI is available as a truthful payment surface; provider evidence determines whether a transaction can actually complete.', cta: '/app/top-up', ctaLabel: 'Open Top Up' }],
  ['subscriptions', { title: 'Subscriptions', eyebrow: 'Plans and entitlements', description: 'Plans and entitlement states are presented independently of live billing activation and never claim a successful charge without provider evidence.', cta: '/app/subscriptions', ctaLabel: 'Open Subscriptions' }],
  ['checkout', { title: 'Checkout', eyebrow: 'Confirm economic action', description: 'Checkout remains bound to canonical economic requests, payment policy and explicit confirmation.', cta: '/checkout', ctaLabel: 'Open Checkout' }],
  ['confirmations', { title: 'Confirmations', eyebrow: 'Know what happened', description: 'Confirmation surfaces summarize canonical lifecycle, evidence and recovery rather than inferred success.', cta: '/confirmation', ctaLabel: 'Open Confirmations' }],
  ['memory', { title: 'Memory', eyebrow: 'Your Kurukoo memory', description: 'Memory Profile is the canonical owner-scoped memory authority shared by all clients.', cta: '/memory', ctaLabel: 'Open Memory' }],
  ['artifacts', { title: 'Artifacts', eyebrow: 'Your files and recordings', description: 'Artifacts are owner-scoped. Connected user-owned storage is preferred; managed storage is bounded fallback/staging.', cta: '/connect', ctaLabel: 'Open Artifact History' }],
  ['prayer', { title: 'Prayer Companion', eyebrow: 'First-class agent', description: 'Prayer support can compose personalized prayers, preserve continuity and use the existing voice, reminder and artifact boundaries when enabled.', cta: '/chat?prompt=I%20would%20like%20a%20prayer', ctaLabel: 'Open Prayer Companion' }],
  ['call', { title: 'Kurukoo Call', eyebrow: 'Realtime communication', description: 'AI voice and peer calling remain part of the same Kurukoo relationship. Provider credentials and realtime infrastructure determine activation.', cta: '/call', ctaLabel: 'Open Call' }],
  ['notifications', { title: 'Notifications', eyebrow: 'Stay connected', description: 'Notifications return relevant continuation, request and reminder context while preserving the same conversation identity.', cta: '/chat?prompt=Show%20me%20my%20notifications', ctaLabel: 'Review with Kurukoo' }],
  ['safety', { title: 'Safety', eyebrow: 'Safety and check-ins', description: 'Safety context, trusted contacts and check-ins are explicit, consent-bound and never represented as emergency-service fulfilment.', cta: '/safety', ctaLabel: 'Open Safety' }],
]);

function renderApp(req: express.Request, res: express.Response, section = 'agent') {
  const authReq = req as AuthRequest;
  if (!authReq.user?.phone) return res.redirect(302, `/login?return=${encodeURIComponent(req.path)}`);
  const selected = surfaceMap.get(section) ?? surfaceMap.get('agent')!;
  const surfaces = getClientSurfaces('web');
  const readiness = getPilotReadiness();
  const integrations = getExternalIntegrationReadiness();
  const enabledIntegrations = integrations.filter((item: any) => item.implementation?.state === 'IMPLEMENTED' || item.implementation?.implemented === true).length;
  return res.render('app', { selected, section, displayName: authReq.user.name || authReq.user.phone, phone: authReq.user.phone, surfaces, readiness, enabledIntegrations, integrationCount: integrations.length });
}

router.get('/app', optionalAuthenticateUser, (req, res) => renderApp(req, res, 'agent'));
for (const section of surfaceMap.keys()) router.get(`/app/${section}`, optionalAuthenticateUser, (req, res) => renderApp(req, res, section));

const completedLegacyToCanonical: Record<string, string> = {
  '/requests': '/app/requests',
  '/points': '/app/points',
  '/tasks': '/app/tasks',
  '/top-up': '/app/top-up',
  '/subscription': '/app/subscriptions',
  '/memory': '/app/memory',
  '/safety': '/app/safety',
  '/call': '/app/call',
  '/connect': '/app/connect',
  '/confirmation': '/app/confirmations',
};
for (const [legacyPath, canonicalPath] of Object.entries(completedLegacyToCanonical)) {
  router.get(legacyPath, optionalAuthenticateUser, (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.user?.phone) return res.redirect(302, `/login?return=${encodeURIComponent(req.path)}`);
    return res.redirect(302, canonicalPath);
  });
}

router.get('/web', (_req, res) => res.redirect(302, '/app'));
router.get('/workspace', (_req, res) => res.redirect(302, '/app'));

export default router;
