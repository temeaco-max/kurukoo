import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-dashboard-snapshot-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'admin_dashboard_snapshot_test_secret_32_chars';

const { app } = await import('../src/index.js');
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });

try {
  const anonymous = await fetch(`${baseUrl}/api/admin/dashboard`);
  assert.equal(anonymous.status, 401, 'dashboard snapshot remains behind the existing admin boundary');

  const response = await fetch(`${baseUrl}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body?.stats?.summary?.profiles, 'number');
  assert.equal(typeof body?.stats?.summary?.availableProviders, 'number');
  assert.equal(typeof body?.stats?.unread_internal_notifications, 'number');
  assert.equal(typeof body?.stats?.economic_requests, 'object');
  assert.equal(typeof body?.revenue?.metrics, 'object');
  assert.ok(Array.isArray(body?.skillFlows));
  assert.ok(Array.isArray(body?.presence));
  assert.ok(Array.isArray(body?.content));
  assert.equal(typeof body?.seo, 'object');
  assert.ok(!Object.values(body).some((value) => value === undefined), 'snapshot exposes explicit canonical values rather than undefined fields');
  console.log('Admin dashboard snapshot regression passed: authenticated canonical dashboard data is available in one response.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
