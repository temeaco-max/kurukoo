import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('views/app.ejs');
const routes = read('src/routes/appSurfaceRoutes.ts');
const foundation = read('public/css/kurukoo-client-foundation.css');
const revamp = read('public/css/kurukoo-product-os-revamp.css');
const fcm = read('public/js/fcm-client.js');
const appShell = read('public/js/kurukoo-app-shell.js');
const workspaceRuntime = read('public/js/kurukoo-workspace.js');
const chat = read('views/partials/chat-workspace.ejs');

const requiredSections = ['chat','discover','requests','tasks','connect','points','top-up','subscriptions','checkout','confirmations','memory','notifications'];
for (const section of requiredSections) assert.ok(routes.includes(`['${section}',`), `Missing canonical surface-map section: ${section}`);

for (const marker of ['k-reference-shell','k-reference-app-header','k-reference-sidebar','k-app-main','k-mobile-tabbar','k-settings-hub','/chat']) {
  assert.ok(app.includes(marker), `Reference App view missing: ${marker}`);
}
for (const token of ['--k-cream','--k-primary','--k-font-body','--k-font-heading','--k-space-4','44px']) {
  assert.ok(foundation.includes(token), `Visual system token missing: ${token}`);
}
for (const marker of ['grid-template-columns: 224px minmax(0, 1fr) 304px','k-reference-mobile-more-sheet','k-settings-card','k-settings-notification-optin','@media (max-width: 767px)']) {
  assert.ok(revamp.includes(marker), `Reference visual authority missing: ${marker}`);
}

assert.ok(fcm.includes('k-settings-notification-optin'), 'Notification opt-in must mount from Settings preferences.');
assert.doesNotMatch(fcm, /document\.querySelector\('\.k-app-header-actions'\)/, 'Notification opt-in must not occupy the global header.');
assert.ok(appShell.includes("document.querySelector('.k-reference-shell')"), 'Focused reference shell must suppress the inherited feature launcher.');
assert.ok(workspaceRuntime.includes('referenceMobileMore'), 'Shared workspace runtime must own the mobile More sheet.');
assert.ok(chat.includes('id="message-input"'), 'Shared Agent partial must retain its canonical composer.');
assert.ok(chat.includes('id="chat-inspector"'), 'Shared Agent partial must retain integrated context inspection.');

console.log(JSON.stringify({ passed: true, checks: requiredSections.length + 20 }, null, 2));
