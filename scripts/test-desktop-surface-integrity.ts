/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures: string[] = [];
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(root, file));

const adminDir = path.join(root, 'admin');
const adminFiles = fs.readdirSync(adminDir).filter((file) => file.endsWith('.html') && file !== 'login.html');
for (const file of adminFiles) {
  const relative = `admin/${file}`;
  const source = read(relative);
  if (!source.includes('/admin/admin-auth.js')) failures.push(`${relative} does not load canonical admin-auth.js`);
  if (!source.includes('admin-os') && !source.includes('/css/admin-pages/admin-base.css')) failures.push(`${relative} is missing Admin visual shell markers`);
}

const publicNav = read('views/_partials/nav.ejs');
const publicHead = read('views/_partials/head.ejs');
if (!publicNav.includes('/chat')) failures.push('Public navigation has no Chat entry');
if (!publicNav.includes('/explore')) failures.push('Public navigation has no Explore entry');
if (!publicHead.includes('site-navigation.js')) failures.push('Public navigation runtime is not loaded by shared head');

const appShell = read('views/app.ejs');
const appSidebar = read('views/_partials/app-sidebar.ejs');
const appHeader = read('views/_partials/app-header.ejs');
const appMobileNav = read('views/_partials/app-mobile-nav.ejs');
if (!appShell.includes("include('_partials/app-sidebar'")) failures.push('Authenticated desktop sidebar is not owned by the shared shell');
if (!appSidebar.includes('k-app-sidebar')) failures.push('Authenticated desktop sidebar is missing');
if (!appHeader.includes('k-app-ask')) failures.push('Authenticated desktop Ask recovery is missing');
if (!appMobileNav.includes('k-mobile-tabbar')) failures.push('Authenticated responsive navigation is missing');

const appRuntime = read('frontend/public/js/kurukoo-app-shell.js');
for (const marker of ['normalizeAppLinks','kurukoo-webapp-pixel-refinement','kurukoo-webapp-screen-refinement']) {
  if (!appRuntime.includes(marker)) failures.push(`Authenticated runtime missing ${marker}`);
}

const flow = read('scripts/test-desktop-screen-flow.ts');
if (!flow.includes('Control Room')) failures.push('Desktop flow contract does not cover Admin Control Room');
if (!flow.includes('Open Web App')) failures.push('Desktop flow contract does not cover Admin → Web App bridge');

for (const requiredFile of [
  'frontend/public/css/kurukoo-visual-completion.css',
  'frontend/public/css/kurukoo-webapp-pixel-refinement.css',
  'frontend/public/css/kurukoo-webapp-screen-refinement.css',
  'frontend/public/css/admin-pages/admin-convergence-shell.css',
  'frontend/public/js/site-navigation.js',
  'frontend/public/js/kurukoo-app-shell.js',
  'admin/admin-auth.js',
]) if (!exists(requiredFile)) failures.push(`Missing shared desktop visual/flow authority ${requiredFile}`);

if (failures.length) {
  console.error('Desktop surface integrity failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Desktop surface integrity passed: ${adminFiles.length} Admin HTML surfaces, shared public shell, authenticated Web App shell, and canonical runtime authorities are present.`);
