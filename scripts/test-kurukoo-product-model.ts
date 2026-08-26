import assert from 'node:assert/strict';
import { DESKTOP_AUTHENTICATED_HOME, CLIENT_SURFACES } from '../src/services/clientSurfaceRegistry.js';
import { CANONICAL_PLATFORM_FEATURE_CONTRACTS, assertCanonicalPlatformFeatureSurfaces } from '../src/services/canonicalPlatformFeatureRegistry.js';

assert.equal(CLIENT_SURFACES.find(surface => surface.id === DESKTOP_AUTHENTICATED_HOME)?.route, '/desk');
assert.equal(CLIENT_SURFACES.some(surface => surface.route === '/desk' && surface.id === 'web-desk'), true);
assert.equal(CLIENT_SURFACES.some(surface => surface.route === '/chat' && surface.id === 'web-chat'), true);
assert.equal(CLIENT_SURFACES.some(surface => surface.route === '/chat/:conversationId'), true);
assert.equal(CLIENT_SURFACES.some(surface => surface.route === '/share/:shareId'), true);
assert.equal(CLIENT_SURFACES.some(surface => surface.route === '/requests/:requestId'), true);
assert.equal(CLIENT_SURFACES.some(surface => surface.route === '/admin/users'), true);
assert.equal(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.id === 'discover' && feature.webSurface === '/discover'), true);
assert.equal(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.id === 'notifications' && feature.webSurface === '/notifications'), true);
assert.equal(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.id === 'chat' && feature.webSurface === '/chat'), true);
assert.equal(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.id === 'repairs' && feature.webSurface === '/chat'), true);
assert.equal(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.webSurface.startsWith('/app/')), false);
assert.equal(CANONICAL_PLATFORM_FEATURE_CONTRACTS.some(feature => feature.webSurface.includes('?section=')), false);
assert.doesNotThrow(() => assertCanonicalPlatformFeatureSurfaces());

console.log('Kurukoo product model contract passed: Desk/Agent/resource/Admin canonicality and feature URL projection verified.');
