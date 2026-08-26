import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const desk = read('public/js/kurukoo-desk-system.js');
const style = read('public/css/kurukoo-desk-system.css');
const extensions = read('public/js/kurukoo-app-extensions.js');
const bridge = read('src/middleware/apiV1Bridge.ts');
const nativeIntent = read('mobile/kurukoo-mobile/app/+native-intent.tsx');

for (const token of ["href:'/chat'", "href:'/requests'", "href:'/tasks'", "href:'/connect'"]) {
  assert.ok(desk.includes(token), `Desk direct canonical URL is missing: ${token}`);
}
for (const legacy of ['/app/agent', '/app/requests', '/app/tasks', '/app/connect']) {
  assert.ok(!desk.includes(legacy), `Desk must not retain legacy workspace alias ${legacy}`);
}
for (const token of ['kurukoo-drawer-search', 'kurukoo-drawer-notifications', 'kurukoo-drawer-profile', 'k-desk-icon-button', 'Search Kurukoo', 'Ask Agent']) {
  assert.ok(desk.includes(token), `Desk shell capability missing: ${token}`);
}
for (const token of ['k-desk-drawer', 'k-desk-search-result', 'k-desk-notification', 'k-desk-profile-card', 'k-desk-drawer-backdrop']) {
  assert.ok(style.includes(token), `Desk visual primitive missing: ${token}`);
}
assert.ok(extensions.includes('/js/kurukoo-desk-system.js?v=1'), 'Desk system runtime is not mounted by the authenticated app extension loader.');
assert.ok(extensions.includes('/css/kurukoo-desk-system.css?v=1'), 'Desk system stylesheet is not mounted by the authenticated app extension loader.');
assert.ok(bridge.includes('X-Kurukoo-Api-Version'), 'Versioned API bridge must advertise API version.');
assert.ok(nativeIntent.includes("/^\\/requests\\//"), 'Native intent resolver must map canonical Request resources.');
assert.ok(nativeIntent.includes("/^\\/chat\\//"), 'Native intent resolver must map canonical conversation resources.');

console.log('Desk system contract passed: direct canonical URLs, search/notification/account drawers, authenticated mounting, API version boundary and native resource mapping are present.');
