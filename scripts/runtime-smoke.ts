/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';

const base = String(process.env.KURUKOO_BASE_URL || '').trim().replace(/\/$/, '');
if (!base) {
  console.error('KURUKOO_BASE_URL is required for deployed runtime smoke execution. Example: KURUKOO_BASE_URL=https://your-live-host');
  process.exit(2);
}

const checks = [
  { path: '/health', expected: [200] },
  { path: '/readyz', expected: [200, 503] },
  { path: '/', expected: [200] },
  { path: '/chat', expected: [200] },
  { path: '/pricing', expected: [200] },
  { path: '/help', expected: [200] },
  { path: '/about', expected: [200] },
];

const results: Array<Record<string, unknown>> = [];
for (const check of checks) {
  const started = Date.now();
  const response = await fetch(`${base}${check.path}`, {
    redirect: 'manual',
    headers: { 'user-agent': 'kurukoo-runtime-smoke/1.0' },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  results.push({ path: check.path, status: response.status, contentType, ms: Date.now() - started, bytes: body.length });
  assert.ok(check.expected.includes(response.status), `${check.path}: unexpected HTTP ${response.status}; expected ${check.expected.join(', ')}`);
  assert.ok(body.length > 0, `${check.path}: empty response body`);
}

const health = await fetch(`${base}/health`, { headers: { 'user-agent': 'kurukoo-runtime-smoke/1.0' } });
const healthBody = await health.json().catch(() => null) as any;
assert.equal(health.status, 200, `/health returned ${health.status}`);
assert.equal(healthBody?.service, 'kurukoo', 'health service identity mismatch');
assert.ok(['ok', 'degraded'].includes(String(healthBody?.status)), 'health status must be explicit');
assert.ok(typeof healthBody?.database === 'string', 'health must expose database state');
assert.ok(healthBody?.capability_runtime, 'health must expose capability runtime snapshot');
assert.ok(healthBody?.integrations_operational, 'health must expose external integration operational state');

console.log(JSON.stringify({
  runtimeSmoke: 'kurukoo-live-v1',
  base,
  health: { status: healthBody.status, database: healthBody.database, model: healthBody.model?.model || null },
  checks: results,
  note: 'This script validates the deployed HTTP surface only. It does not fabricate provider, payment, notification, inventory or physical-fulfilment success.',
}, null, 2));
