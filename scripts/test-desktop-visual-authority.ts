/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];
const require = (condition: boolean, message: string) => { if (!condition) failures.push(message); };

const desktopCss = read('frontend/public/css/kurukoo-desktop-final.css');
require(desktopCss.includes('@media (min-width: 993px)'), 'Desktop visual authority must be desktop-only scoped');
require(desktopCss.includes('.k-app-sidebar'), 'Desktop visual authority must refine authenticated sidebar');
require(desktopCss.includes('.k-app-title-row'), 'Desktop visual authority must refine authenticated title hierarchy');
require(desktopCss.includes('.kurukoo-admin-convergence-bar'), 'Desktop visual authority must refine Admin shell');
require(desktopCss.includes('.navbar'), 'Desktop visual authority must refine public navigation');
require(desktopCss.includes('[data-state="pending"]'), 'Desktop visual authority must preserve shared semantic state language');

const publicHead = read('views/_partials/head.ejs');
const appHead = read('views/app.ejs');
const publicRuntime = read('frontend/public/js/site-navigation.js');
const appRuntime = read('frontend/public/js/kurukoo-app-shell.js');
const adminRuntime = read('admin/admin-auth.js');

require(publicHead.includes('/css/kurukoo-desktop-final.css?v=1'), 'Public canonical head must load desktop final visual authority');
require(appHead.includes('/css/kurukoo-desktop-final.css?v=1'), 'Authenticated Web App canonical head must load desktop final visual authority');
require(publicRuntime.includes('/css/kurukoo-desktop-final.css?v=1'), 'Public runtime must preserve desktop visual loading path');
require(appRuntime.includes('/css/kurukoo-desktop-final.css?v=1'), 'Authenticated runtime must load desktop final visual authority');
require(adminRuntime.includes('/css/kurukoo-desktop-final.css?v=1'), 'Admin runtime must load desktop final visual authority');

require(!desktopCss.includes('@media(max-width'), 'Desktop visual authority must not introduce mobile breakpoints');
require(!desktopCss.includes('@media (max-width'), 'Desktop visual authority must not introduce mobile breakpoints');

if (failures.length) {
  console.error('Desktop visual authority contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Desktop visual authority contract passed: public, authenticated Web App and Admin share one desktop-only visual authority with no mobile rules.');
