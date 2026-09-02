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

const requiredSections = ['desk','discover','requests','tasks','connect','points','top-up','subscriptions','checkout','confirmations','memory','notifications'];
for (const section of requiredSections) assert.ok(routes.includes(`['${section}',`), `Missing canonical implementation surface: ${section}`);
for (const marker of ['k-app-shell','k-app-sidebar','k-app-main','/chat']) assert.ok(app.includes(marker), `App view missing: ${marker}`);
for (const token of ['--k-cream','--k-primary','--k-font-body','--k-font-heading','--k-space-4','44px']) assert.ok(foundation.includes(token), `Visual system token missing: ${token}`);
for (const marker of ['k-app-quick-actions','k-app-quick-action','k-app-profile-link']) assert.ok(polish.includes(marker), `Polish style missing: ${marker}`);
for (const marker of ['normalizeLinks','activeNav','discoverShortcuts','renderDiscoverHub','MutationObserver']) assert.ok(polishJs.includes(marker), `Polish behavior missing: ${marker}`);
assert.ok(fcm.includes('/js/kurukoo-app-shell.js?v=1'), 'FCM/App boot path must load canonical app shell runtime.');
assert.ok(fcm.includes('/js/kurukoo-ui-convergence.js?v=1'), 'Shared UI convergence behavior must load in App.');
assert.ok(fcm.includes('/js/kurukoo-app-polish-v3.js?v=1'), 'Final App polish layer must load in App.');
assert.ok(fcm.includes('/js/kurukoo-os-dashboard.js?v=1'), 'Kurukoo OS dashboard layer must load in App.');
assert.ok(uiConvergence.includes("document.body.classList.contains('k-app-page')"), 'Shared UI convergence must know the canonical App shell.');
assert.ok(appShell.includes('createSecondaryNav'), 'Canonical app shell must retain compatibility secondary-nav composition.');
assert.ok(appShell.includes('createCollapseControl'), 'Canonical app shell must expose desktop navigation collapse.');
assert.ok(appShell.includes('wireMobileNav'), 'Canonical app shell must own mobile navigation controls.');
assert.ok(appShell.includes("label:'Home'"), 'Canonical app shell must use Home as the primary mobile destination.');
assert.ok(appShell.includes("label:'Explore'"), 'Canonical app shell must use Explore as the discovery destination.');
assert.ok(appShell.includes("label:'Activity'"), 'Canonical app shell must use Activity as the progress destination.');
assert.ok(!appShell.includes("href:'/desk'"), 'Canonical app shell must not present legacy Desk navigation.');
assert.ok(!appShell.includes("href:'/discover'"), 'Canonical app shell must not present legacy Discover navigation.');
assert.ok(!appShell.includes("href:'/requests'"), 'Canonical app shell must not present legacy Requests navigation.');
assert.ok(!appShell.includes("'kurukoo-page-architecture'"), 'Canonical app shell must not load internal page architecture UI.');
assert.ok(viewState.includes("home: '/home'"), 'Frontend view state must expose canonical Home routing.');
assert.ok(viewState.includes("explore: '/explore'"), 'Frontend view state must expose canonical Explore routing.');
assert.ok(viewState.includes("activity: '/activity'"), 'Frontend view state must expose canonical Activity routing.');
assert.ok(viewState.includes('const ROUTES'), 'Canonical frontend view state must expose route definitions.');
assert.ok(viewState.includes('const router'), 'Canonical frontend view state must expose navigation helpers.');
assert.ok(viewState.includes('history.pushState'), 'Frontend view state must integrate browser history.');
assert.ok(viewState.includes('kurukoo.last.view'), 'Frontend view state must preserve the last contextual view.');
assert.ok(facelift.includes('--kf-bg') && facelift.includes('.k-shell-collapsed'), 'Facelift system must define canonical shell tokens and collapsed state.');
assert.ok(controls.includes('.k-app-mobile-toggle') && controls.includes('.k-app-mobile-scrim'), 'Mobile shell controls must include accessible navigation affordances.');
for (const token of ['--os-bg','--os-surface','--os-accent','os-dashboard','os-dashboard-rail','os-today-flow','os-card-head']) assert.ok(osCss.includes(token), `OS architecture token/layout missing: ${token}`);
for (const token of ['Today’s flow','Continue conversation','Opportunity radar','Connected channels','Safety check-in','Activity summary','os-dashboard']) assert.ok(osDashboard.includes(token), `OS dashboard composition missing: ${token}`);

const sharedPartials = ['app-header','app-sidebar','app-mobile-nav','app-context-bridge','app-footer','app-page-header'];
for (const partial of sharedPartials) {
  assert.ok(fs.existsSync(path.join(root, 'views/_partials', `${partial}.ejs`)), `Shared authenticated partial missing: ${partial}.ejs`);
  assert.ok(app.includes(`include('_partials/${partial}'`), `App template must compose shared partial: ${partial}.ejs`);
}
assert.ok(!routes.includes('renderSharedPartial'), 'Route layer must not render shared UI components.');
assert.ok(!routes.includes('renderShell'), 'Route layer must not regex-replace shared UI components.');
assert.ok(read('public/css/kurukoo-app-ia.css').includes('.k-app-nav-fold'), 'Assistant-first IA styles must exist.');
assert.ok(!read('public/js/kurukoo-page-architecture.js').includes('data-kurukoo-page-architecture'), 'Internal page architecture must not be rendered to app users.');

console.log(JSON.stringify({ passed: true, checks: requiredSections.length + 42 }, null, 2));
