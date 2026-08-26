import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');
const app = read('views/app.ejs');
const shellCss = read('public/css/kurukoo-product-os-revamp.css');
const workspaceRuntime = read('public/js/kurukoo-workspace.js');
const appShellRuntime = read('public/js/kurukoo-app-shell.js');
const authenticatedAdsRuntime = read('public/js/kurukoo-authenticated-ads.js');
const primaryChatRuntime = read('public/js/kurukoo-primary-chat.js');
const publicHome = read('views/index.ejs');
const publicNav = read('views/_partials/nav.ejs');

for (const marker of [
  'k-reference-app-header',
  'k-reference-header-search',
  'header-nearby-radar',
  'header-call',
  'header-messages',
  'header-notifications',
  'header-points',
  'header-cart',
  'header-account',
  'header-drawer',
  'k-reference-primary-nav',
  'k-reference-secondary-nav',
  'k-reference-account-nav',
  'k-reference-context-rail',
  'k-reference-mobile-more',
  'k-settings-hub',
  'k-settings-subscription',
  'k-settings-billing',
  'k-settings-connections',
  'k-settings-privacy',
]) assert.ok(app.includes(marker), `reference screen-set shell marker is missing: ${marker}`);

for (const [label, href] of [
  ['Desk', '/desk'],
  ['Agent', '/chat'],
  ['Requests', '/requests'],
  ['Tasks', '/tasks'],
  ['Discover', '/discover'],
  ['Settings', '/settings'],
  ['Subscription', '/subscriptions'],
  ['Wallet', '/wallet'],
  ['Channels', '/channels'],
] as const) assert.ok(app.includes(`href="${href}"`), `${label} must retain the canonical destination ${href}`);

assert.ok(app.includes('id="new-chat"'), 'New conversation must stay wired to the canonical conversation runtime');
assert.ok(app.includes('k-reference-new-conversation'), 'New conversation must be visually and semantically scoped to agent workflow');
assert.ok(!app.includes('k-app-header-location'), 'reference shell must not duplicate section titles in the application header');
assert.ok(!app.includes('Continue from Desk, a detail, or Chat.'), 'generic duplicated workspace guidance must be removed');
assert.ok(!app.includes('href="/settings" class="k-app-primary"'), 'settings must not use a primary CTA that loops to itself');
assert.ok(app.includes('Explore capabilities'), 'low-frequency product discovery must remain reachable through the structured header overflow');
assert.match(app, /if \(section !== 'settings'\)/, 'Settings must omit the shared generic page title and CTA so its dedicated hub is the single page heading');
assert.match(app, /section === 'discover'.*href="\/topics".*href="\/opportunities"/s, 'Discover must lead to adjacent community and opportunity workflows rather than to itself');
assert.match(app, /section === 'opportunities'.*href="\/discover".*href="\/network"/s, 'Opportunities must link to the related discovery and network workflows');

for (const marker of [
  'grid-template-columns: 224px minmax(0, 1fr) 304px',
  '@media (max-width: 1180px)',
  '@media (max-width: 1024px)',
  '@media (max-width: 767px)',
  '.k-reference-app-header',
  '.k-reference-context-rail',
  '.k-reference-sheet',
  '.k-reference-mobile-more-sheet',
  'min-height: 44px',
  'k-app-mobile-menu { display: none; }',
  'k-app-mobile-menu { display: grid; }',
]) assert.ok(shellCss.includes(marker), `reference responsive visual rule is missing: ${marker}`);

assert.ok(workspaceRuntime.includes('referenceMobileMore'), 'mobile More control must be managed by the shared workspace runtime');
assert.ok(appShellRuntime.includes("document.querySelector('.k-reference-shell')"), 'focused reference shells must suppress the inherited floating feature launcher');
assert.ok(authenticatedAdsRuntime.includes("document.querySelector('.k-reference-shell')"), 'reference workspaces must suppress legacy left-rail campaign injection and retain only the Agent-owned sponsored placement');
assert.ok(workspaceRuntime.includes('toggleChatSidebar'), 'drawer control must use the shared navigation behavior');
assert.ok(primaryChatRuntime.includes("$('new-chat')"), 'Chat runtime must retain canonical new-conversation behavior');

assert.ok(publicHome.includes('Try Kurukoo free'), 'public homepage must make low-commitment product entry explicit');
assert.ok(publicNav.includes('Try Kurukoo free'), 'public navigation must not present Chat as the only product entry');
assert.ok(!publicHome.includes('href="/chat" class="btn btn-primary home-hero__cta"'), 'public hero primary CTA must not blindly open Chat');

console.log('Reference screen-set contract passed: responsive pane ownership, control hierarchy, navigation grouping, CTA boundaries, settings consolidation and canonical conversation behavior are present.');
