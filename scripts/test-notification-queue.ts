import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-notifications-'));
process.env.DB_PATH = path.join(tempDir, 'notifications.sqlite');
process.env.JWT_SECRET = 'notification-queue-test-secret-0123456789';
process.env.ADMIN_USERNAME = 'queue-admin';
process.env.ADMIN_PASSWORD = 'queue-admin-password';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { sendFcmPush } = await import('../src/services/pushNotifications.js');

const phone = '+2348090000000';
const otherPhone = '+2348090000001';
const userToken = (identity: string) => jwt.sign({ phone: identity, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
const userHeaders = (identity: string) => ({ Authorization: `Bearer ${userToken(identity)}` });

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const { port } = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${port}`;

try {
  assert.equal(await sendFcmPush(phone, 'Deferred match', 'A provider is available.', '/web'), false, 'Unconfigured FCM must not claim delivery');

  const ownerList = await fetch(`${baseUrl}/api/notifications`, { headers: userHeaders(phone) });
  assert.equal(ownerList.status, 200, 'Authenticated owner should list internal notifications');
  const ownerPayload = await ownerList.json() as { notifications?: Array<{ id: number; status: string; link: string }> };
  assert.equal(ownerPayload.notifications?.length, 1, 'Queued notification should appear once in the owner inbox');
  const notification = ownerPayload.notifications?.[0];
  assert.equal(notification?.status, 'unread', 'New internal notifications should be unread');
  assert.equal(notification?.link, '/web', 'Notification link should be retained');

  const otherList = await fetch(`${baseUrl}/api/notifications`, { headers: userHeaders(otherPhone) });
  const otherPayload = await otherList.json() as { notifications?: unknown[] };
  assert.equal(otherList.status, 200, 'Another authenticated user may query their own inbox');
  assert.equal(otherPayload.notifications?.length || 0, 0, 'Internal notifications must be owner-scoped');

  const markRead = await fetch(`${baseUrl}/api/notifications/${notification?.id}/read`, {
    method: 'POST',
    headers: userHeaders(phone),
  });
  assert.equal(markRead.status, 200, 'Owner should mark a notification read');

  const repeatedRead = await fetch(`${baseUrl}/api/notifications/${notification?.id}/read`, {
    method: 'POST',
    headers: userHeaders(phone),
  });
  assert.equal(repeatedRead.status, 200, 'Repeated notification read should remain idempotent');

  const unauthorizedRead = await fetch(`${baseUrl}/api/notifications/${notification?.id}/read`, {
    method: 'POST',
    headers: userHeaders(otherPhone),
  });
  assert.equal(unauthorizedRead.status, 404, 'Another owner must not mark the notification read');

  const health = await fetch(`${baseUrl}/health`);
  const healthPayload = await health.json() as { status?: string; scheduled_reminders?: number; active_check_ins?: number };
  assert.equal(health.status, 200, 'Health endpoint should remain available');
  assert.equal(healthPayload.status, 'ok', 'Health should report the database as available');
  assert.equal(typeof healthPayload.scheduled_reminders, 'number', 'Health should report reminder observability');
  assert.equal(typeof healthPayload.active_check_ins, 'number', 'Health should report safety observability');

  const adminAuth = await fetch(`${baseUrl}/api/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'queue-admin', password: 'queue-admin-password' }),
  });
  assert.equal(adminAuth.status, 200, 'Configured admin should authenticate');
  const adminPayload = await adminAuth.json() as { token?: string };
  assert.ok(adminPayload.token, 'Admin auth should issue a token');

  const stats = await fetch(`${baseUrl}/api/admin/stats`, { headers: { Authorization: `Bearer ${adminPayload.token}` } });
  const statsPayload = await stats.json() as { success?: boolean; economic_requests?: unknown; reminders?: unknown; check_ins?: unknown; unread_internal_notifications?: number };
  assert.equal(stats.status, 200, 'Admin should access platform stats');
  assert.equal(statsPayload.success, true, 'Stats should return a successful payload');
  assert.equal(typeof statsPayload.economic_requests, 'object', 'Stats should include economic request status counts');
  assert.equal(typeof statsPayload.reminders, 'object', 'Stats should include reminder status counts');
  assert.equal(typeof statsPayload.check_ins, 'object', 'Stats should include safety check-in status counts');
  assert.equal(statsPayload.unread_internal_notifications, 0, 'Stats should reflect the read notification');

  const db = await getDb();
  const queued = db.exec('SELECT status FROM internal_notifications WHERE phone = ?', [phone]);
  assert.equal(queued[0]?.values?.[0]?.[0], 'read', 'Queue state should persist the owner-scoped read transition');
  console.log('Notification queue tests passed');
} finally {
  server.close();
}
