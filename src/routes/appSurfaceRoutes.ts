/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
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
  ['desk', { title: 'Home', eyebrow: 'What matters now', description: 'See what needs your attention, pick up where you left off, and start something new with Kurukoo.', cta: '/chat', ctaLabel: 'Talk to Kurukoo' }],
  ['discover', { title: 'Explore', eyebrow: 'Find something useful', description: 'Find people, places, services, products, Topics and opportunities, then bring what matters into a conversation.', cta: '/chat', ctaLabel: 'Ask Kurukoo' }],
  ['topics', { title: 'Topics', eyebrow: 'Community context', description: 'Browse and share moderated community questions, reports and experiences without turning community content into a provider, offer or payment claim.', cta: '/topics', ctaLabel: 'Open Topics' }],
  ['requests', { title: 'Activity', eyebrow: 'Work in motion', description: 'See what is happening, what needs you, and what has finished. Open any item to continue the work in context.', cta: '/chat?prompt=Show%20me%20what%20needs%20my%20attention', ctaLabel: 'Ask what is next' }],
  ['reminders', { title: 'Reminders', eyebrow: 'Keep life on track', description: 'Create and review scheduled help without leaving the same conversation and notification relationship.', cta: '/chat?prompt=Show%20me%20my%20reminders', ctaLabel: 'Manage in Chat' }],
  ['saved', { title: 'Saved', eyebrow: 'Keep useful context close', description: 'Keep useful items connected to the conversations that gave them meaning.', cta: '/chat?prompt=Show%20me%20my%20saved%20items', ctaLabel: 'Open Saved' }],
  ['cart', { title: 'Cart', eyebrow: 'Prepare an economic action', description: 'Review sourced items before requesting them; cart contents remain separate from payment success and final confirmation.', cta: '/cart', ctaLabel: 'Open Cart' }],
  ['tasks', { title: 'Work', eyebrow: 'Work to finish', description: 'Keep tasks, reminders and follow-through connected to the conversations and objectives they support.', cta: '/tasks', ctaLabel: 'Open Work' }],
  ['connect', { title: 'Connect', eyebrow: 'Bring your tools together', description: 'Connect user-owned storage, communication channels, devices and external sources without creating separate identities or memories.', cta: '/connect', ctaLabel: 'Open Connect' }],
  ['agents', { title: 'Agents', eyebrow: 'Objectives at a glance', description: 'Review objectives, their progress, and what needs you. Use Chat to start or guide the work.', cta: '/chat', ctaLabel: 'Continue in Chat' }],
  ['capabilities', { title: 'Capabilities', eyebrow: 'Capability portfolio', description: 'Use different roles and ways of participating under one identity, without creating separate accounts.', cta: '/capabilities', ctaLabel: 'Open Capabilities' }],
  ['opportunities', { title: 'Opportunities', eyebrow: 'Ways to participate', description: 'See useful participation paths, promotions and network opportunities connected to the same Kurukoo experience.', cta: '/opportunities', ctaLabel: 'Open Opportunities' }],
  ['wallet', { title: 'Wallet', eyebrow: 'Economic layer', description: 'See your balances and payment-related states without treating them as proof of an external transaction.', cta: '/wallet', ctaLabel: 'Open Wallet' }],
  ['points', { title: 'Points', eyebrow: 'Kurukoo economy', description: 'See your Kurukoo Points separately from cash payment and external settlement.', cta: '/points', ctaLabel: 'Open Points' }],
  ['top-up', { title: 'Top Up', eyebrow: 'Add funds', description: 'Add funds through the available payment path. The result is shown only after the payment provider confirms it.', cta: '/top-up', ctaLabel: 'Open Top Up' }],
  ['subscriptions', { title: 'Subscriptions', eyebrow: 'Plans and entitlements', description: 'Review plans and entitlements without showing a successful charge unless the billing provider confirms it.', cta: '/subscriptions', ctaLabel: 'Open Plans' }],
  ['checkout', { title: 'Checkout', eyebrow: 'Confirm economic action', description: 'Review and confirm an economic action before anything irreversible happens.', cta: '/checkout', ctaLabel: 'Open Checkout' }],
  ['confirmations', { title: 'Confirmations', eyebrow: 'Know what happened', description: 'Review confirmed outcomes, important evidence and recovery steps.', cta: '/activity', ctaLabel: 'Open Activity' }],
  ['memory', { title: 'Memory', eyebrow: 'Your Kurukoo memory', description: 'Review the personal context Kurukoo keeps to make conversations and ongoing work more useful.', cta: '/memory', ctaLabel: 'Open Memory' }],
  ['artifacts', { title: 'Files', eyebrow: 'Your files and recordings', description: 'Review your files, recordings and transcripts in one place.', cta: '/artifacts', ctaLabel: 'Open Files' }],
  ['prayer', { title: 'Prayer Companion', eyebrow: 'A personal way to pray', description: 'Use Kurukoo for personalized prayers, routines, reminders and supported voice experiences.', cta: '/chat?prompt=I%20would%20like%20a%20prayer', ctaLabel: 'Ask Kurukoo' }],
  ['call', { title: 'Call', eyebrow: 'Realtime communication', description: 'Talk with Kurukoo or use supported peer calling from the same account and conversation context.', cta: '/call', ctaLabel: 'Open Call' }],
  ['notifications', { title: 'Notifications', eyebrow: 'Stay connected', description: 'See useful updates about ongoing work, reminders and things that need your attention.', cta: '/notifications', ctaLabel: 'Open Notifications' }],
  ['safety', { title: 'Safety', eyebrow: 'Safety and check-ins', description: 'Manage safety context and check-ins with clear consent and truthful status.', cta: '/safety', ctaLabel: 'Open Safety' }],
  ['settings', { title: 'Settings', eyebrow: 'Your Kurukoo preferences', description: 'Manage account, security, privacy, memory, notifications, connections, accessibility and product preferences.', cta: '/settings', ctaLabel: 'Open Settings' }],
]);

const cleanCanonicalSections: Record<string, string> = {
  '/home': 'desk', '/desk': 'desk', '/explore': 'discover', '/discover': 'discover', '/topics': 'topics', '/activity': 'requests', '/requests': 'requests', '/reminders': 'reminders', '/saved': 'saved', '/cart': 'cart', '/tasks': 'tasks', '/connect': 'connect', '/agents': 'agents', '/capabilities': 'capabilities', '/opportunities': 'opportunities', '/wallet': 'wallet', '/points': 'points', '/top-up': 'top-up', '/subscriptions': 'subscriptions', '/checkout': 'checkout', '/confirmations': 'confirmations', '/memory': 'memory', '/artifacts': 'artifacts', '/prayer': 'prayer', '/call': 'call', '/notifications': 'notifications', '/safety': 'safety', '/settings': 'settings',
};

const canonicalPathBySection: Record<string, string> = {
  desk: '/home', discover: '/explore', requests: '/activity', tasks: '/tasks', topics: '/topics', reminders: '/reminders', saved: '/saved', cart: '/cart', connect: '/connect', agents: '/agents', capabilities: '/capabilities', opportunities: '/opportunities', wallet: '/wallet', points: '/points', 'top-up': '/top-up', subscriptions: '/subscriptions', checkout: '/checkout', confirmations: '/confirmations', memory: '/memory', artifacts: '/artifacts', prayer: '/prayer', call: '/call', notifications: '/notifications', safety: '/safety', settings: '/settings',
};

const sharedPublicAuthenticated = new Set(['/explore', '/discover', '/topics']);

function screenAssets(section: string): string {
  if (section === 'discover') return '<link rel="stylesheet" href="/css/kurukoo-discover-convergence.css?v=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="/js/kurukoo-discover-convergence.js?v=1" defer></script><script src="/js/kurukoo-discover-map-loader.js?v=1" defer></script>';
  if (section === 'notifications') return '<link rel="stylesheet" href="/css/kurukoo-notifications-convergence.css?v=1"><script src="/js/kurukoo-notifications-convergence.js?v=1" defer></script>';
  if (section === 'connect') return '<link rel="stylesheet" href="/css/kurukoo-contacts-convergence.css?v=1"><script src="/js/kurukoo-contacts-convergence.js?v=1" defer></script>';
  if (section === 'memory') return '<link rel="stylesheet" href="/css/kurukoo-memory-convergence.css?v=1"><script src="/js/kurukoo-memory-convergence.js?v=1" defer></script>';
  return '';
}

function renderApp(req: express.Request, res: express.Response, section = 'desk', requestedPath?: string) {
  const authReq = req as AuthRequest;
  if (!authReq.user?.phone) return res.redirect(302, `/login?return=${encodeURIComponent(req.originalUrl || req.path)}`);
  const selected = surfaceMap.get(section) ?? surfaceMap.get('desk')!;
  const surfaces = getClientSurfaces('web');
  const readiness = getPilotReadiness();
  const integrations = getExternalIntegrationReadiness();
  const enabledIntegrations = integrations.filter((item: any) => item.implementation?.state === 'IMPLEMENTED' || item.implementation?.implemented === true).length;
  const content = getPageContentContract(section);
  const canonicalPath = requestedPath && cleanCanonicalSections[requestedPath] === section && requestedPath.startsWith('/')
    ? (canonicalPathBySection[section] ?? requestedPath)
    : (canonicalPathBySection[section] ?? '/home');
  return res.render('app', { selected, section, canonicalPath, displayName: authReq.user.name || authReq.user.phone, phone: authReq.user.phone, surfaces, readiness, integrations, enabledIntegrations, integrationCount: integrations.length, visualFeatures: getCanonicalDiscoverablePlatformFeatures().filter(feature => !feature.audience.includes('admin')), contentContract: content }, (error, html) => {
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
  } catch { return res.status(500).json({ success: false, error: 'Unable to read personal Memory Profile' }); }
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
    return renderApp(req, res, section, pathname);
  });
}

for (const resource of ['requests','tasks','reminders','opportunities','agents','connections','memory','artifacts']) {
  router.get(`/${resource}/:id`, optionalAuthenticateUser, (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.user?.phone) return res.redirect(302, `/login?return=${encodeURIComponent(req.originalUrl)}`);
    const section = resource === 'connections' ? 'connect' : resource;
    const selected = surfaceMap.get(section as string) ?? surfaceMap.get('desk')!;
    const canonicalPath = canonicalPathBySection[section] ?? `/${resource}`;
    return res.render('app', { selected: { ...selected, description: `${selected.description} This view shows the selected item in context.` }, section, canonicalPath, displayName: authReq.user.name || authReq.user.phone, phone: authReq.user.phone, surfaces: getClientSurfaces('web'), readiness: getPilotReadiness(), integrations: getExternalIntegrationReadiness(), enabledIntegrations: 0, integrationCount: 0, visualFeatures: getCanonicalDiscoverablePlatformFeatures().filter(feature => !feature.audience.includes('admin')), resourceId: req.params.id, contentContract: getPageContentContract(section) });
  });
}

export default router;
