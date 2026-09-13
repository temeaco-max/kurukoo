/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifestPath = 'src/services/canonicalAuthenticatedScreenSetManifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const routes = fs.readFileSync('src/routes/appSurfaceRoutes.ts', 'utf8');
const chatPageRoutes = fs.readFileSync('src/routes/chatPageRoutes.ts', 'utf8');
const appTemplate = fs.readFileSync('views/app.ejs', 'utf8');
const appExtensions = fs.readFileSync('frontend/public/js/kurukoo-app-extensions.js', 'utf8');
const chat = fs.readFileSync('frontend/public/chat/index.html', 'utf8');
const osRegistry = fs.readFileSync('src/services/kurukooOsComponentRegistry.ts', 'utf8');
const canonicalUrls = fs.readFileSync('src/services/canonicalUrlRegistry.ts', 'utf8');

const expected = {
  desk: '/home',
  chat: '/chat',
  requests: '/activity',
  tasks: '/work',
  notifications: '/notifications',
  contacts: '/connect',
  memory: '/memory',
  agent: '/chat',
  discover: '/explore',
};

assert.equal(manifest.manifestVersion, 1);
assert.equal(manifest.screens.length, 9, 'Canonical authenticated OS must contain exactly nine screens.');
assert.deepEqual(manifest.screens.map((screen) => screen.id), Object.keys(expected));

for (const screen of manifest.screens) {
  assert.equal(screen.route, expected[screen.id], `Unexpected canonical route for ${screen.id}`);
  assert.ok(screen.routeOwner, `Missing route owner: ${screen.id}`);
  assert.ok(screen.templateComponentOwner, `Missing implementation owner: ${screen.id}`);
  assert.ok(screen.cssOwner && (Array.isArray(screen.cssOwner) ? screen.cssOwner.length : screen.cssOwner.length > 0), `Missing CSS owner: ${screen.id}`);
  assert.ok(screen.jsOwner && screen.jsOwner.length > 0, `Missing JS owner: ${screen.id}`);
  assert.ok(screen.dataOwner && screen.dataOwner.length > 0, `Missing data owner: ${screen.id}`);
  assert.ok(screen.headerOwner, `Missing header owner: ${screen.id}`);
  assert.ok(screen.navigationOwner, `Missing navigation owner: ${screen.id}`);
  assert.ok(screen.composerOwner, `Missing composer owner: ${screen.id}`);
  assert.ok(screen.referenceScreenSet?.length, `Missing visual reference: ${screen.id}`);
  assert.ok(screen.allowedSharedPrimitives?.length, `Missing shared primitive authority: ${screen.id}`);
  for (const requiredState of ['empty', 'loading', 'error', 'unavailable', 'responsive']) assert.ok(screen.states?.[requiredState], `Missing ${requiredState} state contract: ${screen.id}`);
  assert.ok(screen.structure && screen.content && screen.primaryAction && screen.contextContinuation, `Incomplete screen inventory: ${screen.id}`);
  assert.equal(screen.status, 'IMPLEMENTED_STATIC_UNVERIFIED_RUNTIME', `Runtime status must remain unverified: ${screen.id}`);
  assert.ok(!screen.route.startsWith('/app/'), `Legacy /app route cannot be canonical: ${screen.id}`);
}

for (const [id, route] of Object.entries(expected)) {
  assert.ok(canonicalUrls.includes(`'${route}'`) || canonicalUrls.includes(`"${route}"`), `Canonical URL registry missing ${id}: ${route}`);
}

assert.match(routes, /router\.get\('\/chat\/:conversationId'/);
assert.match(chatPageRoutes, /path\.join\(process\.cwd\(\), 'frontend\/public', 'chat', 'index\.html'\)/);
assert.match(routes, /\['desk', \{ title: 'Home'/);
assert.match(routes, /const cleanCanonicalSections: Record<string, string> = \{/);
assert.match(routes, /'\/desk': 'desk'/) || assert.match(routes, /'\/home': 'desk'/);
assert.match(routes, /function renderApp\(req: express\.Request, res: express\.Response, section = 'desk'/);
assert.match(routes, /return res\.render\('app'/);

for (const token of ['/js/kurukoo-desk-system.js?v=1', '/css/kurukoo-desk-system.css?v=1', '/js/kurukoo-desk-live-hydration.js?v=1']) {
  assert.ok(appExtensions.includes(token), `Authenticated app extension chain missing: ${token}`);
}
for (const token of ['k-app-page', 'k-app-shell', 'k-app-main', 'k-app-surface']) assert.ok(appTemplate.includes(token), `Shared app shell missing from canonical template: ${token}`);
for (const token of ['chat-shell', 'chat-header', 'workspace-nav', 'composer-wrap', 'composer', 'chat-inspector']) assert.ok(chat.includes(token), `Canonical Chat shell/composer marker missing: ${token}`);

for (const screen of manifest.screens) {
  for (const primitive of screen.allowedSharedPrimitives) assert.ok(osRegistry.includes(`id: '${primitive}'`) || osRegistry.includes(`id: \"${primitive}\"`), `Shared primitive is not in canonical registry: ${screen.id} -> ${primitive}`);
}

const sharedAppScreens = manifest.screens.filter((screen) => ['desk','requests','tasks','notifications','contacts','memory','discover'].includes(screen.id));
for (const screen of sharedAppScreens) assert.equal(screen.templateComponentOwner.startsWith('views/app.ejs'), true, `Non-Chat canonical screen escaped shared app template: ${screen.id}`);
assert.equal(manifest.screens.find((screen) => screen.id === 'agent').route, '/chat');
assert.equal(manifest.screens.find((screen) => screen.id === 'agent').supportingRuntimeSurface, '/agents is the canonical Agents directory/runtime support surface, not a tenth canonical screen');
assert.equal(manifest.freezeRule.id, 'canonical-authenticated-screen-freeze');
assert.equal(manifest.authority.runtimeVerification, 'UNVERIFIED');
assert.equal(manifest.authority.realWorldVerification, 'N/A');

console.log('Canonical authenticated screen-set freeze passed: exactly nine screens, one implementation owner per screen, shared shell ownership, visual authority, state inventory, duplicate boundary and runtime verification boundary are recorded.');
