/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import publicRouter from '../src/routes/publicRoutes.js';

const expected = [
    '/referral-qr/',
    '/start',
    '/api/proactive/feed',
    '/api/proactive/:id/act',
    '/api/proactive/:id/dismiss',
    '/ads/:id/click',
    '/api/chat/sponsored',
    '/api/public-ads',
    '/admin',
    '/admin/',
    '/admin/login',
    '/explore',
    '/explore/',
    '/events',
    '/earn/rides',
    '/earn/:topic',
    '/channels',
    '/resources',
    '/resources/',
    '/resources/*',
    '/robots.txt',
    '/sitemap-topics.xml',
    '/topics/:slug',
    '/places/:slug',
// '/chat' and '/' are SPA-owned (SPA_PILOT_ROUTES); '/:country' redirects to '/'
// so the public router no longer owns the homepage or its country variants.
];


const stack = (publicRouter as any).stack || [];
const routes: string[] = stack.filter((layer: any) => layer.route).flatMap((layer: any) => layer.route.path);
// /explore and /explore/ are registered only as the 302 removal mechanism for the retired
// browse surface; they must never render content again.
const retiredExploreAliases = ['/explore', '/explore/'];
// Retired EJS page owners: the SPA prerender boundary serves these routes now.
const spaOwnedRoutes = ['/about','/contact','/help','/api-docs','/legal/:section?','/blog','/careers','/discover','/discover/:slug','/how-it-works','/network','/pricing','/topics','/partners','/advertise','/login','/p/:providerSlug','/features','/developers','/whatsapp-linked-device','/chat','/','/places'];
// '/resources' is a retired redirect alias (302 to /help), not an SPA-owned page.
const retiredWorkspaceAliases = ['/requests','/reminders','/saved','/cart','/confirmation','/points','/tasks','/daily-picks','/memory','/safety','/call','/settings','/top-up','/subscription','/connect'];
const missing = expected.filter(path => !routes.includes(path));
const retired = retiredWorkspaceAliases.filter(path => routes.includes(path));
if (missing.length) throw new Error(`Public route module is missing: ${missing.join(', ')}`);
if (retired.length) throw new Error(`Public route module must not retain workspace aliases: ${retired.join(', ')}`);
if (retiredExploreAliases.some((path) => !routes.includes(path))) throw new Error('Explore removal redirects must stay registered until external links expire');
if (spaOwnedRoutes.some((path) => routes.includes(path))) throw new Error(`Public route module must not re-own SPA routes: ${spaOwnedRoutes.filter((path) => routes.includes(path)).join(', ')}`);
if (routes.length !== expected.length) { const unexpected = routes.filter((route: string) => !expected.includes(route)); throw new Error(`Public route module has unexpected routes: ${unexpected.join(', ')}`); }
console.log(`Public route module contract passed: ${routes.length} routes.`);
