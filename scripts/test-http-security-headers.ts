import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-http-headers-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'http_header_test_secret_at_least_32_chars';

const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

function assertBrowserBoundary(response: Response): void {
  assert.equal(response.headers.get('x-powered-by'), null, 'framework disclosure must be disabled');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('permissions-policy'), 'geolocation=(self), microphone=(self), camera=(), payment=()');
}

try {
  for (const route of ['/', '/manifest.json', '/admin/users.html']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.ok(response.ok, `${route} must remain reachable during header hardening`);
    assertBrowserBoundary(response);
  }

  const discover = await fetch(`${baseUrl}/api/discover/map?lat=6.5244&lng=3.3792`);
  assert.equal(discover.status, 200);
  assertBrowserBoundary(discover);
  assert.match(String(discover.headers.get('cache-control')), /private/i, 'nearby presence projections must retain private cache semantics');

  const unavailableVoice = await fetch(`${baseUrl}/api/voice/status`);
  assert.equal(unavailableVoice.status, 200);
  assertBrowserBoundary(unavailableVoice);

  const attachment = await fetch(`${baseUrl}/api/chat/attachments/not-a-real-attachment`);
  assert.equal(attachment.status, 401);
  assertBrowserBoundary(attachment);

  console.log('HTTP security header regression passed: framework disclosure removed, browser-security headers cover public/static/admin/API routes, and route-specific private cache semantics remain intact.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) await fs.promises.rm(`${dbPath}${suffix}`, { force: true });
}
