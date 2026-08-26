import express from 'express';
import path from 'node:path';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getExternalIntegrationReadiness } from '../services/externalIntegrationReadiness.js';
import { getPilotReadiness } from '../services/pilotReadiness.js';
import { getClientSurfaces } from '../services/clientSurfaceRegistry.js';
import { getCanonicalDiscoverablePlatformFeatures } from '../services/canonicalPlatformFeatureRegistry.js';
import { getPageContentContract } from '../services/pageContentContracts.js';
import { getProfile } from '../services/memoryProfile.js';
import economicDispatchRoutes from './economicDispatchRoutes.js';

const router = express.Router();

const surfaceMap = new Map([
  ['desk', { title: 'Desk', eyebrow: 'Your Kurukoo workspace', description: 'See what is happening, what needs your attention and where to continue across conversations, requests, tasks, reminders, memory and connected work.', cta: '/chat', ctaLabel: 'Ask Agent' }],
  ['discover', { title: 'Discover', eyebrow: 'Your opportunity and activity surface', description: 'See what is useful, interesting, available, discussable or actionable today: nearby activity, Daily Picks, Topics, Opportunities and things Kurukoo can do.', cta: '/discover', ctaLabel: 'Open Discover' }],
  ['topics', { title: 'Topics', eyebrow: 'Community context', description: 'Browse and share moderated community questions, reports and experiences without turning community content into a provider, offer or payment claim.', cta: '/topics', ctaLabel: 'Open Topics' }],
  ['requests', { title: 'Requests', eyebrow: 'Work in motion', description: 'Economic Requests, orders, sourcing and confirmations remain owned by the canonical lifecycle and can always return to the originating conversation.', cta: '/requests', ctaLabel: 'Open Requests' }],
  ['reminders', { title: 'Reminders', eyebrow: 'Keep life on track', description: 'Create and review scheduled help without leaving the same memory, conversation and notification relationship.', cta: '/chat?prompt=Show%20me%20my%20reminders', ctaLabel: 'Manage in Chat' }],
  ['saved', { title: 'Saved', eyebrow: 'Keep useful context close', description: 'Saved items, offers, follows and watches remain tied to your owner-scoped memory and canonical conversation.', cta: '/chat?prompt=Show%20me%20my%20saved%20items', ctaLabel: 'Open Saved' }],
  ['cart', { title: 'Cart', eyebrow: 'Prepare an economic action', description: 'Review sourced items before requesting them; cart contents remain separate from payment success and final confirmation.', cta: '/cart', ctaLabel: 'Open Cart' }],
  ['tasks', { title: 'Tasks', eyebrow: 'Work to finish', description: 'Tasks, reminders, evidence and agent work use the same identity, policy and execution boundaries.', cta: '/tasks', ctaLabel: 'Open Tasks' }],
  ['connect', { title: 'Connect', eyebrow: 'Bring your tools together', description: 'Connect user-owned storage, communication channels, devices and external sources without creating parallel identity or memory.', cta: '/connect', ctaLabel: 'Open Connect' }],
  ['agents', { title: 'Agents', eyebrow: 'Your bounded autonomous workers', description: 'Review first-class agents, goals, controls and current runtime states. Agent execution remains bounded by canonical policy and evidence.', cta: '/agents', ctaLabel: 'Open Agents' }],
  ['capabilities', { title: 'Capabilities', eyebrow: 'Capability portfolio', description: 'Use multiple capabilities—provider, contributor, delivery, buyer, seller and more—under one identity and one canonical execution fabric.', cta: '/capabilities', ctaLabel: 'Open Capabilities' }],
  ['opportunities', { title: 'Opportunities', eyebrow: 'Ways to participate', description: 'Opportunities, promotions and useful participation paths are tied to the same discovery, capability and conversation fabric.', cta: '/opportunities', ctaLabel: 'Open Opportunities' }],
  ['wallet', { title: 'Wallet', eyebrow: 'Economic layer', description: 'Wallet, Points, Top Up, subscriptions and payment states are presented independently of whether external payment rails are currently active.', cta: '/wallet', ctaLabel: 'Open Wallet' }],
  ['points', { title: 'Points', eyebrow: 'Kurukoo economy', description: 'Points remain a closed-loop utility/economy surface distinct from cash payment rails and external settlement.', cta: '/points', ctaLabel: 'Open Points' }],
  ['top-up', { title: 'Top Up', eyebrow: 'Add funds', description: 'Top-up UI is available as a truthful payment surface; provider evidence determines whether a transaction can actually complete.', cta: '/top-up', ctaLabel: 'Open Top Up' }],
  ['subscriptions', { title: 'Subscriptions', eyebrow: 'Plans and entitlements', description: 'Plans and entitlement states are presented independently of live billing activation and never claim a successful charge without provider evidence.', cta: '/subscriptions', ctaLabel: 'Open Subscriptions' }],
  ['checkout', { title: 'Checkout', eyebrow: 'Confirm economic action', description: 'Checkout remains bound to canonical economic requests, payment policy and explicit confirmation.', cta: '/checkout', ctaLabel: 'Open Checkout' }],
  ['confirmations', { title: 'Confirmations', eyebrow: 'Know what happened', description: 'Confirmation surfaces summarize canonical lifecycle, evidence and recovery rather than inferred success.', cta: '/requests', ctaLabel: 'Open Requests' }],
  ['memory', { title: 'Memory', eyebrow: 'Your Kurukoo memory', description: 'Memory Profile is the canonical owner-scoped memory authority shared by all clients.', cta: '/memory', ctaLabel: 'Open Memory' }],
  ['artifacts', { title: 'Artifacts', eyebrow: 'Your files and recordings', description: 'Artifacts are owner-scoped. Connected user-owned storage is preferred; managed storage is bounded fallback/staging.', cta: '/artifacts', ctaLabel: 'Open Artifacts' }],
  ['prayer', { title: 'Prayer Companion', eyebrow: 'First-class agent capability', description: 'Prayer support can compose personalized prayers, preserve continuity and use the existing voice, reminder and artifact boundaries when enabled.', cta: '/chat?prompt=I%20would%20like%20a%20prayer', ctaLabel: 'Ask Agent' }],
  ['call', { title: 'Call', eyebrow: 'Realtime communication', description: 'AI voice and peer calling remain part of the same Kurukoo relationship. Provider credentials and realtime infrastructure determine activation.', cta: '/call', ctaLabel: 'Open Call' }],
  ['notifications', { title: 'Notifications', eyebrow: 'Stay connected', description: 'Notifications return relevant continuation, request and reminder context while preserving the same conversation identity.', cta: '/notifications', ctaLabel: 'Open Notifications' }],
  ['safety', { title: 'Safety', eyebrow: 'Safety and check-ins', description: 'Safety context, trusted contacts and check-ins are explicit, consent-bound and never represented as emergency-service fulfilment.', cta: '/safety', ctaLabel: 'Open Safety' }],
  ['settings', { title: 'Settings', eyebrow: 'Your Kurukoo preferences', description: 'Manage account, security, privacy, memory, notifications, connections, accessibility and product preferences in one place.', cta: '/settings', ctaLabel: 'Open Settings' }],
]);


const cleanCanonicalSections: Record<string, string> = {
  '/desk': 'desk', '/discover': 'discover', '/topics': 'topics', '/requests': 'requests', '/reminders': 'reminders', '/saved': 'saved', '/cart': 'cart', '/tasks': 'tasks', '/connect': 'connect', '/agents': 'agents', '/capabilities': 'capabilities', '/opportunities': 'opportunities', '/wallet': 'wallet', '/points': 'points', '/top-up': 'top-up', '/subscriptions': 'subscriptions', '/checkout': 'checkout', '/confirmations': 'confirmations', '/memory': 'memory', '/artifacts': 'artifacts', '/prayer': 'prayer', '/call': 'call', '/notifications': 'notifications', '/safety': 'safety', '/settings': 'settings',
};

const sharedPublicAuthenticated = new Set(['/discover', '/topics']);

function screenAssets(section: string): string {
  if (section === 'discover') return '<link rel="stylesheet" href="/css/kurukoo-discover-convergence.css?v=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="/js/kurukoo-discover-convergence.js?v=1" defer></script><script src="/js/kurukoo-discover-map-loader.js?v=1" defer></script>';
  if (section === 'notifications') return '<link rel="stylesheet" href="/css/kurukoo-notifications-convergence.css?v=1"><script src="/js/kurukoo-notifications-convergence.js?v=1" defer></script>';
  if (section === 'connect') return '<link rel="stylesheet" href="/css/kurukoo-contacts-convergence.css?v=1"><script src="/js/kurukoo-contacts-convergence.js?v=1" defer></script>';
  if (section === 'memory') return '<link rel="stylesheet" href="/css/kurukoo-memory-convergence.css?v=1"><script src="/js/kurukoo-memory-convergence.js?v=1" defer></script>';
  return '';
}

function renderApp(req: express.Request, res: express.Response, section = 'desk') {
  const authReq = req as AuthRequest;
  if (!authReq.user?.phone) return res.redirect(302, `/login?return=${encodeURIComponent(req.originalUrl || req.path)}`);
  const selected = surfaceMap.get(section) ?? surfaceMap.get('desk')!;
  const surfaces = getClientSurfaces('web');
  const readiness = getPilotReadiness();
  const integrations = getExternalIntegrationReadiness();
  const enabledIntegrations = integrations.filter((item: any) => item.implementation?.state === 'IMPLEMENTED' || item.implementation?.implemented === true).length;
  const content = getPageContentContract(section);
  return res.render('app', { selected, section, displayName: authReq.user.name || authReq.user.phone, phone: authReq.user.phone, surfaces, readiness, integrations, enabledIntegrations, integrationCount: integrations.length, visualFeatures: getCanonicalDiscoverablePlatformFeatures().filter(feature => !feature.audience.includes('admin')), contentContract: content }, (error, html) => {
    if (error) return res.status(500).send('Unable to render application surface');
    const assets = screenAssets(section);
    res.send(assets ? html.replace('</head>', `${assets}</head>`) : html);
  });
}

router.get('/api/memory/profile', optionalAuthenticateUser, async (req: express.Request, res: express.Response) => {
  const phone = (req as AuthRequest).user?.phone ? String((req as AuthRequest).user?.phone) : null;
  if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
  try {
    const profile = await getProfile(phone, 'memory_surface');
    const preferences = profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences as Record<string, unknown> : {};
    const proactiveBrief = preferences.proactive_brief && typeof preferences.proactive_brief === 'object' ? preferences.proactive_brief : {};
    return res.json({ success: true, profile: { name: profile?.name || '', location: profile?.location || '', country: profile?.country || '' }, proactiveBrief });
  } catch { return res.status(500).json({ success: false, error: 'Unable to read canonical Memory Profile' }); }
});

router.get('/api/platform/feature-visuals', (_req, res) => res.json({ success: true, features: getCanonicalDiscoverablePlatformFeatures().filter(feature => !feature.audience.includes('admin')) }));
router.use('/api', economicDispatchRoutes);

router.get('/features', (_req, res) => res.render('features'));
router.get('/developers', (_req, res) => res.render('developers'));
router.get('/developers/api', (_req, res) => res.render('developers'));

router.get('/chat/:conversationId', (req, res) => {
  res.setHeader('X-Kurukoo-Conversation-Id', String(req.params.conversationId));
  return res.sendFile(path.join(process.cwd(), 'public', 'chat', 'index.html'));
});
router.get('/share/:shareId', (req, res) => {
  res.setHeader('X-Kurukoo-Share-Id', String(req.params.shareId));
  return res.sendFile(path.join(process.cwd(), 'public', 'chat', 'index.html'));
});

for (const [pathname, section] of Object.entries(cleanCanonicalSections)) {
  router.get(pathname, optionalAuthenticateUser, (req, res, next) => {
    const authReq = req as AuthRequest;
    if (!authReq.user?.phone && sharedPublicAuthenticated.has(pathname)) return next();
    return renderApp(req, res, section);
  });
}

for (const resource of ['requests','tasks','reminders','opportunities','agents','connections','memory','artifacts']) {
  router.get(`/${resource}/:id`, optionalAuthenticateUser, (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.user?.phone) return res.redirect(302, `/login?return=${encodeURIComponent(req.originalUrl)}`);
    const section = resource === 'connections' ? 'connect' : resource;
    const selected = surfaceMap.get(section as string) ?? surfaceMap.get('desk')!;
    return res.render('app', { selected: { ...selected, eyebrow: `${selected.eyebrow} · ${req.params.id}`, description: `${selected.description} This view is scoped to ${req.params.id}.` }, section, displayName: authReq.user.name || authReq.user.phone, phone: authReq.user.phone, surfaces: getClientSurfaces('web'), readiness: getPilotReadiness(), integrations: getExternalIntegrationReadiness(), enabledIntegrations: 0, integrationCount: 0, visualFeatures: getCanonicalDiscoverablePlatformFeatures().filter(feature => !feature.audience.includes('admin')), resourceId: req.params.id, contentContract: getPageContentContract(section) });
  });
}


export default router;
