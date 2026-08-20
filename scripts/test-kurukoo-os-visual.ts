import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const css = read('public/css/kurukoo-os-architecture.css');
const publicCss = read('public/css/kurukoo-os-public-surface.css');
const headerCss = read('public/css/kurukoo-os-header.css');
const dashboard = read('public/js/kurukoo-os-dashboard.js');
const finalPolish = read('public/js/kurukoo-os-polish-final.js');
const fcm = read('public/js/fcm-client.js');
const nav = read('public/js/site-navigation.js');
const app = read('views/app.ejs');
const workspace = read('views/workspace.ejs');
const chat = read('public/chat/index.html');
const head = read('views/_partials/head.ejs');
const doc = read('docs/design/KURUKOO_OS_VISUAL_ARCHITECTURE.md');

for (const token of [
  '--os-bg','--os-surface','--os-ink','--os-muted','--os-border','--os-accent',
  '.os-dashboard','.os-dashboard-rail','.os-today-flow','.os-grid-3','.os-grid-2',
  '.os-pulse-line','.os-safety','.os-activity-bars','.os-app-command'
]) assert.ok(css.includes(token), `OS visual token missing: ${token}`);
for (const token of ['home-page','.home-chat-card','.home-role-path','.storefront-demo','.home-daily-picks','.public-legal-content','.public-doc-shell']) assert.ok(publicCss.includes(token), `Public OS surface missing: ${token}`);
for (const token of ['.os-header-notify','.os-profile','.os-profile-avatar']) assert.ok(headerCss.includes(token), `Header surface missing: ${token}`);
for (const token of ['Today’s flow','Continue conversation','Active requests','Tasks &amp; reminders','Opportunity radar','Points','Topics for you','Guide &amp; how-to','Connected channels','Pulse','Safety check-in','Activity summary']) assert.ok(dashboard.includes(token), `Dashboard composition missing: ${token}`);
for (const token of ['Kurukoo OS','Promotion slot','Ready']) assert.ok(finalPolish.includes(token), `Truthful polish missing: ${token}`);
for (const token of ['kurukoo-os-dashboard.js','kurukoo-os-polish-final.js']) assert.ok(fcm.includes(token), `App boot missing: ${token}`);
assert.ok(nav.includes('kurukoo-os-public-surface.css'), 'Public nav bootstrap must load the OS public surface stylesheet.');
assert.ok(app.includes('k-app-shell') && app.includes('k-app-sidebar') && app.includes('k-app-main'), 'Canonical App shell missing.');
assert.ok(workspace.includes('workspace-shell'), 'Legacy workspace compatibility shell missing.');
assert.ok(chat.includes('chat-shell') && chat.includes('kurukoo-os-architecture.css'), 'Chat must inherit the OS visual architecture.');
assert.ok(head.includes('kurukoo-os-architecture.css'), 'Shared EJS head must load the OS architecture.');
for (const marker of ['Reference','Authenticated OS','Chat','Discover','Public/marketing','Admin','Visual primitives','Product weaving']) assert.ok(doc.includes(marker), `Visual architecture document missing: ${marker}`);

console.log(JSON.stringify({ passed: true, shell: 'kurukoo-os', checked: 31 }, null, 2));
