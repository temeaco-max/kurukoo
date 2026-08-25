import crypto from 'node:crypto';
import { getCanonicalStore } from './canonicalStore.js';
import { getAgentGoal, notifyGoalIfNeeded } from './agentRuntime.js';
import { resolveCapabilityActionForSkill } from './capabilityExecutionPlanService.js';
import { executeCanonicalCapabilityProposal } from './canonicalCapabilityExecutor.js';
import { syncAgentGoalFromCapabilityResult } from './agentCapabilityOutcomeService.js';
import { syncSubGoalStatusesWithDependencies } from './agentEconomicRequestOrchestrator.js';
import { evaluateAgentObjective } from './agentObjectiveEvaluator.js';
import { recordAgentExecutionTrace } from './agentExecutionTrace.js';

export type AgentApprovalResult = {
  ok: boolean;
  goal: Awaited<ReturnType<typeof getAgentGoal>>;
  outcome?: Awaited<ReturnType<typeof executeCanonicalCapabilityProposal>>;
  message: string;
};

/**
 * Explicit human checkpoint continuation. This service owns only the
 * approval transition; the canonical capability executor remains the sole
 * action executor and the canonical Agent Goal remains the durable state.
 */
export async function approveAgentGoal(input: {
  phone: string;
  goalId: string;
  action?: string;
  arguments?: Record<string, unknown>;
}): Promise<AgentApprovalResult> {
  const goal = await getAgentGoal(input.phone, input.goalId);
  if (!goal) return { ok: false, goal: null, message: 'Goal not found.' };
  if (goal.status !== 'needs_user') return { ok: false, goal, message: `This goal is ${goal.status}; it is not waiting for approval.` };
  if (goal.autonomy !== 'act_with_confirmation' && !goal.plan.confirmationRequired) return { ok: false, goal, message: 'This goal does not have an approval checkpoint.' };

  const proposal = resolveCapabilityActionForSkill(goal.goalType, input.action);
  if (!proposal) {
    const blocked = await markApprovalBlocked(input.phone, goal, 'No executable canonical capability action is available for this goal.');
    return { ok: false, goal: blocked, message: blocked?.summary || 'No executable capability is available.' };
  }

  const idempotencyKey = `agent-approval:${goal.id}:${goal.updatedAt}:${proposal.capability}:${proposal.action}`;
  const executionId = crypto.randomUUID();
  await recordAgentExecutionTrace({
    ownerPhone: input.phone,
    goalId: goal.id,
    conversationId: goal.conversationId,
    kind: 'authorization',
    actor: 'user',
    status: 'satisfied',
    reason: 'Explicit user approval received for consequential Agent Goal action.',
    tool: 'approve_agent_goal',
    metadata: { executionId, capability: proposal.capability, action: proposal.action },
  });

  const outcome = await executeCanonicalCapabilityProposal({
    capability: proposal.capability,
    action: proposal.action,
    arguments: { ...(proposal.arguments || {}), ...(input.arguments || {}) },
    phone: input.phone,
    conversationId: goal.conversationId,
    canonicalObjectId: goal.id,
    contextId: goal.conversationId ? `goal:${goal.id}` : undefined,
    confirmationGranted: true,
    confirmationRequired: true,
    idempotencyKey,
  });

  await recordAgentExecutionTrace({
    ownerPhone: input.phone,
    goalId: goal.id,
    conversationId: goal.conversationId,
    kind: 'tool_call',
    actor: 'agentRuntime',
    status: outcome.status === 'completed' ? 'completed' : outcome.status,
    tool: 'execute_capability',
    reason: outcome.message,
    evidence: outcome.evidenceLevel,
    metadata: { executionId, capability: proposal.capability, action: proposal.action, idempotencyKey, outcomeStatus: outcome.status },
  });

  await syncAgentGoalFromCapabilityResult({
    phone: input.phone,
    goalId: goal.id,
    capability: proposal.capability,
    action: proposal.action,
    idempotencyKey,
    outcome,
  });

  let updated = await getAgentGoal(input.phone, goal.id);
  if (!updated) return { ok: false, goal: null, outcome, message: 'Goal disappeared after execution; no replacement state was created.' };

  if (['completed', 'blocked', 'failed'].includes(updated.status) && updated.parentGoalId) {
    await syncSubGoalStatusesWithDependencies(input.phone, updated.parentGoalId);
    updated = (await getAgentGoal(input.phone, goal.id)) || updated;
  }

  const quality = await evaluateAgentObjective({
    ownerPhone: input.phone,
    goalId: goal.id,
    objective: goal.objective,
    planPresent: Boolean(goal.plan.steps.length),
    capabilityAllowed: outcome.status !== 'unauthorized' && outcome.status !== 'invalid',
    authorizationSatisfied: true,
    dependenciesSatisfied: true,
    evidenceRequired: true,
  });

  await recordAgentExecutionTrace({
    ownerPhone: input.phone,
    goalId: goal.id,
    conversationId: goal.conversationId,
    kind: 'outcome',
    actor: 'agentQualityGate',
    status: quality.verdict,
    reason: quality.reasons.join(', '),
    metadata: { executionId, traceCount: quality.traceCount, evidencePresent: quality.evidencePresent, externallyVerified: quality.externallyVerified },
  });

  if (quality.verdict === 'pass' && updated.status !== 'completed') {
    const store = await getCanonicalStore();
    await store.run('UPDATE agent_goals SET status=?,completed_at=CURRENT_TIMESTAMP,next_action_at=NULL,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?', [
      'completed',
      outcome.message || 'Kurukoo verified the approved action outcome.',
      goal.id,
      input.phone,
    ]);
    updated = (await getAgentGoal(input.phone, goal.id)) || updated;
  }

  if (updated.status === 'completed') await notifyGoalIfNeeded(updated);
  return { ok: outcome.status === 'completed' && quality.verdict === 'pass', goal: updated, outcome, message: quality.verdict === 'pass' ? 'Approved action executed and verified.' : quality.reasons.join(', ') || outcome.message || 'Approved action did not pass verification.' };
}

async function markApprovalBlocked(phone: string, goal: NonNullable<Awaited<ReturnType<typeof getAgentGoal>>>, summary: string) {
  const store = await getCanonicalStore();
  await store.run('UPDATE agent_goals SET status=?,summary=?,failure_reason=?,next_action_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?', ['blocked', summary, 'approval_capability_unavailable', goal.id, phone]);
  return getAgentGoal(phone, goal.id);
}
