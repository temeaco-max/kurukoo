import express, { Router } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getExternalIntegrationReadiness } from '../services/externalIntegrationReadiness.js';
import { getPilotReadiness } from '../services/pilotReadiness.js';
import { getClientSurfaces } from '../services/clientSurfaceRegistry.js';

const router = express.Router();

const surfaceMap = new Map([
  ['agent', { title: 'Agent', eyebrow: 'Your Kurukoo relationship', description: 'Conversation is the universal control surface for requests, reminders, memory, agents and coordinated work.', cta: '/chat', ctaLabel: 'Open Chat' }],
  ['discover', { title: 'Discover', eyebrow: 'Find what is useful', description: 'Nearby Pulse, opportunities, Topics and network signals appear here with their evidence and availability state.', cta: '/discover', ctaLabel: 'Open Discover' }],
  ['requests', { title: 'Requests', eyebrow: 'Work in motion', description: 'Economic Requests, orders, sourcing and confirmations remain owned by the canonical lifecycle and can always return to the originating conversation.', cta: '/requests', ctaLabel: 'Open Requests' }],
  ['tasks', { title: 'Tasks', eyebrow: 'Contribute to the network', description: 'Tasks, reminders, evidence and agent work use the same identity, policy and execution boundaries.', cta: '/tasks', ctaLabel: 'Open Tasks' }],
  ['connect', { title: 'Connect', eyebrow: 'Bring your tools together', description: 'Connect user-owned storage, communication channels, devices and external sources without creating parallel identity or memory.', cta: '/connect', ctaLabel: 'Open Connect' }],
  ['agents', { title: 'Agents', eyebrow: 'Agent runtime', description: 'Review first-class agents, goals, controls and current runtime states. Agent execution remains bounded by canonical policy and evidence.', cta: '/chat?prompt=Show%20me%20my%20agents', ctaLabel: 'Manage in Chat' }],
  ['capabilities', { title: 'Capabilities', eyebrow: 'Capability portfolio', description: 'Use multiple capabilities—provider, contributor, delivery, buyer, seller and more—under one identity and one canonical execution fabric.', cta: '/chat?prompt=Show%20me%20my%20capabilities', ctaLabel: 'Open Capability Portfolio' }],
  ['opportunities', { title: 'Opportunities', eyebrow: 'Proactive opportunity engine', description: 'Useful opportunities and quiet-user engagement are surfaced without interrupting active work or inventing offers.', cta: '/daily-picks', ctaLabel: 'Open Opportunities' }],
  ['wallet', { title: 'Wallet & money', eyebrow: 'Economic layer', description: 'Wallet, Points, Top Up, subscriptions and payment states are presented independently of whether external payment rails are currently active.', cta: '/top-up', ctaLabel: 'Open money controls' }],
  ['artifacts', { title: 'Artifacts', eyebrow: 'Your files and recordings', description: 'Artifacts are owner-scoped. Connected user-owned storage is preferred; managed storage is bounded fallback/staging.', cta: '/connect', ctaLabel: 'Open Artifact History' }],
  ['prayer', { title: 'Prayer Companion', eyebrow: 'First-class agent', description: 'Prayer support can compose personalized prayers, preserve continuity and use the existing voice, reminder and artifact boundaries when enabled.', cta: '/chat?prompt=I%20would%20like%20a%20prayer', ctaLabel: 'Open Prayer Companion' }],
  ['call', { title: 'Kurukoo Call', eyebrow: 'Realtime communication', description: 'AI voice and peer calling remain part of the same Kurukoo relationship. Provider credentials and realtime infrastructure determine activation.', cta: '/call', ctaLabel: 'Open Call' }],
  ['notifications', { title: 'Notifications', eyebrow: 'Stay connected', description: 'Notifications return relevant continuation, request and reminder context while preserving the same conversation identity.', cta: '/connect', ctaLabel: 'Open Connect' }],
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

  return res.render('app', {
    selected,
    section,
    displayName: authReq.user.name || authReq.user.phone,
    phone: authReq.user.phone,
    surfaces,
    readiness,
    enabledIntegrations,
    integrationCount: integrations.length,
  });
}

router.get('/app', optionalAuthenticateUser, (req, res) => renderApp(req, res, 'agent'));
for (const section of surfaceMap.keys()) {
  router.get(`/app/${section}`, optionalAuthenticateUser, (req, res) => renderApp(req, res, section));
}

export default router;
