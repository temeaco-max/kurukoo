/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import contentRouter from '../src/routes/contentRoutes.js';

const stack = (contentRouter as any).stack || [];
const routes = stack.filter((layer: any) => layer.route).flatMap((layer: any) => (Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path]).map((p: string) => ({ path: p, methods: Object.keys(layer.route.methods) })));

for (const [method, path] of [
    // '/resources' is retired (29a): the page and its index are gone and the
    // public router 302s them to /help. Only the detail alias is still served.
    ['GET', '/help/guides/:slug'],
    ['GET', '/resources/:slug'],
    ['GET', '/api/resources'],
    ['GET', '/api/resources/:slug'],
    ['GET', '/api/blog'],
    ['GET', '/api/blog/:slug'],
]) {
    const route = routes.find((item: any) => item.path === path && item.methods.includes(method.toLowerCase()));
    if (!route) throw new Error(`Missing ${method} ${path}`);
}

console.log('Content route contract passed: Help guides (with the retired /resources detail alias) and Blog endpoints present.');