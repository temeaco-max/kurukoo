import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures: string[] = [];
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(root, file));

for (const relative of ['public/admin/index.html', 'public/admin/ai-agents.html']) {
  const source = read(relative);
  if (!source.includes('/admin/admin-auth.js')) failures.push(`${relative} does not load canonical admin-auth.js`);
  if (!source.includes('admin-os') && !source.includes('/css/admin-pages/admin-base.css')) failures.push(`${relative} is missing its Admin visual shell marker`);
}

const publicNav = read('views/_partials/nav.ejs');
const publicHead = read('views/_partials/head.ejs');
if (!publicNav.includes('/chat')) failures.push('Public navigation has no Agent entry');
if (!publicNav.includes('/explore')) failures.push('Public navigation has no Explore entry');
if (!publicNav.includes('Try Kurukoo free')) failures.push('Public navigation lacks the low-commitment product entry');
if (!publicHead.includes('/css/kurukoo-visual-completion.css')) failures.push('Shared public head is missing its public visual completion authority');

const appShell = read('views/app.ejs');
if (!appShell.includes('k-reference-sidebar')) failures.push('Authenticated desktop reference sidebar is missing');
if (!appShell.includes('id="new-chat"')) failures.push('Authenticated desktop New conversation action is missing');
if (!appShell.includes('k-reference-account-menu')) failures.push('Authenticated desktop account configuration menu is missing');
if (!appShell.includes('k-mobile-tabbar')) failures.push('Authenticated responsive navigation is missing');

const appRuntime = read('public/js/kurukoo-app-shell.js');
for (const marker of ['kurukoo-product-os-revamp-runtime', 'createTabBar', 'wireExploreSearch']) {
  if (!appRuntime.includes(marker)) failures.push(`Authenticated runtime missing ${marker}`);
}
if (appRuntime.includes('k-feature-compass')) failures.push('Authenticated runtime retains the retired floating feature compass');

const flow = read('scripts/test-desktop-screen-flow.ts');
if (!flow.includes('Control Room')) failures.push('Desktop flow contract does not cover Admin Control Room');

for (const requiredFile of [
  'public/css/kurukoo-visual-completion.css',
  'public/css/kurukoo-product-os-revamp.css',
  'public/css/admin-pages/admin-convergence-shell.css',
  'public/js/kurukoo-app-shell.js',
  'public/admin/admin-auth.js',
]) if (!exists(requiredFile)) failures.push(`Missing shared desktop visual/flow authority ${requiredFile}`);

if (failures.length) {
  console.error('Desktop surface integrity failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Desktop surface integrity passed: active operational admin screens, public CTA hierarchy, authenticated reference shell, responsive navigation, and final runtime authority are present.');
