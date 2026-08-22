import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DESK_CONTENT_MODULES, DESK_VISUAL_REFERENCE } from '../src/services/deskVisualFoundation.js';
import { AUTHENTICATED_SHELL_BRAND_RULES, AUTHENTICATED_SHELL_CONTRACT } from '../src/services/authenticatedShellFoundation.js';

const deskRuntime = fs.readFileSync('public/js/kurukoo-desk-system.js', 'utf8');
const deskCss = fs.readFileSync('public/css/kurukoo-desk-system.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('src/services/canonicalAuthenticatedScreenSetManifest.json', 'utf8'));

assert.equal(DESK_VISUAL_REFERENCE.asset, 'kurukoo-os-personal-workspace.png');
assert.ok(DESK_VISUAL_REFERENCE.appliesTo.includes('/desk'));
assert.ok(DESK_VISUAL_REFERENCE.doesNotApplyTo.includes('Chat page body composition'));
assert.ok(DESK_VISUAL_REFERENCE.requiredPatterns.includes('centred universal search control in the authenticated header'));
assert.ok(DESK_VISUAL_REFERENCE.requiredPatterns.includes('notification control adjacent to account/profile controls'));

const moduleIds = DESK_CONTENT_MODULES.map((module) => module.id);
for (const required of ['welcome', 'today-flow', 'continue-conversation', 'active-requests', 'tasks-reminders', 'opportunity-radar', 'points', 'topics-for-you', 'guide-content', 'sponsored-provider', 'connected-channels', 'pulse', 'safety-check-in', 'activity-summary']) {
  assert.ok(moduleIds.includes(required), `Missing Desk module contract: ${required}`);
}
for (const module of DESK_CONTENT_MODULES) {
  assert.ok(module.purpose);
  assert.ok(module.primaryData.length > 0);
  assert.ok(module.actions.length > 0);
  assert.ok(module.states.length > 0);
}

for (const region of ['top-header', 'primary-sidebar', 'main-content', 'context-inspector']) {
  assert.ok(AUTHENTICATED_SHELL_CONTRACT.some((item) => item.region === region), `Missing authenticated shell region: ${region}`);
}
assert.equal(AUTHENTICATED_SHELL_BRAND_RULES.referenceLogoLiteralReuse, false);
assert.equal(AUTHENTICATED_SHELL_BRAND_RULES.logoAuthority, 'brandPrimitiveRegistry');
assert.equal(AUTHENTICATED_SHELL_BRAND_RULES.deskSpecificContentReferenceAllowedOutsideDesk, false);
assert.equal(AUTHENTICATED_SHELL_BRAND_RULES.canonicalSearchName, 'Search Kurukoo');
assert.equal(AUTHENTICATED_SHELL_BRAND_RULES.canonicalAgentActionLabel, 'Ask Agent');

for (const id of ['welcome','today-flow','continue-conversation','active-requests','tasks-reminders','opportunity-radar','points','topics-for-you','guide-content','sponsored-provider','connected-channels','pulse','safety-check-in','activity-summary']) {
  assert.match(deskRuntime, new RegExp(`data-desk-module=\\"${id}\\"`), `Desk runtime missing module: ${id}`);
  assert.match(deskCss, new RegExp(`k-desk-module-${id}`), `Desk CSS missing module composition: ${id}`);
}
for (const state of ['idle']) assert.match(deskRuntime, new RegExp(`data-agent-presence=\\"${state}\\"`), `Desk Agent Presence state missing: ${state}`);
for (const state of ['empty', 'ready', 'unavailable']) assert.match(deskRuntime, new RegExp(`k-desk-state-${state}`), `Desk state treatment missing: ${state}`);
assert.match(deskRuntime, /section !== 'desk'/, 'Desk-only composition must remain gated to /desk.');
assert.match(deskRuntime, /fetch\('\/api\/points\/balance'/, 'Desk must reuse the canonical Points authority rather than inventing a balance.');
assert.equal(manifest.screens.find((screen) => screen.id === 'desk').templateComponentOwner, 'views/app.ejs');
assert.deepEqual(manifest.screens.filter((screen) => screen.id !== 'desk').map((screen) => screen.id), ['chat','requests','tasks','notifications','contacts','memory','agent','discover']);

console.log('Desk visual foundation and Phase 1 composition contract passed.');
