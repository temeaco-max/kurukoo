/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('views/app.ejs');
const routes = read('src/routes/appSurfaceRoutes.ts');
const foundation = read('public/css/kurukoo-client-foundation.css');
const polish = read('public/css/kurukoo-app-polish-v2.css');
const polishJs = read('public/js/kurukoo-app-polish-v3.js');
const fcm = read('public/js/fcm-client.js');
const uiConvergence = read('public/js/kurukoo-ui-convergence.js');
const appShell = read('public/js/kurukoo-app-shell.js');
const viewState = read('public/js/kurukoo-view-state.js');
const facelift = read('public/css/kurukoo-facelift.css');
const controls = read('public/css/kurukoo-facelift-controls.css');
const osCss = read('public/css/kurukoo-os-architecture.css');
const osDashboard = read('public/js/kurukoo-os-dashboard.js');
const publicHead = read('views/_partials/head.ejs');
const chat = read('public/chat/index.html');
const workspace = read('views/workspace.ejs');

const requiredSections = ['agent','discover','requests','tasks','connect','points','top-up','subscriptions','checkout','confirmations','memory','notifications'];
for (const section of requiredSections) assert.ok(routes.includes(`['${section}',`), `Missing canonical surface-map section: ${section}`);
assert.ok(routes.includes("for (const section of surfaceMap.keys()) router.get(`/app/${section}`"), 'Canonical App route loop is missing.');
for (const marker of ['k-app-shell','k-app-sidebar','k-app-main','k-mobile-tabbar','kurukoo-client-foundation.css','/chat']) assert.ok(app.includes(marker), `App view missing: ${marker}`);
for (const token of ['--k-cream','--k-primary','--k-font-body','--k-font-heading','--k-space-4','44px']) assert.ok(foundation.includes(token), `Visual system token missing: ${token}`);
for (const marker of ['k-app-quick-actions','k-app-quick-action','k-app-profile-link']) assert.ok(polish.includes(marker), `Polish style missing: ${marker}`);
for (const marker of ['normalizeLinks','activeNav','discoverShortcuts','renderDiscoverHub','MutationObserver','/app/discover']) assert.ok(polishJs.includes(marker), `Polish behavior missing: ${marker}`);
assert.ok(fcm.includes('/js/kurukoo-app-shell.js?v=1'), 'FCM/App boot path must load canonical app shell runtime.');
assert.ok(fcm.includes('/js/kurukoo-ui-convergence.js?v=1'), 'Shared UI convergence behavior must load in App.');
assert.ok(fcm.includes('/js/kurukoo-app-polish-v3.js?v=1'), 'Final App polish layer must load in App.');
assert.ok(fcm.includes('/js/kurukoo-os-dashboard.js?v=1'), 'Kurukoo OS dashboard layer must load in App.');
assert.ok(uiConvergence.includes("document.body.classList.contains('k-app-page')"), 'Shared UI convergence must know the canonical App shell to avoid duplicate workspace chrome.');
assert.ok(appShell.includes('createSecondaryNav'), 'Canonical app shell must own secondary navigation composition.');
assert.ok(appShell.includes('createCollapseControl'), 'Canonical app shell must expose desktop navigation collapse.');
assert.ok(appShell.includes('wireMobileNav'), 'Canonical app shell must own mobile navigation controls.');
assert.ok(appShell.includes('createTabBar();void createFeatureCompass();'), 'Canonical app shell must retain mobile tab and feature compass behavior.');
assert.ok(viewState.includes("agent: '/chat'"), 'Canonical frontend view state must map Chat to the Agent view.');
assert.ok(viewState.includes('const ROUTES'), 'Canonical frontend view state must expose route definitions.');
assert.ok(viewState.includes('const router'), 'Canonical frontend view state must expose navigation helpers.');
assert.ok(viewState.includes('history.pushState'), 'Frontend view state must integrate browser history.');
assert.ok(viewState.includes('kurukoo.last.view'), 'Frontend view state must preserve the last contextual view.');
assert.ok(facelift.includes('--kf-bg') && facelift.includes('.k-shell-collapsed'), 'Facelift system must define canonical shell tokens and collapsed state.');
assert.ok(controls.includes('.k-app-mobile-toggle') && controls.includes('.k-app-mobile-scrim'), 'Mobile shell controls must include accessible navigation affordances.');
for (const token of ['--os-bg','--os-surface','--os-accent','os-dashboard','os-dashboard-rail','os-today-flow','os-card-head']) assert.ok(osCss.includes(token), `OS architecture token/layout missing: ${token}`);
for (const token of ['Today’s flow','Continue conversation','Opportunity radar','Connected channels','Safety check-in','Activity summary','os-dashboard']) assert.ok(osDashboard.includes(token), `OS dashboard composition missing: ${token}`);
assert.ok(publicHead.includes('/css/kurukoo-os-architecture.css?v=1'), 'Public pages must load the shared OS architecture stylesheet.');
assert.ok(chat.includes('kurukoo-os-architecture.css'), 'Chat must load the shared OS architecture stylesheet.');
assert.ok(workspace.includes('kurukoo-os-architecture.css'), 'Workspace/backend shell must load the shared OS architecture stylesheet.');

console.log(JSON.stringify({ passed: true, checks: requiredSections.length + 31 }, null, 2));
