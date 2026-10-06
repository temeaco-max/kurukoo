/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-universal-capability-protocol-${process.pid}-${Date.now()}.sqlite`;
const { listUniversalCapabilities, projectCapabilityResult, validateCapabilityProposal } = await import('../src/services/universalCapabilityProtocol.js');
const { ensureCapabilityFoundation, normalizeSkillCapabilityReference } = await import('../src/services/capabilityFoundation.js');
const { getCapabilityRegistration, listCapabilityRegistrations, resolveCapabilityComposition, validateCapabilityRegistry } = await import('../src/services/capabilityRegistry.js');
const { getSkillCapabilities } = await import('../src/services/skillFlows.js');

ensureCapabilityFoundation();
const fabricValidation = validateCapabilityRegistry();
assert.equal(fabricValidation.valid, true, `capability fabric must be internally valid: ${JSON.stringify(fabricValidation)}`);
assert.ok(getCapabilityRegistration('discovery'), 'atomic discovery must be registered');
assert.ok(getCapabilityRegistration('control'), 'atomic connected-resource control must be registered');
assert.ok(getCapabilityRegistration('execute'), 'atomic execution must be registered');
assert.ok(getCapabilityRegistration('view'), 'atomic read-only view must be registered');
const skillRequirements = getSkillCapabilities('find_worker').map(normalizeSkillCapabilityReference);
const skillComposition = resolveCapabilityComposition(skillRequirements);
assert.equal(skillComposition.unresolved.length, 0, `find_worker capability composition must resolve: ${skillComposition.unresolved.join(', ')}`);
assert.ok(skillComposition.ordered.some(item => item.descriptor.capability === 'atomic.discovery'), 'skill plans must include discovery as a reusable atomic capability');
assert.ok(skillComposition.ordered.some(item => item.descriptor.capability === 'atomic.verification'), 'skill plans must include verification as a reusable atomic capability');
assert.ok(skillComposition.ordered.some(item => item.descriptor.capability === 'atomic.fulfillment'), 'skill plans must include fulfillment as a reusable atomic capability');
assert.ok(listCapabilityRegistrations().length >= 29, 'capability foundation must expose a reusable atomic vocabulary rather than only vertical feature names');

const catalog = await listUniversalCapabilities();
assert.ok(catalog.length >= 205, `expected the canonical catalog to cover the known skills, got ${catalog.length}`);
assert.deepEqual(new Set(catalog.map(item => item.kind)), new Set(['skill', 'operation', 'agent_tool']), 'the single catalog must distinguish skills, canonical operations, and agent tools');
assert.equal(new Set(catalog.map(item => `${item.kind}:${item.capability}`)).size, catalog.length, 'the projected universal vocabulary must not contain duplicate descriptor identities');
assert.ok(catalog.some(item => item.capability === 'find_worker'), 'find_worker must remain discoverable through the canonical catalog');
assert.ok(catalog.some(item => item.capability.startsWith('agent.')), 'first-class agent tools must use the same capability catalog');
const readOnly = catalog.find(item => item.mode === 'read_only');
assert.ok(readOnly, 'catalog must expose read-only capabilities');
assert.ok(!readOnly.actions.includes('pay') && !readOnly.actions.includes('reserve'), 'read-only capabilities must not advertise payment or reservation actions');
assert.equal(readOnly.activationState, 'locally_available', 'read-only informational capabilities should not inherit external activation requirements');

const worker = catalog.find(item => item.capability === 'find_worker')!;
assert.ok(worker.owner.includes('canonicalChatTurnService'), 'capabilities must identify canonical owners');
assert.ok(worker.context.requiredInputs.length > 0, 'structured capabilities must expose required inputs');
assert.ok(worker.lifecycle.length > 0, 'capabilities must expose lifecycle states');
assert.ok(worker.recoveryActions.length > 0, 'capabilities must expose recovery actions');
assert.ok(worker.continuationContext.includes('canonicalObjectId'), 'capabilities must preserve canonical object identity for continuation');

const proposal: CapabilityActionProposal = {
  capability: worker.capability,
  action: worker.actions.includes('select') ? 'select' : worker.actions[0],
  contextId: 'request:req-1',
  canonicalObjectId: 'req-1',
  arguments: { providerPhone: '+2348030000000' },
  confidence: 0.93,
  reason: 'User explicitly selected a canonical provider option.',
  confirmationRequired: false,
};
assert.equal(validateCapabilityProposal(proposal, worker, { ownerVerified: true, objectVerified: true, stale: false, confirmationGranted: true }).valid, true, 'owned active proposals should validate');
assert.equal(validateCapabilityProposal(proposal, worker, { ownerVerified: false, objectVerified: false, stale: false, confirmationGranted: true }).code, 'foreign_context', 'foreign context must fail closed');
assert.equal(validateCapabilityProposal(proposal, worker, { ownerVerified: true, objectVerified: true, stale: true, confirmationGranted: true }).code, 'stale_context', 'stale context must fail closed');
assert.equal(validateCapabilityProposal({ ...proposal, action: 'unsupported-action' }, worker, { ownerVerified: true, objectVerified: true, stale: false, confirmationGranted: true }).code, 'unsupported_action', 'unsupported actions must be rejected');
assert.equal(validateCapabilityProposal({ ...proposal, confirmationRequired: true }, worker, { ownerVerified: true, objectVerified: true, stale: false, confirmationGranted: false }).code, 'missing_confirmation', 'confirmation-gated actions must not execute without confirmation');

const completed = projectCapabilityResult({ capability: 'find_worker', action: 'confirm', contextId: 'request:req-1', canonicalObjectId: 'req-1', cardData: { type: 'agentic_storefront', stage: 'complete', requestId: 'req-1', evidence: { source: 'canonical_service' } }, message: 'The canonical request is complete.' });
assert.equal(completed.status, 'completed');
assert.equal(completed.canonicalObjectId, 'req-1');
assert.equal(completed.evidenceLevel, 'canonical_service');

const waiting = projectCapabilityResult({ capability: 'find_worker', action: 'discover', cardData: { type: 'agentic_storefront', stage: 'awaiting_match', requestId: 'req-2' }, message: 'The request is being matched.' });
assert.equal(waiting.status, 'waiting');
assert.ok(waiting.retryRecovery.length === 0, 'waiting should not be presented as a failure');

const unavailable = projectCapabilityResult({ capability: 'payment', action: 'pay', canonicalObjectId: 'req-3', activationState: 'unavailable_external_dependency', cardData: { type: 'payment', stage: 'payment_pending', requestId: 'req-3' }, message: 'Payment activation is not available in this deployment.' });
assert.equal(unavailable.status, 'unavailable_external_dependency');
assert.ok(unavailable.retryRecovery.some(action => action.action === 'retry'));
assert.ok(unavailable.retryRecovery.some(action => action.action === 'resume'));

console.log(`Universal capability protocol regression passed: ${catalog.length} canonical capabilities plus ${listCapabilityRegistrations().length} composable registry capabilities, exact-context validation, result states, and recovery paths verified.`);
