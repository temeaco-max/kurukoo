import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolatedDbPath = path.join(os.tmpdir(), `kurukoo-objective-outcome-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = isolatedDbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'true';
process.env.KURUKOO_AGENT_COOLDOWN_SECONDS = '5';
process.on('exit', () => { try { fs.rmSync(isolatedDbPath, { force: true }); } catch {} });

const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { listSubGoals, getAgentGoal, resumeAgentGoal, runDueAgentGoals, createConversationGoal } = await import('../src/services/agentRuntime.js');
const { syncSubGoalStatusesWithDependencies } = await import('../src/services/agentEconomicRequestOrchestrator.js');
const { listAgentExecutionTrace, recordAgentExecutionTrace } = await import('../src/services/agentExecutionTrace.js');
const { syncAgentGoalFromCapabilityResult } = await import('../src/services/agentCapabilityOutcomeService.js');
const { closeCanonicalStore } = await import('../src/services/canonicalStore.js');

async function completeWithVerifiedFakeProviderOutcome(input: { phone: string; goalId: string; capability: string; action: string; message: string; evidence: string }): Promise<Awaited<ReturnType<typeof getAgentGoal>>> {
  for (let index = 0; index < 4; index++) {
    await syncAgentGoalFromCapabilityResult({
      phone: input.phone,
      goalId: input.goalId,
      capability: input.capability,
      action: input.action,
      idempotencyKey: `${input.goalId}:verified-fake-provider:${index}`,
      outcome: { status: 'completed', capability: input.capability, action: input.action, message: input.message, evidence: input.evidence },
    });
    const current = await getAgentGoal(input.phone, input.goalId);
    if (current?.status !== 'active') return current;
  }
  return getAgentGoal(input.phone, input.goalId);
}

const owner = `+234702${String(Date.now()).slice(-7)}`;
const conversationId = `objective-loop-${Date.now()}`;
const objective = 'Fix my laptop and sell it when it is ready';
await upsertProfile(owner, 'Objective Loop Tester');

const chat = await processCanonicalChatTurn({ phone: owner, message: objective, channel: 'web', conversationId });
assert.ok(chat.agentGoal, 'The exact compound objective must materialize from authenticated Chat without an extra monitoring phrase.');
assert.match(chat.reply, /dependent objective|existing objective/i, 'Compound Chat entry must project its canonical dependency state rather than generic context clarification.');
assert.match(chat.reply, /No provider, payment, repair, or sale has been claimed|without claiming any provider, payment, repair, or sale outcome/i, 'Compound Chat entry must remain truthful about external outcome boundaries.');
const canonicalConversationId = chat.conversationId;
assert.ok(canonicalConversationId, 'The canonical Chat turn must return a durable conversation identifier.');
assert.equal(chat.agentGoal!.conversationId, canonicalConversationId, 'The parent Goal must preserve the canonical originating conversation correlation.');
const parent = chat.agentGoal!;
const children = await listSubGoals(owner, parent.id);
assert.equal(children.length, 2, 'Compound objective must create repair and dependent-sale child Goals.');
const repair = children.find(goal => /fix|repair/i.test(goal.objective));
const sale = children.find(goal => /sell/i.test(goal.objective));
assert.ok(repair && sale, 'The compound children must retain repair and sale objectives.');
assert.equal(sale!.status, 'waiting_on_dependency', 'Sale must wait until the repair Goal genuinely completes.');

const repaired = await completeWithVerifiedFakeProviderOutcome({
  phone: owner,
  goalId: repair!.id,
  capability: 'skill.phone_repairer',
  action: 'prepare_action',
  message: 'Fake provider reports the laptop repair completed for deterministic lifecycle proof.',
  evidence: 'verified fake-provider repair receipt for deterministic lifecycle proof',
});
assert.equal(repaired?.status, 'completed', 'A child Goal may complete only after its verified fake-provider evidence is recorded.');
await syncSubGoalStatusesWithDependencies(owner, parent.id);
assert.equal((await getAgentGoal(owner, sale!.id))?.status, 'active', 'The dependent sale Goal must activate only after valid repair completion.');

await syncAgentGoalFromCapabilityResult({
  phone: owner,
  goalId: sale!.id,
  capability: 'skill.find_worker',
  action: 'prepare_sale',
  idempotencyKey: `${sale!.id}:await-user`,
  outcome: {
    status: 'confirmation_required',
    capability: 'skill.find_worker',
    action: 'prepare_sale',
    message: 'A sale would be consequential, so Kurukoo needs your explicit approval before it can continue.',
  },
});
const waitingForUser = await getAgentGoal(owner, sale!.id);
assert.equal(waitingForUser?.status, 'needs_user', 'A consequential dependent Goal must become needs_user rather than claim a sale.');
assert.equal(waitingForUser?.nextActionAt, undefined, 'needs_user Goals must not remain automatically scheduled.');
assert.ok(!(await runDueAgentGoals()).some(goal => goal.id === sale!.id), 'The worker must not retry needs_user Goals automatically.');
const resumed = await resumeAgentGoal(owner, sale!.id);
assert.equal(resumed?.id, sale!.id, 'User resume must preserve the same durable Goal instead of creating a duplicate objective.');
assert.equal(resumed?.status, 'needs_user', 'Resuming a consequential Goal without new permission must remain truthful about its checkpoint.');

const sold = await completeWithVerifiedFakeProviderOutcome({
  phone: owner,
  goalId: sale!.id,
  capability: 'skill.find_worker',
  action: 'prepare_action',
  message: 'Fake provider reports the laptop sale completed for deterministic lifecycle proof.',
  evidence: 'verified fake-provider sale receipt for deterministic lifecycle proof',
});
assert.equal(sold?.status, 'completed', 'The sale child may complete only after verified evidence is recorded.');
await syncSubGoalStatusesWithDependencies(owner, parent.id);
assert.equal((await getAgentGoal(owner, parent.id))?.status, 'completed', 'The parent must complete only after every required child truly completes.');

const trace = await listAgentExecutionTrace(owner, sale!.id);
assert.ok(trace.some(event => event.kind === 'capability_execution'), 'Capability results must add a durable capability-execution trace event.');
assert.ok(trace.some(event => event.kind === 'outcome' && event.status === 'confirmation_required'), 'The human checkpoint must be represented in the durable outcome trace.');
assert.ok(trace.every(event => event.ownerPhone === owner && event.goalId === sale!.id), 'Goal trace must stay owner- and Goal-scoped.');
assert.ok(trace.some(event => event.conversationId === canonicalConversationId), 'Goal trace must retain the originating conversation correlation.');

const createExternalProjection = async (suffix: string, evidence?: string) => {
  const goal = await createConversationGoal({ phone: owner, conversationId: `outcome-${suffix}`, skill: 'reminder', objective: `Record ${suffix} external repair outcome`, source: 'conversation', persistWhenDisabled: true });
  assert.ok(goal, 'Capability outcome fixture Goal must be created.');
  for (let index = 0; index < 4; index++) {
    await syncAgentGoalFromCapabilityResult({
      phone: owner,
      goalId: goal!.id,
      capability: 'skill.reminder',
      action: 'create',
      idempotencyKey: `${goal!.id}:${suffix}:${index}`,
      outcome: {
        status: 'completed',
        capability: 'skill.reminder',
        action: 'create',
        message: 'Fake provider reports the laptop repair completed for deterministic lifecycle proof.',
        evidence,
      },
    });
    const current = await getAgentGoal(owner, goal!.id);
    if (current?.status !== 'active') return { goal: current!, goalId: goal!.id };
  }
  return { goal: (await getAgentGoal(owner, goal!.id))!, goalId: goal!.id };
};

const unverified = await createExternalProjection('unverified');
assert.equal(unverified.goal.status, 'blocked', 'An external completion result without verified evidence must never complete a Goal.');
assert.equal(unverified.goal.failureReason, 'verified_external_evidence_required', 'The blocked external result must persist its exact truthful reason.');
const unverifiedTrace = await listAgentExecutionTrace(owner, unverified.goalId);
assert.ok(unverifiedTrace.some(event => event.kind === 'quality_evaluated' && event.status !== 'pass'), 'Unverified capability completion must be evaluated and rejected by the quality gate.');

const verified = await createExternalProjection('verified', 'verified fake-provider repair receipt');
assert.equal(verified.goal.status, 'completed', 'A verified fake-provider capability outcome may pass the canonical quality gate.');
const verifiedTrace = await listAgentExecutionTrace(owner, verified.goalId);
assert.ok(verifiedTrace.some(event => event.kind === 'quality_evaluated' && event.status === 'pass'), 'Verified capability completion must have a durable passing quality decision.');
assert.ok(verifiedTrace.some(event => event.metadata?.executionId), 'Capability outcome trace must retain a durable execution correlation id.');

await closeCanonicalStore();
assert.equal((await getAgentGoal(owner, parent.id))?.status, 'completed', 'The completed parent must reload from durable canonical persistence after store recovery.');
assert.equal((await getAgentGoal(owner, sale!.id))?.id, sale!.id, 'The child Goal must remain durable and resumable after store recovery.');

console.log('Objective-to-execution-to-outcome lifecycle regression passed: direct Chat compound entry, bounded evidence-gated completion, dependency activation, needs_user checkpoint, canonical trace correlation, and durable recovery.');
