import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];

const app = read('views/app.ejs');
const shell = read('public/js/kurukoo-app-shell.js');
const routes = read('src/routes/appSurfaceRoutes.ts');

const canonicalSections = [
  'desk', 'chat', 'discover', 'topics', 'requests', 'reminders', 'saved', 'cart', 'tasks', 'connect', 'agents', 'capabilities', 'opportunities',
  'wallet', 'points', 'top-up', 'subscriptions', 'checkout', 'confirmations', 'memory', 'artifacts', 'prayer', 'call', 'notifications', 'safety', 'settings',
] as const;
for (const section of canonicalSections) {
  if (!routes.includes(`'/${section}'`)) failures.push(`Canonical direct route missing /${section}`);
}

const primary = [
  ['Desk', '/desk'], ['Agent', '/chat'], ['Requests', '/requests'], ['Tasks', '/tasks'], ['Discover', '/discover'],
] as const;
for (const [label, href] of primary) {
  if (!app.includes(`href="${href}"`)) failures.push(`Primary Web App navigation missing ${href}`);
  if (!shell.includes(`{label:'${label}',href:'${href}'`)) failures.push(`Responsive Web App navigation runtime missing ${href}`);
}

for (const href of ['/reminders', '/saved', '/cart']) {
  if (!app.includes(`href="${href}"`)) failures.push(`Secondary user workflow is not reachable at ${href}`);
}

if (routes.includes("'/app/")) failures.push('Canonical router retains a legacy /app route alias');
if (app.includes('href="/app/')) failures.push('Authenticated shell retains a legacy /app navigation target');
if (shell.includes('/app/')) failures.push('Shared app runtime retains a legacy /app handoff');
if (!app.includes('href="/chat"')) failures.push('Web App has no direct Agent recovery path');
if (!app.includes('class="k-mobile-tabbar"')) failures.push('Mobile Web App tab bar is missing');
if (!app.includes('k-reference-mobile-more')) failures.push('Mobile More/account navigation is missing from the shared shell');
if (shell.includes('k-feature-compass')) failures.push('Shared runtime retains the retired floating feature compass');
if (!shell.includes('kurukoo-product-os-revamp-runtime')) failures.push('Shared runtime does not mount the final product visual authority');

if (failures.length) {
  console.error('Web App screen-flow contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Web App screen-flow contract passed: ${canonicalSections.length} direct canonical surfaces, five primary destinations, mobile More/account navigation, and the final shared visual authority are present.`);
