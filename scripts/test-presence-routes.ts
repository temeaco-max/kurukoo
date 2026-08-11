import assert from 'node:assert/strict';
import express from 'express';
import presenceRouter from '../src/routes/presenceRoutes.js';

const stack = (presenceRouter as any).stack || [];
const routes = stack.filter((layer: any) => layer.route).map((layer: any) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
}));

const expected = [
    ['GET', '/api/stats/pulse'],
    ['POST', '/api/pulse/live'],
    ['POST', '/api/pulse/activate'],
    ['POST', '/api/pulse/deactivate'],
    ['GET', '/api/pulse/status'],
    ['GET', '/api/pulse/providers'],
];

for (const [method, path] of expected) {
    const route = routes.find((item: any) => item.path === path && item.methods.includes(method.toLowerCase()));
    if (!route) throw new Error(`Missing ${method} ${path}`);
}

const app = express();
app.use(presenceRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Presence test server did not bind a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/stats/pulse`);
    assert.equal(response.status, 200, 'Pulse statistics should remain publicly readable');
    const payload = await response.json() as { success?: boolean; activeProviderCount?: unknown; pulses?: unknown[] };
    assert.equal(payload.success, true, 'Pulse statistics must report a successful shared-presence lookup');
    assert.equal(typeof payload.activeProviderCount, 'number', 'Pulse statistics must expose an actual aggregate count');
    assert.ok(Array.isArray(payload.pulses), 'Pulse statistics must preserve the pulses collection contract');
    for (const pulse of payload.pulses || []) {
        assert.doesNotMatch(String((pulse as any).text || ''), /escrow|payment|matched|dispatched/i, 'Pulse statistics must not fabricate economic activity');
    }
} finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`Presence route contract passed: ${expected.length} routes and live shared-presence statistics.`);
