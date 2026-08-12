import publicRouter from '../src/routes/publicRoutes.js';

const expected = [
    '/',
    '/explore',
    '/explore/:slug',
    '/p/:providerSlug',
    '/web',
    '/requests',
    '/reminders',
    '/saved',
    '/cart',
    '/points',
    '/tasks',
    '/daily-picks',
    '/memory',
    '/safety',
    '/call',
    '/admin/login',
    '/referral-qr/',
    '/start',
    '/chat',
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
    '/login',
    '/settings',
    '/resources',
    '/resources/:slug',
    '/partners',
    '/advertise',
    '/:country(ng|gh|gb)',
];

const stack = (publicRouter as any).stack || [];
const routes = stack.filter((layer: any) => layer.route).map((layer: any) => layer.route.path);
const missing = expected.filter(path => !routes.includes(path));
if (missing.length) throw new Error(`Public route module is missing: ${missing.join(', ')}`);
if (routes.length !== expected.length) { const unexpected = routes.filter((route: string) => !expected.includes(route)); throw new Error(`Public route module has unexpected routes: ${unexpected.join(', ')}`); }
console.log(`Public route module contract passed: ${routes.length} routes.`);
