/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-capability-interaction-policy-${process.pid}-${Date.now()}.sqlite`;
const { deriveInteractionPolicyForCapabilityName, getAllCapabilityInteractionPolicies } = await import('../src/services/capabilityInteractionPolicyService.js');

const policies = await getAllCapabilityInteractionPolicies();
if (policies.length < 200) throw new Error(`Expected the universal catalog to expose at least 200 capabilities; got ${policies.length}`);

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

for (const policy of policies) {
  assert(Boolean(policy.capability), 'Every interaction policy must identify its capability');
  assert(policy.resumable, `${policy.capability}: every capability must preserve a resumable conversation boundary`);
  assert(policy.failureMustPreserveContext, `${policy.capability}: failures must preserve context`);
  if (policy.exactIdentityRequired) {
    assert(policy.authentication === 'required_before_action' || policy.guestAccess === 'allowed_for_initial_help', `${policy.capability}: exact-identity actions must have an auth rule`);
  }
  if (policy.priority === 'critical') {
    assert(policy.interruption === 'immediate', `${policy.capability}: critical capabilities must interrupt immediately`);
    assert(policy.preemptsOtherGoals, `${policy.capability}: critical capabilities must preempt unrelated goals`);
    assert(policy.preservesPriorGoals, `${policy.capability}: critical interruption must preserve prior goals for later resumption`);
  }
  if (policy.confirmation === 'explicit') {
    assert(policy.exactIdentityRequired, `${policy.capability}: explicit confirmation actions must identify their canonical target exactly`);
  }
  if (policy.autonomy === 'long_running') {
    assert(policy.backgroundAllowed, `${policy.capability}: long-running capabilities must be background-capable`);
  }
  if (policy.voiceMode === 'preferred' || policy.voiceMode === 'required') {
    assert(policy.externalEvidenceRequired || policy.capability.includes('voice') || policy.capability.includes('emergency') || policy.capability.includes('safety'), `${policy.capability}: voice-preferred actions need an explicit evidence boundary`);
  }
}

const reminders = policies.filter(policy => /reminder/i.test(policy.capability));
for (const policy of reminders) {
  assert(policy.interruption === 'at_trigger', `${policy.capability}: reminders must be interruptible at trigger time`);
  assert(policy.backgroundAllowed, `${policy.capability}: reminders must support background operation`);
  assert(policy.resumable, `${policy.capability}: reminders must preserve the interrupted conversation`);
}

const agents = policies.filter(policy => /agent/i.test(policy.capability));
for (const policy of agents) {
  assert(policy.autonomy === 'long_running', `${policy.capability}: first-class agents must be long-running`);
  assert(policy.backgroundAllowed, `${policy.capability}: agents must support background operation`);
  assert(policy.exactIdentityRequired, `${policy.capability}: agent actions require exact goal identity`);
}

const payment = policies.filter(policy => /payment|escrow|checkout|subscription/i.test(policy.capability));
for (const policy of payment) {
  assert(policy.confirmation === 'explicit', `${policy.capability}: economic actions require explicit confirmation`);
  assert(policy.exactIdentityRequired, `${policy.capability}: economic actions require exact identity`);
}

const remote = policies.filter(policy => /remote|device|linked_device|voice|webrtc|call|dial/i.test(policy.capability));
for (const policy of remote) {
  assert(policy.exactIdentityRequired, `${policy.capability}: remote/device actions require exact identity`);
}

const memory = policies.filter(policy => /memory/i.test(policy.capability));
for (const policy of memory) assert(policy.confirmation === 'explicit', `${policy.capability}: memory persistence/deletion must be explicit`);

const emergency = deriveInteractionPolicyForCapabilityName('emergency.dispatch', {
  family: 'safety',
  mode: 'external_execution',
  actions: ['assess', 'dial', 'connect'],
  risk: 'high_risk',
  activationState: 'repository_ready_external_activation',
});
assert(emergency.priority === 'critical', 'emergency must be critical');
assert(emergency.interruption === 'immediate', 'emergency must interrupt immediately');
assert(emergency.guestAccess === 'allowed_for_initial_help', 'emergency initial assistance must be guest-accessible');
assert(emergency.authentication === 'after_initial_help', 'emergency auth must not block initial assistance');
assert(emergency.preemptsOtherGoals && emergency.preservesPriorGoals, 'emergency must preempt while preserving previous goals');
assert(emergency.voiceMode === 'preferred', 'emergency should prefer live voice when available');

const remoteControl = deriveInteractionPolicyForCapabilityName('remote.device.control', {
  family: 'device-control',
  mode: 'external_execution',
  actions: ['select_device', 'execute'],
  risk: 'confirmation_required',
  activationState: 'repository_ready_external_activation',
});
assert(remoteControl.exactIdentityRequired && remoteControl.authentication === 'required_before_action', 'remote control must require exact authorized identity');
assert(remoteControl.confirmation === 'explicit', 'remote control must require explicit confirmation for state-changing actions');

const reminderVirtual = deriveInteractionPolicyForCapabilityName('reminder.create', {
  family: 'native-assistance',
  mode: 'state_change',
  actions: ['create', 'update', 'cancel', 'open'],
  risk: 'low_risk',
});
assert(reminderVirtual.interruption === 'at_trigger' && reminderVirtual.backgroundAllowed, 'reminders must support trigger-time interruption and background operation');

const subscription = deriveInteractionPolicyForCapabilityName('subscription.change', {
  family: 'account',
  mode: 'state_change',
  actions: ['inspect', 'change'],
  risk: 'confirmation_required',
});
assert(subscription.confirmation === 'explicit' && subscription.exactIdentityRequired, 'subscription changes require explicit confirmation and exact identity');

console.log(JSON.stringify({
  ok: true,
  capabilityCount: policies.length,
  reminderCount: reminders.length,
  agentCount: agents.length,
  paymentCount: payment.length,
  remoteCount: remote.length,
  memoryCount: memory.length,
  criticalCount: policies.filter(policy => policy.priority === 'critical').length,
  virtualProfiles: ['emergency.dispatch', 'remote.device.control', 'reminder.create', 'subscription.change'],
}, null, 2));
