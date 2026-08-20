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
assert.ok(uiConvergence.includes("document.body.classList.contains('k-app-page')"), 'Shared UI convergence must know the canonical App shell to avoid duplicate workspace chrome.');
assert.ok(appShell.includes("if(document.body.classList.contains('workspace-page')){createTabBar();void createFeatureCompass();}"), 'Canonical app shell must retain mobile tab and feature compass behavior.');

console.log(JSON.stringify({ passed: true, checks: requiredSections.length + 10 }, null, 2));
