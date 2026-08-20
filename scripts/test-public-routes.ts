import publicRouter from '../src/routes/publicRoutes.js';
import appSurfaceRouter from '../src/routes/appSurfaceRoutes.js';
const expectedPublic = [
    '/',
    '/explore',
    '/explore/:slug',
    '/p/:providerSlug',
    '/requests',
    '/reminders',
    '/saved',
    '/cart',
    '/confirmation',
    '/points',
    '/tasks',
    '/daily-picks',
    '/memory',
    '/safety',
    '/call',
    '/admin',
    '/admin/',
    '/admin/login',
    '/referral-qr/',
    '/start',
    '/chat',
    '/whatsapp-linked-device',
    '/how-it-works',
    '/network',
    '/channels',
    '/pricing',
    '/events',
    '/earn/rides',
    '/earn/:topic',
    '/about',
    '/contact',
    '/help',
    '/api-docs',
    '/legal/:section?',
    '/blog',
    '/careers',
    '/discover',
    '/robots.txt',
    '/sitemap-topics.xml',
    '/topics',
    '/topics/:slug',
    '/login',
    '/settings',
    '/top-up',
    '/subscription',
    '/connect',
    '/api/proactive/feed',
    '/api/chat/sponsored',
    '/ads/:id/click',
    '/resources',
    '/resources/:slug',
    '/partners',
    '/advertise',
    '/:country(ng|gh|gb)',
];

const stack = (publicRouter as any).stack || [];
const routes = stack.filter((layer: any) => layer.route).map((layer: any) => layer.route.path);
const missing = expectedPublic.filter(path => !routes.includes(path));
if (missing.length) throw new Error(`Public route module is missing: ${missing.join(', ')}`);
if (routes.length !== expectedPublic.length) { const unexpected = routes.filter((route: string) => !expectedPublic.includes(route)); throw new Error(`Public route module has unexpected routes: ${unexpected.join(', ')}`); }
const appRoutes = ((appSurfaceRouter as any).stack || []).filter((layer: any) => layer.route).map((layer: any) => layer.route.path);
const canonicalAppPaths = ['/web', '/workspace'];
const missingCanonicalAppPaths = canonicalAppPaths.filter(path => !appRoutes.includes(path));
if (missingCanonicalAppPaths.length) throw new Error(`App-surface route module is missing: ${missingCanonicalAppPaths.join(', ')}`);
const duplicatedCanonicalPaths = canonicalAppPaths.filter(path => routes.includes(path));
if (duplicatedCanonicalPaths.length) throw new Error(`Canonical app-surface paths must not be duplicated in public routes: ${duplicatedCanonicalPaths.join(', ')}`);
console.log(`Public route module contract passed: ${routes.length} public routes and ${canonicalAppPaths.length} app-surface redirects.`);
