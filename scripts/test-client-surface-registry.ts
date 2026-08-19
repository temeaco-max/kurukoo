import assert from 'node:assert/strict';
import { CLIENT_SURFACES, MOBILE_PRIMARY_NAVIGATION, assertClientSurfaceOwnership, getClientSurfaces } from '../src/services/clientSurfaceRegistry.js';

assert.equal(getClientSurfaces('web').some(surface => surface.id === 'web-chat'), true);
assert.equal(getClientSurfaces('web').some(surface => surface.id === 'web-connect'), true);
assert.equal(getClientSurfaces('pwa').some(surface => surface.id === 'pwa-shell'), true);
assert.equal(getClientSurfaces('native').some(surface => surface.id === 'native-ios'), true);
assert.equal(getClientSurfaces('native').some(surface => surface.id === 'native-android'), true);
assert.deepEqual(MOBILE_PRIMARY_NAVIGATION, ['agent', 'discover', 'requests', 'tasks', 'connect']);
assert.doesNotThrow(() => assertClientSurfaceOwnership('web-chat', 'web'));
assert.throws(() => assertClientSurfaceOwnership('web-chat', 'pwa'), /belongs to web/);
assert.equal(CLIENT_SURFACES.filter(surface => surface.family === 'web' && surface.responsive).length >= 1, true);
console.log(`Client surface registry contract passed: ${CLIENT_SURFACES.length} canonical surfaces, ${getClientSurfaces('web').length} web, ${getClientSurfaces('pwa').length} PWA, ${getClientSurfaces('native').length} native, ${getClientSurfaces('admin').length} admin.`);
