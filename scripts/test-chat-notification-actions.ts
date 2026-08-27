import assert from 'node:assert/strict';
import fs from 'node:fs';

const dbPath = `/tmp/kurukoo-chat-notification-actions-${process.pid}.sqlite`;
try { fs.unlinkSync(dbPath); } catch { /* isolated test */ }
process.env.NODE_ENV = 'test';
process.env.DB_PATH = dbPath;
process.env.MEMORY_ENCRYPTION_KEY = 'chat-notification-actions-test-key';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';
process.env.KURUKOO_SMOLLM2_LOCAL = 'false';

const { sendFcmPush, getInternalNotifications } = await import('../src/services/pushNotifications.js');
const { routeIntent } = await import('../src/services/intentRouter.js');

const phone = '+2348090000099';
await sendFcmPush(phone, 'Request update', 'Your internally stored request update is ready to review.');
await sendFcmPush(phone, 'Reminder update', 'Your internally stored reminder update is ready to review.');
const before = await getInternalNotifications(phone, 20);
assert.equal(before.length, 2);
assert.ok(before.every(item => item.status !== 'read'));

const one = await routeIntent(`Mark notification ${before[0].id} as read`, phone);
assert.equal(one.skill, 'notifications');
assert.equal(one.canonicalAction, 'notification.mark_read');
assert.equal(one.cardData?.status, 'completed');
assert.match(one.reply, /marked.*read|internal notification state/i);
const afterOne = await getInternalNotifications(phone, 20);
assert.equal(afterOne.find(item => item.id === before[0].id)?.status, 'read');
assert.equal(afterOne.find(item => item.id === before[1].id)?.status, 'unread');

const all = await routeIntent('Mark all notifications as read', phone);
assert.equal(all.skill, 'notifications');
assert.equal(all.canonicalAction, 'notification.mark_all_read');
assert.equal(all.cardData?.status, 'read');
assert.match(all.reply, /marked 1 stored notification as read|no unread/i);
const afterAll = await getInternalNotifications(phone, 20);
assert.ok(afterAll.every(item => item.status === 'read'));

console.log('Chat notification action regression passed: owner-scoped single-update and mark-all-read actions complete internal state truthfully without claiming external delivery.');
try { fs.unlinkSync(dbPath); } catch { /* best effort cleanup */ }
