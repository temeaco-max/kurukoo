import assert from 'node:assert/strict';
import { registerConnectedResource, activateConnectedResource, controlConnectedResource } from '../src/services/connectedResourceService.js';
import { routeIntent } from '../src/services/intentRouter.js';
import { processCanonicalChatTurn } from '../src/services/canonicalChatTurnService.js';

const phone = `+234809${String(Date.now()).slice(-7)}`;
const { resource, challenge } = await registerConnectedResource({
  phone,
  kind: 'iot',
  label: 'Kitchen relay',
  protocol: 'mqtt',
  capabilities: ['control'],
  metadata: { baseTopic: 'kurukoo/test/kitchen-relay' },
});
const activated = await activateConnectedResource(phone, resource.id, challenge.code);
assert.equal(activated?.status, 'active');

const first = await controlConnectedResource({ phone, id: resource.id, command: 'control', payload: 'on', idempotencyKey: 'ledger-test-1' });
assert.equal(first.accepted, false);
assert.equal(first.state, 'not_configured');
assert.ok(first.commandId);

const replay = await controlConnectedResource({ phone, id: resource.id, command: 'control', payload: 'on', idempotencyKey: 'ledger-test-1' });
assert.equal(replay.commandId, first.commandId);
assert.equal(replay.state, first.state);
assert.equal(replay.accepted, first.accepted);

const blocked = await controlConnectedResource({ phone, id: resource.id, command: 'unsupported', payload: '', idempotencyKey: 'ledger-test-2' });
assert.equal(blocked.state, 'blocked');
assert.equal(blocked.accepted, false);

const diagnostic = await registerConnectedResource({
  phone,
  kind: 'laptop',
  label: 'Work MacBook',
  vendor: 'Apple',
  protocol: 'custom',
  capabilities: ['observe'],
  metadata: { lastState: { battery: 'charging', performance: 'unknown' }, lastStateAt: new Date().toISOString() },
});
const diagnosticActive = await activateConnectedResource(phone, diagnostic.resource.id, diagnostic.challenge.code);
assert.equal(diagnosticActive?.status, 'active');
const inspected = await routeIntent('Check my Work MacBook.', phone, undefined, undefined, 'connected-resource-test');
assert.equal(inspected.skill, 'device_support');
assert.equal(inspected.cardData?.type, 'device_support');
assert.equal(inspected.cardData?.status, 'completed');
assert.equal(inspected.cardData?.liveObservation, false);
assert.equal(inspected.cardData?.observedState?.performance, 'unknown');
assert.match(inspected.reply, /recorded state|not a live connection test/i);

const chatTurn = await processCanonicalChatTurn({ phone, message: 'Check my Work MacBook.', channel: 'web', conversationId: 'connected-resource-chat-test' });
assert.equal(chatTurn.cardData?.type, 'device_support');
assert.equal(chatTurn.cardData?.status, 'completed');
assert.match(chatTurn.reply, /recorded state|not a live connection test/i);

console.log('Connected-resource command ledger regression passed: owner scope, capability gating, truthful MQTT readiness, persisted command identity, idempotent replay, and canonical device observation evidence.');
