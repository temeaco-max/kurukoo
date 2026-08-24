import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_URLS } from '../src/services/canonicalUrlRegistry.js';

const root = process.cwd();
const failures: string[] = [];
const require = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('src/index.ts');
const apiBridge = read('src/middleware/apiV1Bridge.ts');
const nativeIntent = read('mobile/kurukoo-mobile/app/+native-intent.tsx');
const appConfig = read('mobile/kurukoo-mobile/app.config.ts');
const deskSystem = read('public/js/kurukoo-desk-system.js');
const deskLiveHydration = read('public/js/kurukoo-desk-live-hydration.js');
const osLiveHydration = read('public/js/kurukoo-os-live-hydration.js');
const deskStyle = read('public/css/kurukoo-desk-system.css');
const appExtensions = read('public/js/kurukoo-app-extensions.js');

require(CANONICAL_URLS.desk.home === '/desk', 'Desk canonical URL must remain /desk.');
require(CANONICAL_URLS.conversation.agent === '/chat', 'Agent canonical URL must remain /chat.');
require(CANONICAL_URLS.conversation.conversation('conversation-1') === '/chat/conversation-1', 'Conversation URL builder must remain stable.');
require(CANONICAL_URLS.conversation.share('share-1') === '/share/share-1', 'Share URL builder must remain stable.');
require(CANONICAL_URLS.desk.request('request-1') === '/requests/request-1', 'Request detail URL must remain resource-oriented.');
require(CANONICAL_URLS.admin.user('user-1') === '/admin/users/user-1', 'Admin detail URL must remain resource-oriented.');
require(CANONICAL_URLS.api.root === '/api/v1', 'API canonical root must remain versioned.');

require(index.includes("import { apiV1Bridge } from './middleware/apiV1Bridge.js';"), 'Server must import the API v1 bridge.');
require(index.includes("app.use('/api/v1',apiV1Bridge);"), 'Server must mount the API v1 bridge before legacy /api routers.');
require(apiBridge.includes('X-Kurukoo-Api-Version') && apiBridge.includes('req.url = `/api${'), 'API v1 bridge must translate /api/v1 into the existing service-router namespace.');

require(nativeIntent.includes("'/desk': '/(tabs)'"), 'Native intent must map Desk to the native home surface.');
require(nativeIntent.includes("'/chat': '/(tabs)'"), 'Native intent must map Agent/Chat to the native conversation surface.');
require(nativeIntent.includes("/^\\/requests\\//"), 'Native intent must map request detail URLs.');
require(nativeIntent.includes("/^\\/tasks\\//"), 'Native intent must map task detail URLs.');
require(nativeIntent.includes("/^\\/connections\\//"), 'Native intent must map connection detail URLs.');

require(appConfig.includes('KURUKOO_PUBLIC_BASE_URL'), 'Native build config must read the canonical public base URL.');
require(appConfig.includes('associatedDomains'), 'iOS Universal Links must be configurable from the canonical HTTPS origin.');
require(appConfig.includes('scheme: "https"') && appConfig.includes('publicHost'), 'Android App Links must be configurable from the canonical HTTPS origin.');

require(deskSystem.includes("'/app/agent': '/chat'"), 'Authenticated web runtime must canonicalize Agent to /chat.');
require(!deskSystem.includes("'/app/agent': '/desk'"), 'Desk system must not canonicalize Agent to Desk.');
require(deskLiveHydration.includes("'/app/agent': '/chat'"), 'Desk live hydration must canonicalize Agent to /chat.');
require(!deskLiveHydration.includes("'/app/agent': '/desk'"), 'Desk live hydration must not canonicalize Agent to Desk.');
require(osLiveHydration.includes("'/app/agent': '/chat'"), 'OS live hydration must canonicalize Agent to /chat.');
require(!osLiveHydration.includes("'/app/agent': '/desk'"), 'OS live hydration must not canonicalize Agent to Desk.');
require(deskSystem.includes("'/app/requests': '/requests'"), 'Authenticated web runtime must canonicalize Requests.');
require(deskSystem.includes("'kurukoo-drawer-search'"), 'Desk search drawer must remain mounted.');
require(deskSystem.includes("'kurukoo-drawer-notifications'"), 'Desk notifications drawer must remain mounted.');
require(deskSystem.includes("'kurukoo-drawer-profile'"), 'Desk account drawer must remain mounted.');
require(deskStyle.includes('.k-desk-drawer') && deskStyle.includes('.k-desk-search-result'), 'Desk drawer visual primitives must remain available.');
require(appExtensions.includes('/js/kurukoo-desk-system.js?v=1'), 'Authenticated extension loader must mount the Desk system.');

if (failures.length) {
  console.error('Cross-client routing contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Cross-client routing contract passed: canonical Agent/Chat aliasing, Web routes, Desk system drawers, live hydration, /api/v1 bridge, native deep links, and HTTPS app-link configuration are aligned.');
