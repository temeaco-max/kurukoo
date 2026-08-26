import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/routes/appSurfaceRoutes.ts');
const app = read('views/app.ejs');
const desk = read('public/js/kurukoo-desk-system.js');
const deskData = read('public/js/kurukoo-desk-data.js');
const chat = read('public/chat/index.html');
const requests = read('public/js/kurukoo-requests-convergence.js');
const tasks = read('public/js/kurukoo-tasks-convergence.js');
const notifications = read('public/js/kurukoo-notifications-convergence.js');
const connect = read('public/js/kurukoo-contacts-convergence.js');
const memory = read('public/js/kurukoo-memory-convergence.js');
const discover = read('public/js/kurukoo-discover-convergence.js');
const workOverview = read('public/js/kurukoo-agents-convergence.js');
const styling = read('public/css/kurukoo-product-os-convergence.css');

for (const pathname of ['/desk', '/chat', '/requests', '/tasks', '/notifications', '/connect', '/memory', '/discover', '/agents']) {
  assert.match(routes, new RegExp(`['\"]${pathname.replace('/', '\\/')}['\"]|router\\.get\\(['\"]${pathname.replace('/', '\\/')}`), `Canonical route must remain available: ${pathname}`);
}

for (const expected of ['Desk', 'Chat', 'Requests', 'Tasks', 'Updates', 'Discover', 'Connect', 'Work overview', 'Memory']) {
  assert.match(app, new RegExp(`>${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`), `Authenticated hierarchy should expose ${expected}`);
}
assert.match(app, /aria-label="More Kurukoo"/, 'Secondary destinations must be grouped rather than crowding primary navigation');
assert.match(routes, /\['agents', \{ title: 'Work overview'/, 'The canonical /agents route should be presented as a user-facing work overview');
assert.match(app, /Keep this work connected/, 'Shared surfaces should explain relationship continuity without runtime vocabulary');

for (const moduleId of ['today-flow', 'agent-objectives', 'active-requests', 'tasks-reminders', 'recent-outcomes', 'pulse']) {
  assert.match(desk, new RegExp(`makeDeskModule\\('${moduleId}'`), `Desk must retain the ${moduleId} canonical module`);
}
assert.match(desk, /'Needs attention'/, 'Desk must foreground explicit attention work');
assert.match(desk, /'Working now'/, 'Desk must explain current work in human language');
assert.match(desk, /'Recent outcomes'/, 'Desk must retain outcomes separate from in-progress work');
for (const endpoint of ['/api/chat/economic-requests', '/api/tasks', '/api/notifications', '/api/reminders', '/api/agent/goals']) {
  assert.match(deskData, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Desk hydration must continue using canonical endpoint ${endpoint}`);
}
assert.doesNotMatch(deskData, /africastalking|providerBaseUrl|fetch\(['\"]https?:/i, 'Desk must not add a parallel external-provider transport');

assert.match(chat, /<span class="agent-title" id="header-context-title">Kurukoo<\/span>/, 'Chat must remain the single Kurukoo-facing control surface');
assert.match(chat, /What would you like to move forward\?/, 'Chat landing copy should orient around a personal need-to-outcome model');
for (const label of ['Current work', 'Work in progress', 'What is happening', 'What is needed from you', 'Next actions']) {
  assert.match(chat, new RegExp(label), `Chat context should expose ${label}`);
}
assert.match(requests, /Continue with Kurukoo/, 'Requests must offer a contextual return to Chat');
assert.match(tasks, /Part of a request/, 'Tasks must show their request relationship');
assert.match(tasks, /Part of an objective Kurukoo is moving forward/, 'Tasks must show their work relationship');
assert.match(notifications, /Changes and decisions that matter/, 'Updates must distinguish meaningful changes from generic activity');
assert.match(connect, /People connected to your Kurukoo/, 'Connect must foreground human relationships');
assert.match(memory, /What Kurukoo remembers about you/, 'Memory must retain an owner-centred explanation');
assert.match(discover, /See what might help today\./, 'Discover must retain a user-centred attributed starting point');
assert.match(workOverview, /What Kurukoo is keeping moving|Continue with Kurukoo/, 'Work overview must remain a readable inspection surface');
assert.match(styling, /k-desk-module-today-flow/, 'Responsive style layer must make attention work materially distinct');
assert.match(styling, /@media \(max-width: 820px\)/, 'Responsive hierarchy must have a compact-screen layout');

console.log('Product OS convergence contract passed: canonical routes and data owners remain intact; Desk, Chat, Requests, Tasks, Updates, Connect, Memory, Discover, and Work overview use one human-readable coordination model.');
