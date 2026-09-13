/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];

const app = read('views/app.ejs');
const shell = read('frontend/public/js/kurukoo-app-shell.js');
const routes = read('src/routes/appSurfaceRoutes.ts');

const canonicalSections = [
  'agent','discover','topics','requests','reminders','saved','cart','tasks','connect','agents','capabilities','opportunities',
  'wallet','points','top-up','subscriptions','checkout','confirmations','memory','artifacts','prayer','call','notifications','safety'
];
for (const section of canonicalSections) {
  if (!routes.includes(`['${section}'`)) failures.push(`Canonical route missing /app/${section}`);
  if (!app.includes(`/app/${section}`) && !shell.includes(`/app/${section}`)) failures.push(`No Web App navigation/reference to /app/${section}`);
}

const primary = ['/app/agent','/app/discover','/app/requests','/app/tasks','/app/connect'];
for (const route of primary) if (!app.includes(`href="${route}"`)) failures.push(`Primary desktop navigation missing ${route}`);
for (const route of primary) if (!shell.includes(`href:'${route}'`)) failures.push(`Primary mobile navigation runtime missing ${route}`);

const secondary = ['/app/reminders','/app/saved','/app/cart'];
for (const route of secondary) if (!shell.includes(`href:'${route}'`)) failures.push(`Secondary navigation runtime missing ${route}`);
if (!shell.includes('createSecondaryNav')) failures.push('Desktop secondary Web App navigation is not mounted');

const legacyMap = [
  ['/discover','/app/discover'], ['/requests','/app/requests'], ['/tasks','/app/tasks'], ['/connect','/app/connect'],
  ['/cart','/app/cart'], ['/checkout','/app/checkout'], ['/confirmation','/app/confirmations'], ['/memory','/app/memory'],
  ['/safety','/app/safety'], ['/call','/app/call'], ['/points','/app/points'], ['/top-up','/app/top-up'],
  ['/subscription','/app/subscriptions'], ['/daily-picks','/app/discover'], ['/topics','/app/topics'],
] as const;
for (const [legacy, canonical] of legacyMap) {
  if (!shell.includes(`['${legacy}','${canonical}']`)) failures.push(`Legacy app handoff ${legacy} → ${canonical} missing`);
}

if (!shell.includes('normalizeAppLinks')) failures.push('Web App link-normalization flow is not mounted');
if (!app.includes('href="/chat"')) failures.push('Web App has no direct Chat recovery path');
if (!app.includes('href="/app/agent"')) failures.push('Web App has no Agent recovery path');
if (!app.includes('class="k-mobile-tabbar"')) failures.push('Mobile Web App tab bar is missing');
if (!shell.includes('k-feature-compass')) failures.push('Mobile secondary feature navigation is missing');
if (!shell.includes('k-app-secondary')) failures.push('Desktop secondary navigation grouping is missing');

if (failures.length) {
  console.error('Web App screen-flow contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Web App screen-flow contract passed: ${canonicalSections.length} canonical surfaces, five primary destinations, three persistent secondary destinations, legacy handoff normalization, mobile overflow navigation and Chat/Agent recovery paths present.`);
