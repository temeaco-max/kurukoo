/**
 * Contract tests for taskRoutes (appointments + micro-tasks).
 * Static analysis — no runtime Express import required.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/routes/taskRoutes.ts');
const src = fs.readFileSync(srcPath, 'utf8');

console.log('test-task-routes');

assert(src.includes("router.post('/appointments/book'"), 'POST /appointments/book registered');
assert(src.includes("router.get('/tasks'"), 'GET /tasks registered');
assert(src.includes("router.post('/tasks/accept'"), 'POST /tasks/accept registered');
assert(src.includes("router.post('/tasks/complete'"), 'POST /tasks/complete registered');
assert(src.includes('authenticateUser'), 'uses authenticateUser');
assert(src.includes('sessionPhone'), 'uses sessionPhone helper');
assert(src.includes('phone must match session'), 'rejects mismatched client phone');
assert(!src.includes('+2348030000000'), 'no demo phone literal');

const markers = [
  "router.post('/appointments/book', authenticateUser",
  "router.get('/tasks', authenticateUser",
  "router.post('/tasks/accept', authenticateUser",
  "router.post('/tasks/complete', authenticateUser",
];
for (const m of markers) {
  assert(src.includes(m), `auth middleware inline: ${m.split(',')[0]}`);
}

assert(src.includes("from '../services/appointmentService.js'"), 'imports appointment service');
assert(src.includes("from '../services/microTasks.js'"), 'imports microTasks service');
assert(src.includes('TaskStateConflictError'), 'preserves canonical task conflict error handling');
assert(src.includes('taskStateError'), 'returns canonical stale or conflicting task state errors');

const taskService = fs.readFileSync(path.join(__dirname, '../src/services/microTasks.ts'), 'utf8');
assert(taskService.includes("status = 'available'"), 'canonical task projection includes available work');
assert(taskService.includes('assigned_to = ?'), 'canonical task projection is owner-scoped');
assert(taskService.includes('getRowsModified'), 'conditional task transitions protect stale and duplicate actions');
assert(taskService.includes("status = 'in_progress'"), 'canonical acceptance transitions to in_progress');
assert(taskService.includes("status = 'completed'"), 'canonical completion transitions to completed');

const template = fs.readFileSync(path.join(__dirname, '../views/app.ejs'), 'utf8');
assert(template.includes('data-workspace-owned-surface="tasks"'), 'Tasks declares an owned workspace surface contract');
assert(template.includes('data-task-metric="available"'), 'Tasks exposes an accessible Available work metric hook');
assert(template.includes('data-task-metric="progress"'), 'Tasks exposes an accessible In progress metric hook');
assert(template.includes('data-task-metric="completed"'), 'Tasks exposes an accessible Completed metric hook');
assert(template.includes('data-tasks-error'), 'Tasks distinguishes unavailable task authority from an empty state');

const workspace = fs.readFileSync(path.join(__dirname, '../public/js/kurukoo-workspace.js'), 'utf8');
assert(workspace.includes("api('/api/tasks')"), 'shared workspace hydrator reads the canonical Tasks API');
assert(workspace.includes("status === 'available'"), 'Tasks acceptance is available-state-only in the client projection');
assert(workspace.includes("status === 'in_progress'"), 'Tasks continuation identifies canonical in-progress work');
assert(workspace.includes("status === 'completed'"), 'Tasks metrics identify canonical completion');

const convergence = fs.readFileSync(path.join(__dirname, '../public/js/kurukoo-app-convergence.js'), 'utf8');
assert(convergence.includes('data-workspace-owned-surface'), 'generic convergence fallback respects route-owned workspace contracts');

// Composition-root contract: src/index.ts is the canonical application entrypoint.
const indexSrc = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
assert(!indexSrc.includes('legacyApp'), 'composition root does not depend on legacyApp');
assert(indexSrc.includes("./routes/taskRoutes.js"), 'composition root mounts the canonical task route boundary');
assert(indexSrc.includes("taskRoutes"), 'canonical task route is imported by the application entrypoint');

console.log('PASS test-task-routes');
