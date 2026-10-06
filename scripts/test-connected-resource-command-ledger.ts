/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-connected-resource-command-ledger-${process.pid}-${Date.now()}.sqlite`;
const { registerConnectedResource, activateConnectedResource, controlConnectedResource, connectedResourceSupportProfile } = await import('../src/services/connectedResourceService.js');
const { routeIntent } = await import('../src/services/intentRouter.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { getEconomicRequest } = await import('../src/services/skillFlows.js');

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
assert.equal(connectedResourceSupportProfile(resource).level, 1);

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
assert.equal(connectedResourceSupportProfile(diagnosticActive!).level, 2);

const actionable = await registerConnectedResource({ phone, kind: 'phone', label: 'Actionable Phone', protocol: 'mqtt', capabilities: ['observe', 'control'], metadata: { baseTopic: 'kurukoo/test/actionable-phone' } });
const actionableActive = await activateConnectedResource(phone, actionable.resource.id, actionable.challenge.code);
assert.equal(connectedResourceSupportProfile(actionableActive!).level, 3);

const physical = await registerConnectedResource({ phone, kind: 'iot', label: 'Physical Sensor', protocol: 'mqtt', capabilities: ['observe', 'control'], metadata: { baseTopic: 'kurukoo/test/physical-sensor', physicalWorld: true } });
const physicalActive = await activateConnectedResource(phone, physical.resource.id, physical.challenge.code);
assert.equal(connectedResourceSupportProfile(physicalActive!).level, 4);

const inspected = await routeIntent('Check my Work MacBook.', phone, undefined, undefined, 'connected-resource-test');
assert.equal(inspected.skill, 'device_support');
assert.equal(inspected.cardData?.type, 'device_support');
assert.equal(inspected.cardData?.status, 'completed');
assert.equal(inspected.cardData?.liveObservation, false);
assert.equal(inspected.cardData?.observedState?.performance, 'unknown');
assert.equal(inspected.cardData?.resolution?.status, 'options');
assert.ok(Array.isArray(inspected.cardData?.resolution?.options));
assert.ok(inspected.cardData?.resolution?.options?.some((option: any) => option.id === 'monitor' || option.id === 'no_action'));
assert.match(inspected.reply, /recorded state|resolution choice/i);

const chatTurn = await processCanonicalChatTurn({ phone, message: 'Check my Work MacBook.', channel: 'web', conversationId: 'connected-resource-chat-test' });
assert.equal(chatTurn.cardData?.type, 'device_support');
assert.equal(chatTurn.cardData?.status, 'completed');
assert.equal(chatTurn.cardData?.resolution?.status, 'options');
assert.match(chatTurn.reply, /recorded state|resolution choice/i);

const unsupported = await registerConnectedResource({ phone, kind: 'phone', label: 'Personal phone', protocol: 'custom', capabilities: ['control'] });
const unsupportedActive = await activateConnectedResource(phone, unsupported.resource.id, unsupported.challenge.code);
assert.equal(unsupportedActive?.status, 'active');
const unsupportedInspection = await routeIntent('Check my Personal phone.', phone, undefined, undefined, 'connected-resource-test-unsupported');
assert.equal(unsupportedInspection.skill, 'device_support');
assert.equal(unsupportedInspection.cardData?.status, 'needs_user');
assert.equal(unsupportedInspection.cardData?.inspection?.status, 'unavailable');
assert.equal(unsupportedInspection.cardData?.noInspectionPerformed, true);
assert.equal(unsupportedInspection.cardData?.nextActions?.length, 2);
assert.match(unsupportedInspection.reply, /cannot inspect.*directly|walk you through.*safe checks|find someone/i);

const noAccessPhone = `+234808${String(Date.now()).slice(-7)}`;
const noAccess = await routeIntent('My phone is running slowly. Can you check it?', noAccessPhone, undefined, undefined, 'connected-resource-test-no-access');
assert.equal(noAccess.skill, 'device_support');
assert.equal(noAccess.cardData?.inspection?.status, 'unavailable');
assert.equal(noAccess.cardData?.inspection?.reason, 'no_authorized_connected_resource');
assert.equal(noAccess.cardData?.nextActions?.length, 2);
assert.match(noAccess.reply, /live connection|walk you through.*safe checks|find someone/i);

const guided = await routeIntent('Walk me through safe checks for my phone.', noAccessPhone, undefined, undefined, 'connected-resource-test-guided');
assert.equal(guided.skill, 'device_support');
assert.equal(guided.canonicalAction, 'device_support.guided_checks');
assert.equal(guided.cardData?.guidedChecks?.length, 3);
assert.equal(guided.cardData?.nextActions?.[0]?.id, 'report_guided_results');
assert.match(guided.reply, /cannot inspect.*directly|safe checks/i);

const repairTurn = await routeIntent('Please find a phone repairer for my Work MacBook screen is broken in Ikeja.', phone, undefined, undefined, chatTurn.conversationId);
assert.equal(repairTurn.skill, 'phone_repairer');
assert.ok(repairTurn.cardData?.requestId);
const repairRequest = await getEconomicRequest(String(repairTurn.cardData.requestId));
assert.equal(repairRequest?.requirements?.prior_diagnostics?.source, 'canonical_chat_device_support');
assert.equal(repairRequest?.requirements?.prior_diagnostics?.resource?.label, 'Work MacBook');
assert.equal(repairRequest?.requirements?.prior_diagnostics?.liveObservation, false);
assert.match(repairTurn.reply, /attached the earlier recorded device observation/i);

console.log('Connected-resource command ledger regression passed: owner scope, capability gating, truthful MQTT readiness, persisted command identity, idempotent replay, and canonical device observation evidence.');
