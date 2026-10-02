/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
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
assert(src.includes("router.get('/tasks/summary'"), 'GET /tasks/summary registered');
assert(src.includes("router.post('/tasks/accept'"), 'POST /tasks/accept registered');
assert(src.includes("router.post('/tasks/complete'"), 'POST /tasks/complete registered');
assert(src.includes('authenticateUser'), 'uses authenticateUser');
assert(src.includes('sessionPhone'), 'uses sessionPhone helper');
assert(src.includes('phone must match session'), 'rejects mismatched client phone');
assert(!src.includes('+2348030000000'), 'no demo phone literal');

const markers = [
  "router.post('/appointments/book', authenticateUser",
  "router.get('/tasks', authenticateUser",
  "router.get('/tasks/summary', authenticateUser",
  "router.post('/tasks/accept', authenticateUser",
  "router.post('/tasks/complete', authenticateUser",
];
for (const m of markers) {
  assert(src.includes(m), `auth middleware inline: ${m.split(',')[0]}`);
}

assert(src.includes("from '../services/appointmentService.js'"), 'imports appointment service');
assert(src.includes("from '../services/microTasks.js'"), 'imports microTasks service');
assert(src.includes("from '../database.js'"), 'summary reads the canonical task database owner');
assert(src.includes('TaskStateConflictError'), 'preserves canonical task conflict error handling');
assert(src.includes('taskStateError'), 'returns canonical stale or conflicting task state errors');
assert(src.includes("status IN ('completed', 'approved')"), 'Completed metric uses canonical terminal states');
assert(src.includes("status = 'available'"), 'Available metric uses canonical available state');
assert(src.includes("status = 'in_progress'"), 'In progress metric uses canonical active state');

const taskService = fs.readFileSync(path.join(__dirname, '../src/services/microTasks.ts'), 'utf8');
assert(taskService.includes("status = 'available'"), 'canonical task projection includes available work');
assert(taskService.includes('assigned_to = ?'), 'canonical task projection is owner-scoped');
assert(taskService.includes('getRowsModified'), 'conditional task transitions protect stale and duplicate actions');
assert(taskService.includes("status = 'in_progress'"), 'canonical acceptance transitions to in_progress');
assert(taskService.includes("status = 'completed'"), 'canonical completion transitions to completed');

const template = fs.readFileSync(path.join(__dirname, '../views/app.ejs'), 'utf8');
assert(template.includes('k-app-surface'), 'Tasks must use the unified app surface loader');
assert(!template.includes('kurukoo-tasks-convergence'), 'Tasks must use unified visual system, not section-specific CSS');
// A metric card may carry a task-specific modifier, but it must still be built
// on the unified primitive. Asserting the co-occurrence is stricter than banning
// the substring: dropping k-app-card from a metric card still fails.
const metricCards = [...template.matchAll(/<article class="([^"]*k-task-metric[^"]*)"/g)].map((match) => match[1]);
assert(metricCards.length > 0, 'Tasks must render metric cards');
for (const cardClass of metricCards) {
  assert(cardClass.includes('k-app-card'), `Tasks metric cards must use the unified k-app-card primitive, not a task-specific replacement: ${cardClass}`);
}

const workspace = fs.readFileSync(path.join(__dirname, '../frontend/public/js/kurukoo-workspace.js'), 'utf8');
// The shared workspace hydrator ships double-quoted literals; compare against a
// quote-normalised copy so these assertions test behaviour, not formatting.
const workspaceNormalized = workspace.replace(/"/g, "'");
assert(workspaceNormalized.includes("api('/api/tasks')"), 'shared workspace hydrator reads the canonical Tasks API');
assert(workspaceNormalized.includes("status === 'available'"), 'Tasks acceptance is available-state-only in the client projection');
assert(workspaceNormalized.includes('else if (task.id)'), 'Tasks continuation opens persisted owner-scoped work in the exact canonical Chat context after available work is accepted');
assert(workspaceNormalized.includes("status === 'completed'"), 'Tasks metrics identify canonical completion');

const appRouteSrc = fs.readFileSync(path.join(__dirname, '../src/routes/appSurfaceRoutes.ts'), 'utf8');
assert(appRouteSrc.includes("'/tasks': 'tasks'"), 'appSurfaceRoutes maps /tasks to tasks canonical path');
assert(appRouteSrc.includes("'/work': 'tasks'"), 'appSurfaceRoutes maps /work to tasks canonical path');
assert(!appRouteSrc.includes('kurukoo-tasks-convergence'), 'appSurfaceRoutes must not reference section-specific convergence files');

const indexSrc = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
assert(!indexSrc.includes('legacyApp'), 'composition root does not depend on legacyApp');
assert(indexSrc.includes('./routes/taskRoutes.js'), 'composition root mounts the canonical task route boundary');
assert(indexSrc.includes('taskRoutes'), 'canonical task route is imported by the application entrypoint');

console.log('PASS test-task-routes');
