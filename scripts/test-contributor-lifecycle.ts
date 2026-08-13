import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-contributor-lifecycle-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'contributor_lifecycle_test_secret_32_chars';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const db = await getDb();
const contributor = '+2348010006001';
const anotherUser = '+2348010006002';
const adminPhone = '+2348010006099';
for (const [phone, name] of [[contributor, 'Contributor'], [anotherUser, 'Other user'], [adminPhone, 'Moderator']] as const) {
  db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,country,points_balance,subscription_tier) VALUES(?,?,?,?,?)`, [phone, name, 'ng', 0, 'Base']);
}
db.run(`INSERT INTO micro_tasks(title,description,skill_tag,credits_reward,status) VALUES(?,?,?,?,?)`, ['Verify a local listing', 'Confirm the listing details from a verifiable source.', 'listing_verification', 15, 'available']);
const taskId = Number(db.exec(`SELECT last_insert_rowid() AS id`)[0].values[0][0]);
saveDb();

const token = (phone: string, role = 'user') => jwt.sign({ phone, role }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const headers = (phone: string, role = 'user') => ({ Authorization: `Bearer ${token(phone, role)}`, 'Content-Type': 'application/json' });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const available = await fetch(`${baseUrl}/api/tasks`, { headers: headers(contributor) });
  const availableTasks = await available.json() as Array<{ id: number }>;
  assert.equal(available.status, 200);
  assert.ok(availableTasks.some((task) => task.id === taskId), 'available task should be visible before acceptance');

  const accepted = await fetch(`${baseUrl}/api/tasks/accept`, { method: 'POST', headers: headers(contributor), body: JSON.stringify({ taskId }) });
  assert.equal(accepted.status, 200, await accepted.text());

  const otherEvidence = await fetch(`${baseUrl}/api/tasks/evidence`, { method: 'POST', headers: headers(anotherUser), body: JSON.stringify({ taskId, evidence: { summary: 'I did this' } }) });
  assert.equal(otherEvidence.status, 409, 'another user must not submit evidence for a task they do not own');

  const submit = await fetch(`${baseUrl}/api/tasks/evidence`, { method: 'POST', headers: headers(contributor), body: JSON.stringify({ taskId, evidence: { summary: 'Checked provider listing against the supplied source.', references: ['https://example.test/listing'] } }) });
  const submitted = await submit.json() as { success?: boolean; status?: string };
  assert.equal(submit.status, 201, JSON.stringify(submitted));
  assert.equal(submitted.status, 'submitted');

  const beforeModeration = await fetch(`${baseUrl}/api/points/balance`, { headers: headers(contributor) });
  assert.equal((await beforeModeration.json() as { points: number }).points, 0, 'evidence submission must not award Points automatically');

  const forbiddenModeration = await fetch(`${baseUrl}/api/admin/tasks/${taskId}/moderate`, { method: 'POST', headers: headers(contributor), body: JSON.stringify({ decision: 'approved' }) });
  assert.equal(forbiddenModeration.status, 403, 'only an administrator can moderate contributor evidence');

  const queue = await fetch(`${baseUrl}/api/admin/tasks/submitted`, { headers: headers(adminPhone, 'admin') });
  const queuePayload = await queue.json() as { tasks?: Array<{ id: number; evidence?: { summary?: string } }> };
  assert.equal(queue.status, 200, JSON.stringify(queuePayload));
  assert.ok(queuePayload.tasks?.some((task) => task.id === taskId && task.evidence?.summary?.includes('Checked provider')));

  const approved = await fetch(`${baseUrl}/api/admin/tasks/${taskId}/moderate`, { method: 'POST', headers: headers(adminPhone, 'admin'), body: JSON.stringify({ decision: 'approved', note: 'Evidence accepted.' }) });
  const approvedPayload = await approved.json() as { success?: boolean; reward?: number; task?: { status?: string } };
  assert.equal(approved.status, 200, JSON.stringify(approvedPayload));
  assert.equal(approvedPayload.task?.status, 'approved');
  assert.equal(approvedPayload.reward, 15);

  const afterModeration = await fetch(`${baseUrl}/api/points/balance`, { headers: headers(contributor) });
  assert.equal((await afterModeration.json() as { points: number }).points, 15, 'approval should award the configured Points once');

  const repeatedApproval = await fetch(`${baseUrl}/api/admin/tasks/${taskId}/moderate`, { method: 'POST', headers: headers(adminPhone, 'admin'), body: JSON.stringify({ decision: 'approved', note: 'Repeat request' }) });
  const repeatedPayload = await repeatedApproval.json() as { idempotent?: boolean };
  assert.equal(repeatedApproval.status, 200, JSON.stringify(repeatedPayload));
  assert.equal(repeatedPayload.idempotent, true, 'repeated moderator decision must be idempotent');

  const finalBalance = await fetch(`${baseUrl}/api/points/balance`, { headers: headers(contributor) });
  assert.equal((await finalBalance.json() as { points: number }).points, 15, 'repeat moderation must not duplicate the Points reward');

  const mine = await fetch(`${baseUrl}/api/tasks/mine`, { headers: headers(contributor) });
  const minePayload = await mine.json() as { tasks?: Array<{ id: number; status?: string; evidence?: { references?: string[] } }> };
  assert.equal(mine.status, 200, JSON.stringify(minePayload));
  assert.ok(minePayload.tasks?.some((task) => task.id === taskId && task.status === 'approved' && task.evidence?.references?.[0] === 'https://example.test/listing'));

  console.log('Contributor lifecycle regression passed: owner-scoped acceptance and evidence, admin moderation, and idempotent Points reward.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
