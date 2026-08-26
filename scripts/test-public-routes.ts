import publicRouter from '../src/routes/publicRoutes.js';

const expected = [
    '/',
    '/explore',
    '/explore/:slug',
    '/p/:providerSlug',
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
const retiredWorkspaceAliases = ['/requests','/reminders','/saved','/cart','/confirmation','/points','/tasks','/daily-picks','/memory','/safety','/call','/settings','/top-up','/subscription','/connect'];
const missing = expected.filter(path => !routes.includes(path));
const retired = retiredWorkspaceAliases.filter(path => routes.includes(path));
if (missing.length) throw new Error(`Public route module is missing: ${missing.join(', ')}`);
if (retired.length) throw new Error(`Public route module must not retain workspace aliases: ${retired.join(', ')}`);
if (routes.length !== expected.length) { const unexpected = routes.filter((route: string) => !expected.includes(route)); throw new Error(`Public route module has unexpected routes: ${unexpected.join(', ')}`); }
console.log(`Public route module contract passed: ${routes.length} routes.`);
