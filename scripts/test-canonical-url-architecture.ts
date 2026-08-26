import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_URLS } from '../src/services/canonicalUrlRegistry.js';

const failures: string[] = [];
const require = (condition: boolean, message: string) => { if (!condition) failures.push(message); };

require(CANONICAL_URLS.desk.home === '/desk', 'Desk must be the canonical authenticated home.');
require(CANONICAL_URLS.conversation.agent === '/chat', 'Agent must use /chat as the conversational surface.');
require(CANONICAL_URLS.conversation.conversation('abc') === '/chat/abc', 'Conversation detail URL must be /chat/:conversationId.');
require(CANONICAL_URLS.conversation.share('abc') === '/share/abc', 'Shared conversation URL must be /share/:shareId.');
require(CANONICAL_URLS.desk.request('REQ-123') === '/requests/REQ-123', 'Request detail URL must be /requests/:id.');
require(CANONICAL_URLS.desk.task('TASK-123') === '/tasks/TASK-123', 'Task detail URL must be /tasks/:id.');
require(CANONICAL_URLS.desk.opportunity('OPP-123') === '/opportunities/OPP-123', 'Opportunity detail URL must be /opportunities/:id.');
require(CANONICAL_URLS.admin.user('USR-123') === '/admin/users/USR-123', 'Admin user detail URL must be /admin/users/:id.');
require(CANONICAL_URLS.public.features === '/features', 'Features must have a public product URL.');
require(CANONICAL_URLS.public.developers === '/developers', 'Developers must have a public product URL.');
require(CANONICAL_URLS.api.root === '/api/v1', 'API must have a versioned root.');


for (const route of [...Object.values(CANONICAL_URLS.desk), ...Object.values(CANONICAL_URLS.conversation)]) {
  if (typeof route === 'string') require(!route.startsWith('/app/'), `Canonical web URL must not use /app/: ${route}`);
}

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const appSurfaceRoutes = read('src/routes/appSurfaceRoutes.ts');
require(!appSurfaceRoutes.includes('res.redirect(308'), 'Authenticated app-surface routes must be wired directly, not via legacy compatibility redirects.');
require(!appSurfaceRoutes.includes("'/app'"), 'Authenticated app-surface routes must not retain the legacy /app alias.');
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

require(CANONICAL_URLS.admin.home === '/admin', 'Admin must use /admin as its canonical root.');
require(!CANONICAL_URLS.admin.users.endsWith('.html'), 'Admin canonical URLs must not expose implementation filenames.');

if (failures.length) {
  console.error('Canonical URL architecture test failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Canonical URL architecture test passed.');
