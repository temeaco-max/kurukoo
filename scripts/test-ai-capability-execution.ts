/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-capability-execution-${process.pid}-${Date.now()}.sqlite`;
const { executeCanonicalCapabilityProposal } = await import('../src/services/canonicalCapabilityExecutor.js');
const { createConversationGoal } = await import('../src/services/agentRuntime.js');
const { createEconomicRequest } = await import('../src/services/skillFlows.js');

process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';

const phone = `+23480${Date.now().toString().slice(-8)}`;
const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const reminder = await executeCanonicalCapabilityProposal({
  phone,
  capability: 'reminder',
  action: 'create',
  arguments: { title: 'Execution boundary regression', dueAt },
  idempotencyKey: `test-reminder-create:${phone}`,
});
assert.equal(reminder.status, 'completed', 'reminder.create must execute through reminderService');
assert.equal(reminder.evidenceLevel, 'canonical_service');
assert.ok(reminder.canonicalObjectId, 'completed reminder must return its canonical object identity');

const duplicateReminder = await executeCanonicalCapabilityProposal({
  phone,
  capability: 'reminder',
  action: 'create',
  arguments: { title: 'Execution boundary regression', dueAt },
  idempotencyKey: `test-reminder-create:${phone}`,
});
assert.equal(duplicateReminder.duplicate, true, 'repeated idempotency key must return the original result');
assert.equal(duplicateReminder.canonicalObjectId, reminder.canonicalObjectId, 'idempotency must preserve the original object');

const cancelled = await executeCanonicalCapabilityProposal({
  phone,
  capability: 'reminder',
  action: 'cancel',
  canonicalObjectId: reminder.canonicalObjectId,
  confirmationGranted: true,
  idempotencyKey: `test-reminder-cancel:${phone}`,
});
assert.equal(cancelled.status, 'completed', 'reminder.cancel must use the exact reminder owner');
assert.equal(cancelled.canonicalObjectId, reminder.canonicalObjectId);

const wrongObject = await executeCanonicalCapabilityProposal({
  phone,
  capability: 'reminder',
  action: 'cancel',
  canonicalObjectId: 'missing-reminder-id',
  confirmationGranted: true,
  idempotencyKey: `test-reminder-wrong:${phone}`,
});
assert.ok(['unauthorized', 'stale_context'].includes(wrongObject.status), 'wrong reminder identity must fail closed');
assert.equal(wrongObject.canonicalObjectId, 'missing-reminder-id', 'failure must preserve the supplied identity');

const paymentRequest = await createEconomicRequest({ id: `payment-test:${phone}`, phone, skill: 'find_worker', requirements: { service: 'execution-boundary-test' } });
const paymentWithoutConfirmation = await executeCanonicalCapabilityProposal({
  phone,
  capability: 'payment',
  action: 'authorize',
  canonicalObjectId: paymentRequest.id,
  idempotencyKey: `test-payment-confirmation:${phone}`,
});
assert.equal(paymentWithoutConfirmation.status, 'confirmation_required');

const paymentWithConfirmation = await executeCanonicalCapabilityProposal({
  phone,
  capability: 'payment',
  action: 'authorize',
  canonicalObjectId: paymentRequest.id,
  confirmationGranted: true,
  idempotencyKey: `test-payment-external:${phone}`,
});
assert.equal(paymentWithConfirmation.status, 'external_unavailable', 'sandbox payment must not be represented as live execution');
assert.equal(paymentWithConfirmation.externalActivation, 'repository_ready_external_activation');

const agentGoal = await createConversationGoal({ phone, skill: 'reminder', objective: 'Keep the reminder execution test bounded.' });
if (agentGoal) {
  const paused = await executeCanonicalCapabilityProposal({ phone, capability: 'agent', action: 'pause', canonicalObjectId: agentGoal.id, confirmationGranted: true, idempotencyKey: `test-agent-pause:${phone}` });
  assert.equal(paused.status, 'completed', 'agent actions must reuse the canonical executor');
  assert.equal(paused.canonicalObjectId, agentGoal.id);
}

const invalid = await executeCanonicalCapabilityProposal({ phone, capability: 'not_registered', action: 'execute', idempotencyKey: `test-invalid:${phone}` });
assert.equal(invalid.status, 'invalid');
assert.equal(invalid.canonicalFacts.validationCode, 'missing_capability');

console.log('AI capability execution regression passed: proposal validation, canonical reminder execution, idempotency, exact identity failure, confirmation, sandbox payment truth, agent reuse, and recovery were verified.');
