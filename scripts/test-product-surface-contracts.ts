/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import { CLIENT_SURFACES, DESKTOP_AUTHENTICATED_HOME } from '../src/services/clientSurfaceRegistry.js';
import { CANONICAL_PLATFORM_FEATURE_CONTRACTS, assertCanonicalPlatformFeatureSurfaces } from '../src/services/canonicalPlatformFeatureRegistry.js';
import { PUBLIC_PAGE_CONTENT_CONTRACTS } from '../src/services/publicPageContentContracts.js';
import { ADMIN_PAGE_CONTENT_CONTRACTS } from '../src/services/adminPageContentContracts.js';

assert.equal(DESKTOP_AUTHENTICATED_HOME, 'web-desk');
assert.ok(CLIENT_SURFACES.some(surface => surface.route === '/field' && surface.id === 'web-desk'));
assert.ok(CLIENT_SURFACES.some(surface => surface.route === '/chat' && surface.id === 'web-chat'));
assert.ok(CLIENT_SURFACES.some(surface => surface.route === '/requests/:requestId'));
assert.ok(CLIENT_SURFACES.some(surface => surface.route === '/admin/providers'));
assert.ok(CLIENT_SURFACES.every(surface => !surface.route.startsWith('/app/')));
assert.ok(CLIENT_SURFACES.every(surface => !surface.route.includes('?section=')));
assertCanonicalPlatformFeatureSurfaces();
assert.ok(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.id === 'agents' && feature.webSurface === '/agents'));
assert.ok(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.id === 'connect' && feature.webSurface === '/connect'));
assert.ok(PUBLIC_PAGE_CONTENT_CONTRACTS.some(page => page.route === '/features'));
assert.ok(PUBLIC_PAGE_CONTENT_CONTRACTS.some(page => page.route === '/cookies'));
assert.ok(ADMIN_PAGE_CONTENT_CONTRACTS.some(page => page.route === '/admin/settings'));
assert.ok(ADMIN_PAGE_CONTENT_CONTRACTS.some(page => page.route === '/admin/providers'));
console.log('Product surface contracts passed: clean canonical URLs, Desk home, Agent Chat, public content, Admin content, and projected feature surfaces.');
