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

for (const route of ['/app/agent','/app/discover','/app/requests','/app/tasks','/app/connect','/app/points','/app/top-up','/app/subscriptions','/app/checkout','/app/confirmations','/app/memory','/app/notifications']) {
  assert.ok(routes.includes(`router.get('${route}'`) || routes.includes(`['${route.replace('/app/','')}'])`), `Missing canonical app route: ${route}`);
}
for (const marker of ['k-app-shell','k-app-sidebar','k-app-main','k-mobile-tabbar','kurukoo-client-foundation.css','/chat']) assert.ok(app.includes(marker), `App view missing: ${marker}`);
for (const token of ['--k-cream','--k-primary','--k-font-body','--k-font-heading','--k-space-4','44px']) assert.ok(foundation.includes(token), `Visual system token missing: ${token}`);
for (const marker of ['k-app-quick-actions','k-app-quick-action','k-app-profile-link']) assert.ok(polish.includes(marker), `Polish style missing: ${marker}`);
for (const marker of ['normalizeLinks','activeNav','addDiscoverQuickActions','MutationObserver','/app/discover']) assert.ok(polishJs.includes(marker), `Polish behavior missing: ${marker}`);
assert.ok(fcm.includes('/js/kurukoo-app-polish-v3.js?v=1'), 'FCM/App boot path must load final app polish layer.');

console.log(JSON.stringify({ passed: true, checks: 6 }, null, 2));
