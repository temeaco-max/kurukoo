/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];

const app = read('views/app.ejs');
const shell = read('public/js/kurukoo-app-shell.js');
const routes = read('src/routes/appSurfaceRoutes.ts');

const primary = [
  ['/chat', 'Chat'], ['/home', 'Home'], ['/explore', 'Explore'], ['/activity', 'Activity'], ['/tasks', 'Work'],
] as const;
for (const [route, label] of primary) {
  if (!routes.includes(`'${route}'`)) failures.push(`Canonical route missing ${route}`);
  if (!shell.includes(`href:'${route}'`) && !shell.includes(`href="${route}"`) && !routes.includes(`href="${route}"`)) failures.push(`Canonical navigation does not reference ${route}`);
  if (!app.includes('k-app-shell')) failures.push('Authenticated app shell is not rendered through the canonical app view.');
  void label;
}

const supporting = ['/reminders','/saved','/notifications','/memory','/topics','/opportunities','/capabilities','/agents','/wallet','/points','/subscriptions','/cart','/connect','/settings','/help'];
for (const route of supporting) if (!routes.includes(`'${route}'`)) failures.push(`Supporting route missing ${route}`);

for (const partial of ['app-header.ejs','app-sidebar.ejs','app-mobile-nav.ejs','app-context-bridge.ejs','app-footer.ejs']) {
  if (!fs.existsSync(path.join(root, 'views', '_partials', partial))) failures.push(`Shared authenticated component missing ${partial}`);
  if (!routes.includes(`renderSharedPartial('${partial}'`)) failures.push(`Shared authenticated component is not composed: ${partial}`);
}

for (const legacyRoute of ['/desk','/discover','/requests']) {
  if (!routes.includes(`'${legacyRoute}'`)) failures.push(`Compatibility route missing ${legacyRoute}`);
}
if (!routes.includes("'/home': 'desk'")) failures.push('Home must resolve to the existing Desk implementation section until that runtime is renamed internally.');
if (!routes.includes("'/explore': 'discover'")) failures.push('Explore must resolve to the existing discovery implementation section until that runtime is renamed internally.');
if (!routes.includes("'/activity': 'requests'")) failures.push('Activity must resolve to the existing request implementation section until that runtime is renamed internally.');

if (!shell.includes("label:'Home'")) failures.push('Shared mobile shell no longer uses the assistant-first Home label.');
if (!shell.includes("label:'Explore'")) failures.push('Shared mobile shell no longer uses the assistant-first Explore label.');
if (!shell.includes("label:'Activity'")) failures.push('Shared mobile shell no longer uses the assistant-first Activity label.');
if (!shell.includes('createCollapseControl')) failures.push('Desktop navigation collapse control is not mounted.');
if (!shell.includes('wireMobileNav')) failures.push('Mobile navigation controls are not mounted.');
if (!shell.includes('createFeatureCompass')) failures.push('Secondary capability discovery remains unavailable.');
if (!app.includes('href="/chat"')) failures.push('Authenticated app view has no direct Chat recovery path.');
if (!shell.includes("'/css/kurukoo-facelift.css?v=1'")) failures.push('Authenticated shell does not load the facelift foundation.');
if (shell.includes("'kurukoo-page-architecture'")) failures.push('Authenticated shell still loads the internal page architecture UI.');

if (failures.length) {
  console.error('Web App screen-flow contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Web App screen-flow contract passed: assistant-first primary navigation, grouped supporting surfaces, shared authenticated components, legacy route compatibility and Chat recovery are aligned.`);
