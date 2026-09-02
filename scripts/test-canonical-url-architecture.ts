/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_URLS } from '../src/services/canonicalUrlRegistry.js';

const failures: string[] = [];
const require = (condition: boolean, message: string) => { if (!condition) failures.push(message); };

require(CANONICAL_URLS.experience.home === '/home', 'Home must be the canonical authenticated personal surface.');
require(CANONICAL_URLS.experience.explore === '/explore', 'Explore must be the canonical discovery surface.');
require(CANONICAL_URLS.experience.activity === '/activity', 'Activity must be the canonical work-progress surface.');
require(CANONICAL_URLS.experience.work === '/tasks', 'Work must retain /tasks as its canonical resource route.');
require(CANONICAL_URLS.conversation.agent === '/chat', 'Chat must use /chat as the conversational surface.');
require(CANONICAL_URLS.conversation.conversation('abc') === '/chat/abc', 'Conversation detail URL must be /chat/:conversationId.');
require(CANONICAL_URLS.conversation.share('abc') === '/share/abc', 'Shared conversation URL must be /share/:shareId.');
require(CANONICAL_URLS.desk.home === '/home', 'Desk namespace must resolve to the new Home route.');
require(CANONICAL_URLS.desk.discover === '/explore', 'Desk namespace discovery must resolve to the new Explore route.');
require(CANONICAL_URLS.desk.requests === '/activity', 'Desk namespace requests must resolve to the new Activity route.');
require(CANONICAL_URLS.desk.request('REQ-123') === '/requests/REQ-123', 'Request detail URL must remain resource-oriented.');
require(CANONICAL_URLS.desk.task('TASK-123') === '/tasks/TASK-123', 'Task detail URL must remain /tasks/:id.');
require(CANONICAL_URLS.desk.opportunity('OPP-123') === '/opportunities/OPP-123', 'Opportunity detail URL must remain /opportunities/:id.');
require(CANONICAL_URLS.admin.user('USR-123') === '/admin/users/USR-123', 'Admin user detail URL must be /admin/users/:id.');
require(CANONICAL_URLS.public.features === '/features', 'Features must have a public product URL.');
require(CANONICAL_URLS.public.developers === '/developers', 'Developers must have a public product URL.');
require(CANONICAL_URLS.api.root === '/api/v1', 'API must have a versioned root.');

for (const route of [...Object.values(CANONICAL_URLS.desk), ...Object.values(CANONICAL_URLS.conversation), ...Object.values(CANONICAL_URLS.experience)]) {
  if (typeof route === 'string') require(!route.startsWith('/app/'), `Canonical web URL must not use /app/: ${route}`);
}

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const appSurfaceRoutes = read('src/routes/appSurfaceRoutes.ts');
require(!appSurfaceRoutes.includes('res.redirect(308'), 'Authenticated app-surface routes must be wired directly, not via legacy compatibility redirects.');
require(!appSurfaceRoutes.includes("'/app'"), 'Authenticated app-surface routes must not retain the legacy /app alias.');
for (const route of ["'/home': 'desk'", "'/explore': 'discover'", "'/activity': 'requests'"]) require(appSurfaceRoutes.includes(route), `App surface routes must include ${route}.`);
for (const relative of [
  'public/js/kurukoo-app-shell.js',
  'public/js/kurukoo-app-convergence.js',
  'public/js/kurukoo-desk-live-hydration.js',
  'public/js/kurukoo-desk-system.js',
  'public/js/kurukoo-os-live-hydration.js',
  'public/js/kurukoo-os-polish-final.js',
  'public/js/site-navigation.js',
  'public/js/fcm-client.js',
  'public/firebase-messaging-sw.js',
]) require(!read(relative).includes('/app/'), `Live navigation owner retains a legacy /app route: ${relative}`);

const sharedPartials = [
  'views/_partials/app-header.ejs',
  'views/_partials/app-sidebar.ejs',
  'views/_partials/app-mobile-nav.ejs',
  'views/_partials/app-context-bridge.ejs',
  'views/_partials/app-footer.ejs',
];
for (const relative of sharedPartials) require(fs.existsSync(path.join(root, relative)), `Reusable app component is missing: ${relative}`);
require(appSurfaceRoutes.includes("renderSharedPartial('app-header.ejs'"), 'App renderer must compose the shared header partial.');
require(appSurfaceRoutes.includes("renderSharedPartial('app-sidebar.ejs'"), 'App renderer must compose the shared sidebar partial.');
require(appSurfaceRoutes.includes("renderSharedPartial('app-mobile-nav.ejs'"), 'App renderer must compose the shared mobile navigation partial.');
require(appSurfaceRoutes.includes("renderSharedPartial('app-context-bridge.ejs'"), 'App renderer must compose the shared continuity bridge.');
require(appSurfaceRoutes.includes("renderSharedPartial('app-footer.ejs'"), 'App renderer must compose the shared footer partial.');
require(!read('public/js/kurukoo-page-architecture.js').includes('data-kurukoo-page-architecture'), 'Internal page architecture must not be rendered into the user-facing app.');

require(CANONICAL_URLS.admin.home === '/admin', 'Admin must use /admin as its canonical root.');
require(!CANONICAL_URLS.admin.users.endsWith('.html'), 'Admin canonical URLs must not expose implementation filenames.');

if (failures.length) {
  console.error('Canonical URL architecture test failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Canonical URL architecture test passed: assistant-first Home/Explore/Activity IA, reusable app composition, resource URLs, and cross-client boundaries are aligned.');
