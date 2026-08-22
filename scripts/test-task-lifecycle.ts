import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-task-lifecycle-')), 'tasks.sqlite');
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DB_SAVE_DEBOUNCE_MS = '0';

const { getDb, saveDb } = await import('../src/database.ts');
const { getAvailableTasks, acceptTask, completeTask, TaskStateConflictError } = await import('../src/services/microTasks.ts');

function statusCount(tasks: Array<{ status: string }>, status: string) {
  return tasks.filter((task) => task.status === status).length;
}

async function expectConflict(work: () => Promise<unknown>, label: string) {
  await assert.rejects(work, (error: unknown) => error instanceof TaskStateConflictError, label);
}

const db = await getDb();
db.run(`DELETE FROM micro_tasks`);
db.run(`INSERT INTO micro_tasks(title, description, credits_reward, status, source_type, source_id) VALUES(?, ?, ?, 'available', 'topic', ?)`, ['Available topic check', 'Verify the canonical source context.', 5, 'topic-available']);
db.run(`INSERT INTO micro_tasks(title, credits_reward, status, assigned_to, source_type, source_id) VALUES(?, ?, 'in_progress', ?, 'topic', ?)`, ['Owned in-progress check', 5, 'owner-a', 'topic-progress']);
db.run(`INSERT INTO micro_tasks(title, credits_reward, status, assigned_to, source_type, source_id) VALUES(?, ?, 'completed', ?, 'topic', ?)`, ['Owned completed check', 5, 'owner-a', 'topic-completed']);
db.run(`INSERT INTO micro_tasks(title, credits_reward, status, assigned_to) VALUES(?, ?, 'in_progress', ?)`, ['Other owner task', 5, 'owner-b']);
db.run(`INSERT INTO micro_tasks(title, credits_reward, status, assigned_to) VALUES(?, ?, 'cancelled', ?)`, ['Owned cancelled task', 5, 'owner-a']);
saveDb(true);

const initial = await getAvailableTasks('owner-a');
assert.equal(statusCount(initial, 'available'), 1, 'available metric is sourced from canonical available records');
assert.equal(statusCount(initial, 'in_progress'), 1, 'in-progress metric is sourced from owner-assigned canonical records');
assert.equal(statusCount(initial, 'completed'), 1, 'completed metric is sourced from canonical completed records');
assert.equal(initial.some((task) => task.title === 'Other owner task'), false, 'another owner’s task is never exposed');
assert.equal(initial.find((task) => task.title === 'Available topic check')?.sourceId, 'topic-available', 'source context is retained in the shared task projection');

const available = initial.find((task) => task.title === 'Available topic check');
assert.ok(available, 'available canonical task exists');
const accepted = await acceptTask('owner-a', available.id);
assert.equal(accepted.status, 'in_progress', 'acceptance transitions the canonical task to in_progress');
assert.equal(accepted.assignedTo, 'owner-a', 'acceptance writes the canonical authenticated owner');

const afterAccept = await getAvailableTasks('owner-a');
assert.equal(statusCount(afterAccept, 'available'), 0, 'accepted task leaves Available work');
assert.equal(statusCount(afterAccept, 'in_progress'), 2, 'accepted task appears in In progress');
await expectConflict(() => acceptTask('owner-a', available.id), 'duplicate acceptance is rejected');
await expectConflict(() => acceptTask('owner-b', available.id), 'conflicting acceptance is rejected');

const completed = await completeTask('owner-a', accepted.id, 'Canonical evidence submitted');
assert.equal(completed.success, true, 'completion is accepted only for owned in-progress work');
const afterComplete = await getAvailableTasks('owner-a');
assert.equal(statusCount(afterComplete, 'in_progress'), 1, 'completed task leaves In progress');
assert.equal(statusCount(afterComplete, 'completed'), 2, 'completed task appears under Completed');
await expectConflict(() => completeTask('owner-a', accepted.id, 'Duplicate result'), 'duplicate completion is rejected');
await expectConflict(() => completeTask('owner-b', accepted.id, 'Unauthorized result'), 'cross-owner completion is rejected');
saveDb(true);

fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
console.log('PASS test-task-lifecycle');
