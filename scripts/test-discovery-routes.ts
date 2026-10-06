/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-discovery-routes-${process.pid}-${Date.now()}.sqlite`;
const { default: discoveryRouter } = await import('../src/routes/discoveryRoutes.js');

const stack = (discoveryRouter as any).stack || [];
const routes = stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));

const mapRoute = routes.find((route: any) => route.path === '/api/discover/map');
if (!mapRoute) throw new Error('Discovery map route is missing');
if (!mapRoute.methods.includes('get')) throw new Error('Discovery map route must support GET');

console.log('Discovery route contract passed: GET /api/discover/map.');
