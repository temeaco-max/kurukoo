/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-interaction-policy-${process.pid}-${Date.now()}.sqlite`;
const { resolveConversationPriority } = await import('../src/services/conversationPriorityService.js');
const { deriveInteractionPolicyForCapabilityName, getAllCapabilityInteractionPolicies } = await import('../src/services/capabilityInteractionPolicyService.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { executeCanonicalCapabilityProposal } = await import('../src/services/canonicalCapabilityExecutor.js');
const { updateProfile, recordMemoryFact, getMemoryFacts } = await import('../src/services/memoryProfile.js');

process.env.NODE_ENV = 'test';
process.env.MEMORY_ENCRYPTION_KEY ||= 'interaction-policy-matrix-test-key';
process.env.KURUKOO_AI_HOSTED_PROVIDER = 'none';

const guest = `anon_interaction_policy_${process.pid}`;
const owner = '+2348090000099';

const policies = await getAllCapabilityInteractionPolicies();
assert.ok(policies.length >= 200, `expected the canonical capability catalogue, got ${policies.length}`);
for (const policy of policies) {
  assert.ok(policy.resumable, `${policy.capability} must preserve a resumable boundary`);
  assert.ok(policy.failureMustPreserveContext, `${policy.capability} failures must preserve context`);
  if (policy.priority === 'critical') {
    assert.equal(policy.interruption, 'immediate', `${policy.capability} critical policy must interrupt immediately`);
    assert.equal(policy.guestAccess, 'allowed_for_initial_help', `${policy.capability} critical initial help must be guest-accessible`);
    assert.equal(policy.authentication, 'after_initial_help', `${policy.capability} critical auth must follow initial help`);
  }
}

const emergencyPriority = resolveConversationPriority("Help me, it's an emergency");
assert.equal(emergencyPriority.kind, 'emergency');
assert.equal(emergencyPriority.capability, 'safety');
assert.equal(emergencyPriority.policy.priority, 'critical');
assert.equal(emergencyPriority.guestAllowedForInitialHandling, true);
assert.equal(emergencyPriority.requiresAuthenticationBeforeAction, false);

const securityPriority = resolveConversationPriority('My phone was stolen');
assert.equal(securityPriority.kind, 'security');
assert.equal(securityPriority.guestAllowedForInitialHandling, true);
assert.equal(securityPriority.requiresAuthenticationBeforeAction, true);

const freshEmergency = await processCanonicalChatTurn({ phone: guest, message: "Help me, it's an emergency.", channel: 'web' });
assert.equal(freshEmergency.interactionPolicy?.kind, 'emergency');
assert.equal(freshEmergency.interactionPolicy?.policy.guestAccess, 'allowed_for_initial_help');
assert.equal(freshEmergency.cardData?.type, 'emergency');
assert.ok(!/name|phone|otp|sign[- ]?in/i.test(freshEmergency.reply), 'critical guest help must not be wrapped in onboarding');
assert.ok(/112|emergency|danger/i.test(freshEmergency.reply));

const ambulance = await processCanonicalChatTurn({ phone: guest, message: 'I need an ambulance.', channel: 'web', conversationId: freshEmergency.conversationId });
assert.equal(ambulance.interactionPolicy?.kind, 'emergency');
assert.equal(ambulance.cardData?.service?.officialNumber || ambulance.cardData?.service?.emergencyNumber, '112');
assert.ok(!/dispatched|connected|on the way/i.test(ambulance.reply));

await updateProfile(owner, 'interaction-policy-matrix', { name: 'Policy Owner', preferences: { onboarding_complete: true } });
const authenticatedEmergency = await processCanonicalChatTurn({ phone: owner, message: 'I need the police.', channel: 'web' });
assert.equal(authenticatedEmergency.interactionPolicy?.kind, 'emergency');
assert.equal(authenticatedEmergency.cardData?.service?.serviceType, 'police');
assert.equal(authenticatedEmergency.cardData?.service?.officialNumber || authenticatedEmergency.cardData?.service?.emergencyNumber, '112');

const guestSecurity = await processCanonicalChatTurn({ phone: `anon_security_${process.pid}`, message: 'My phone was stolen.', channel: 'web' });
assert.equal(guestSecurity.interactionPolicy?.kind, 'security');
assert.equal(guestSecurity.cardData?.type, 'security_interruption');
assert.ok(/do not share|secure the device|SIM/i.test(guestSecurity.reply));
assert.ok(/authenticated ownership|explicit confirmation/i.test(guestSecurity.reply));
const paymentSecurity = await processCanonicalChatTurn({ phone: owner, message: "I don't recognize this payment.", channel: 'web' });
assert.equal(paymentSecurity.interactionPolicy?.kind, 'security');
assert.equal(paymentSecurity.cardData?.canonicalAction, 'security.assess');

const paymentDiscussion = deriveInteractionPolicyForCapabilityName('payment', { family: 'payment', mode: 'external_execution', actions: ['inspect', 'pay'], risk: 'high_risk', activationState: 'repository_ready_external_activation' });
assert.equal(paymentDiscussion.confirmation, 'explicit');
assert.equal(paymentDiscussion.exactIdentityRequired, true);
const paymentBoundary = await executeCanonicalCapabilityProposal({ phone: owner, capability: 'payment', action: 'pay', arguments: { amount: 1000 }, idempotencyKey: `policy-payment-${process.pid}`, conversationId: authenticatedEmergency.conversationId });
assert.ok(['external_unavailable', 'invalid', 'unauthorized'].includes(paymentBoundary.status));
assert.notEqual(paymentBoundary.status, 'completed');

const remotePolicy = deriveInteractionPolicyForCapabilityName('remote.device.control', { family: 'device-control', mode: 'external_execution', actions: ['select_device', 'execute'], risk: 'confirmation_required', activationState: 'repository_ready_external_activation' });
assert.equal(remotePolicy.exactIdentityRequired, true);
assert.equal(remotePolicy.confirmation, 'explicit');
const remoteBoundary = await executeCanonicalCapabilityProposal({ phone: owner, capability: 'remote.device.control', action: 'execute', arguments: { command: 'turn_off' }, idempotencyKey: `policy-remote-${process.pid}`, conversationId: authenticatedEmergency.conversationId });
assert.notEqual(remoteBoundary.status, 'completed');

const memoryPolicy = deriveInteractionPolicyForCapabilityName('memory', { family: 'memory', mode: 'state_change', actions: ['remember', 'forget'], risk: 'confirmation_required' });
assert.equal(memoryPolicy.confirmation, 'explicit');
await recordMemoryFact(owner, 'preference', 'mornings', 'user_declared', { sourceRef: `test:interaction-policy:${process.pid}` });
const facts = await getMemoryFacts(owner, ['preference']);
assert.ok(facts.some(fact => fact.value === 'mornings'));

const reminderPolicy = deriveInteractionPolicyForCapabilityName('reminder.create', { family: 'native-assistance', mode: 'state_change', actions: ['create', 'update', 'cancel', 'open'], risk: 'low_risk' });
assert.equal(reminderPolicy.interruption, 'at_trigger');
assert.equal(reminderPolicy.backgroundAllowed, true);

const publicPolicy = deriveInteractionPolicyForCapabilityName('public.publish', { family: 'public-attribution', mode: 'external_execution', actions: ['draft', 'review', 'publish'], risk: 'high_risk', activationState: 'repository_ready_external_activation' });
assert.equal(publicPolicy.confirmation, 'explicit');
assert.equal(publicPolicy.draftVsCommitRequired, true);

console.log(JSON.stringify({
  ok: true,
  policyCount: policies.length,
  guestEmergency: freshEmergency.interactionPolicy?.kind,
  emergencyNumber: ambulance.cardData?.service?.officialNumber || ambulance.cardData?.service?.emergencyNumber,
  authenticatedEmergencyService: authenticatedEmergency.cardData?.service?.serviceType,
  paymentStatus: paymentBoundary.status,
  remoteStatus: remoteBoundary.status,
  memoryRecorded: facts.some(fact => fact.value === 'mornings'),
  boundaries: ['guest-critical-bypass', 'exact-identity', 'explicit-confirmation', 'external-evidence', 'memory-provenance', 'resumable-context'],
}, null, 2));
