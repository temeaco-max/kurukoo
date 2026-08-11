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

// Composition-root contract: src/index.ts mounts canonical route boundaries only.
const indexSrc = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
assert(!indexSrc.includes('legacyApp'), 'composition root does not depend on legacyApp');
assert(indexSrc.includes("./routes/taskRoutes.js"), 'composition root mounts the canonical task route boundary');
assert(indexSrc.includes('composition root'), 'index is explicitly a composition root');

console.log('PASS test-task-routes');
