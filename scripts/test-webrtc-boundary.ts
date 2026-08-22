import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routeSource = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'webrtcRoutes.ts'), 'utf8');
const callClientSource = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'kurukoo-call.js'), 'utf8');
assert.match(routeSource, /function requireWebRTCReadiness/);
assert.match(routeSource, /router\.get\('\/status'/);
assert.match(routeSource, /router\.get\('\/config'/);
assert.match(routeSource, /getWebRTCClientConfig\(phone\)/);
assert.match(routeSource, /Authenticated identity is required for ICE configuration/);
assert.match(routeSource, /if \(!requireWebRTCReadiness\(res\)\) return;/);
assert.match(routeSource, /getWebRTCStatus/);
assert.match(routeSource, /authorizeProviderSessionRoom/);
assert.match(routeSource, /getProviderCommunicationSession/);
assert.match(routeSource, /Only the authenticated provider communication participants may access this room/);
assert.match(callClientSource, /params\.get\('session'\)/);
assert.match(callClientSource, /provider-session:\$\{sessionId\}/);

const names = [
  'FF_WEBRTC', 'STUN_SERVERS', 'TURN_URL', 'TURN_SERVER_URL',
  'TURN_USERNAME', 'TURN_CREDENTIAL', 'TURN_PASSWORD',
  'TURN_SHARED_SECRET', 'COTURN_SHARED_SECRET', 'TURN_CREDENTIAL_TTL_SECONDS',
] as const;
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
for (const name of names) delete process.env[name];

const { getWebRTCStatus, getWebRTCClientConfig } = await import('../src/services/webrtcSignalling.ts');
const unavailable = getWebRTCStatus();
assert.equal(unavailable.signaling, 'repository_ready');
assert.equal(unavailable.enabled, false);
assert.equal(unavailable.available, false);
assert.equal(unavailable.relayConfigured, false);
assert.equal(unavailable.directStunConfigured, false);
assert.equal(unavailable.credentialMode, 'none');
assert.match(unavailable.activationRequirement, /STUN|TURN|relay/i);
assert.equal(getWebRTCClientConfig('customer@example.test').iceServers.length, 0);

process.env.FF_WEBRTC = 'true';
process.env.STUN_SERVERS = 'stun:stun.example.test:3478';
process.env.TURN_URL = 'turn:turn.example.test:3478?transport=udp';
process.env.TURN_USERNAME = 'static-user';
process.env.TURN_CREDENTIAL = 'static-credential';
const staticCredentialStatus = getWebRTCStatus();
assert.equal(staticCredentialStatus.enabled, true, 'direct STUN can be enabled without TURN fallback');
assert.equal(staticCredentialStatus.available, true);
assert.equal(staticCredentialStatus.relayConfigured, false, 'static TURN credentials must not activate relay fallback');
assert.equal(staticCredentialStatus.staticTurnCredentialsRefused, true);
assert.match(staticCredentialStatus.activationRequirement, /static client credentials are refused/i);
const staticCredentialConfig = getWebRTCClientConfig('customer@example.test');
assert.equal(staticCredentialConfig.iceServers.length, 1, 'static TURN credentials must never reach the browser');
assert.equal(staticCredentialConfig.credentialedTurn, false);
assert.equal(staticCredentialConfig.credentialMode, 'none');
assert.deepEqual(staticCredentialConfig.iceServers[0], { urls: 'stun:stun.example.test:3478' });

process.env.TURN_SHARED_SECRET = 'test-coturn-rest-secret';
process.env.TURN_CREDENTIAL_TTL_SECONDS = '600';
const configuredStatus = getWebRTCStatus();
assert.equal(configuredStatus.enabled, true);
assert.equal(configuredStatus.available, true);
assert.equal(configuredStatus.relayConfigured, true);
assert.equal(configuredStatus.credentialMode, 'ephemeral');
const first = getWebRTCClientConfig('customer@example.test');
const second = getWebRTCClientConfig('provider@example.test');
assert.equal(first.iceServers.length, 2);
assert.equal(first.transport, 'stun-turn');
assert.equal(first.credentialedTurn, true);
assert.equal(first.credentialMode, 'ephemeral');
assert.equal(first.directStunConfigured, true);
assert.equal(first.staticTurnCredentialsRefused, true);
assert.ok(Number.isInteger(first.expiresAt) && first.expiresAt! > Math.floor(Date.now() / 1000));
assert.deepEqual(first.iceServers[0], { urls: 'stun:stun.example.test:3478' });
assert.equal(first.iceServers[1]?.urls, 'turn:turn.example.test:3478?transport=udp');
assert.match(String(first.iceServers[1]?.username), /^\d+:[A-Za-z0-9_-]+$/);
assert.notEqual(first.iceServers[1]?.credential, 'static-credential');
assert.notEqual(first.iceServers[1]?.username, second.iceServers[1]?.username, 'credentials must be identity-scoped');
assert.notEqual(first.iceServers[1]?.credential, second.iceServers[1]?.credential, 'credentials must not be shared between identities');
const unauthenticatedConfig = getWebRTCClientConfig();
assert.equal(unauthenticatedConfig.iceServers.length, 1, 'TURN credentials require an authenticated identity');
assert.equal(unauthenticatedConfig.credentialedTurn, false);

for (const name of names) {
  if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
}

console.log('WebRTC boundary passed: authenticated ICE configuration issues identity-scoped ephemeral TURN credentials, prefers direct STUN, refuses static TURN client credentials, and binds provider rooms to canonical participants.');
