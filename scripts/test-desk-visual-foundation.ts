/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DESK_CONTENT_MODULES, DESK_VISUAL_REFERENCE } from '../src/services/deskVisualFoundation.js';
import { AUTHENTICATED_SHELL_BRAND_RULES, AUTHENTICATED_SHELL_CONTRACT } from '../src/services/authenticatedShellFoundation.js';

const deskRuntime = fs.readFileSync('frontend/public/js/kurukoo-desk-system.js', 'utf8');
const deskCss = fs.readFileSync('frontend/public/css/kurukoo-desk-system.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('src/services/canonicalAuthenticatedScreenSetManifest.json', 'utf8'));

assert.equal(DESK_VISUAL_REFERENCE.asset, 'kurukoo-os-personal-workspace.png');
assert.ok(DESK_VISUAL_REFERENCE.appliesTo.includes('/field'));
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

assert.match(deskRuntime, /dataset\.deskModule = id/);
assert.ok(deskRuntime.includes('k-desk-module-'), 'Desk runtime must reference the shared module composition class');
assert.ok(deskCss.includes('k-desk-module-copy') && deskCss.includes('k-desk-module-actions'), 'Desk CSS must include the module composition classes');

assert.match(deskRuntime, /dataset\.agentPresence = "idle"/, 'Desk Agent Presence default state missing: idle');
for (const state of ['listening', 'thinking', 'speaking', 'working', 'waiting', 'needs-attention']) {
  assert.match(deskCss, new RegExp(`k-desk-presence[^}]*${state}`), `Desk Agent Presence styling missing: ${state}`);
}
assert.ok(deskRuntime.includes('k-desk-state-'), 'Desk runtime must reference the shared state-treatment class');
assert.match(fs.readFileSync('views/app.ejs','utf8'), /section === 'desk'/, 'Desk-only composition must remain gated to the desk section in the server template.');
assert.match(deskRuntime, /fetch\((['\"])\/api\/points\/balance\1/, 'Desk must reuse the canonical Points authority rather than inventing a balance.');
assert.equal(manifest.screens.find((screen) => screen.id === 'desk').templateComponentOwner, 'views/app.ejs');
assert.deepEqual(manifest.screens.filter((screen) => screen.id !== 'desk').map((screen) => screen.id), ['chat','requests','tasks','notifications','contacts','memory','agent','discover']);

console.log('Desk visual foundation and Phase 1 composition contract passed.');
