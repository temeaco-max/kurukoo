import { getCanonicalStore } from './canonicalStore.js';

export type CanonicalCapabilityOutcome = {
  status: string;
  capability?: string;
  action?: string;
  canonicalObjectId?: string;
  continuationContext?: Record<string, unknown>;
  nextActions?: Array<{ action: string; label: string; confirmationRequired?: boolean }>;
  canonicalFacts?: Record<string, unknown>;
  message?: string;
  evidence?: string;
  executablePlan?: unknown;
};

type GoalPlanStep = {
  id: string;
  action: string;
  tool: string;
  risk?: string;
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'blocked' | 'failed';
  authorization?: string;
  idempotencyKey?: string;
  evidence?: string;
  result?: string;
};

function mapOutcome(status: string): 'success' | 'waiting' | 'needs_user' | 'blocked' | 'failed' {
  if (status === 'completed') return 'success';
  if (status === 'waiting' || status === 'externally_pending') return 'waiting';
  if (status === 'needs_user' || status === 'confirmation_required') return 'needs_user';
  if (status === 'blocked' || status === 'unauthorized') return 'blocked';
  return 'failed';
}

function mapStepStatus(status: string): GoalPlanStep['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'waiting' || status === 'externally_pending') return 'waiting';
  if (status === 'needs_user' || status === 'confirmation_required') return 'waiting';
  if (status === 'blocked' || status === 'unauthorized') return 'blocked';
  if (status === 'failed' || status === 'invalid') return 'failed';
  return 'running';
}

function goalStatus(status: string, plan: GoalPlanStep[], currentIndex: number): 'active' | 'waiting' | 'needs_user' | 'blocked' | 'completed' | 'failed' {
  if (status === 'blocked' || status === 'unauthorized') return 'blocked';
  if (status === 'failed' || status === 'invalid') return 'failed';
  if (status === 'needs_user' || status === 'confirmation_required') return 'needs_user';
  const pending = plan.some((step, index) => index > currentIndex && ['pending', 'running', 'waiting'].includes(step.status));
  if (status === 'completed') return pending ? 'active' : 'completed';
  if (status === 'waiting' || status === 'externally_pending') return 'waiting';
  return 'active';
}

/**
 * Reconciles one canonical capability result into the persisted first-class
 * Agent Goal. This is deliberately a projection over existing Agent state,
 * not a second Agent runtime or execution authority.
 */
export async function syncAgentGoalFromCapabilityResult(input: {
  phone: string;
  goalId: string;
  capability: string;
  action: string;
  idempotencyKey?: string;
  outcome: CanonicalCapabilityOutcome;
}): Promise<void> {
  if (!input.goalId || !input.phone) return;
  const store = await getCanonicalStore();
  const goalRow = await store.one<any>('SELECT * FROM agent_goals WHERE id = ? AND phone = ? LIMIT 1', [input.goalId, input.phone]);
  if (!goalRow) return;

  let plan: { objective?: string; currentStep?: number; status?: string; executablePlan?: unknown; lastCanonicalCapabilityOutcome?: unknown; steps?: GoalPlanStep[] } = {};
  try { plan = goalRow.plan_json ? JSON.parse(String(goalRow.plan_json)) : {}; } catch { plan = {}; }
  const steps = Array.isArray(plan.steps) ? plan.steps.map(step => ({ ...step })) : [];
  const capabilityKey = `${input.capability}:${input.action}`.toLowerCase();
  let stepIndex = steps.findIndex(step => String(step.action || '').toLowerCase().includes(capabilityKey) || String(step.action || '').toLowerCase().includes(input.action.toLowerCase()));
  if (stepIndex < 0) stepIndex = steps.findIndex(step => ['pending', 'running', 'waiting'].includes(step.status));
  if (stepIndex < 0 && input.outcome.status !== 'completed') stepIndex = Math.max(0, Number(plan.currentStep || 0));

  const projectedStepStatus = mapStepStatus(input.outcome.status);
  if (stepIndex >= 0) {
    steps[stepIndex] = {
      ...steps[stepIndex],
      status: projectedStepStatus,
      evidence: input.outcome.evidence || steps[stepIndex].evidence,
      result: (input.outcome.message || `Capability ${input.capability}:${input.action} returned ${input.outcome.status}`).slice(0, 1200),
    };
  }

  const nextStep = stepIndex >= 0 && projectedStepStatus === 'completed' ? Math.min(steps.length, stepIndex + 1) : Math.max(0, stepIndex);
  const status = goalStatus(input.outcome.status, steps, nextStep - 1);
  const nextActionAt = status === 'active' || status === 'waiting' ? new Date(Date.now() + 30000).toISOString() : null;
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  const failureReason = ['failed', 'blocked'].includes(status) ? String(input.outcome.message || input.outcome.status).slice(0, 1000) : null;
  const summary = String(input.outcome.message || `Capability ${input.capability}:${input.action} returned ${input.outcome.status}.`).slice(0, 1000);
  plan.steps = steps;
  plan.currentStep = nextStep;
  plan.status = status;
  plan.executablePlan = input.outcome.executablePlan ?? plan.executablePlan;
  plan.lastCanonicalCapabilityOutcome = {
    status: input.outcome.status,
    capability: input.outcome.capability,
    action: input.outcome.action,
    canonicalObjectId: input.outcome.canonicalObjectId,
    continuationContext: input.outcome.continuationContext,
    nextActions: input.outcome.nextActions,
    canonicalFacts: input.outcome.canonicalFacts,
  };

  await store.run(
    `UPDATE agent_goals SET status=?,next_action_at=?,completed_at=?,failure_reason=?,summary=?,plan_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`,
    [status, nextActionAt, completedAt, failureReason, summary, JSON.stringify(plan), input.goalId, input.phone],
  );

  const eventKey = input.idempotencyKey ? `agent-outcome:${input.goalId}:${input.idempotencyKey}` : `agent-outcome:${input.goalId}:${input.capability}:${input.action}:${input.outcome.status}:${stepIndex}`;
  const existing = await store.one<any>('SELECT id FROM agent_goal_events WHERE idempotency_key = ? LIMIT 1', [eventKey]);
  if (!existing) {
    await store.run('INSERT INTO agent_goal_events (goal_id, action, tool, result, evidence, detail, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      input.goalId,
      `${input.capability}:${input.action}`,
      'execute_capability',
      mapOutcome(input.outcome.status),
      input.outcome.evidence || `canonical_capability:${input.capability}:${input.action}:${input.outcome.status}`,
      summary,
      eventKey,
    ]);
  }

  if (['needs_user', 'blocked', 'completed'].includes(status)) {
    try {
      const runtime = await import('./agentRuntime.js');
      const updated = await runtime.getAgentGoal(input.phone, input.goalId);
      if (updated?.parentGoalId && ['blocked', 'failed', 'completed'].includes(status)) {
        await import('./agentEconomicRequestOrchestrator.js').then(({ syncSubGoalStatusesWithDependencies }) => syncSubGoalStatusesWithDependencies(input.phone, updated.parentGoalId!));
      }
      if (updated) await runtime.notifyGoalIfNeeded(updated);
    } catch {
      // Notification/dependency projection failure must never roll back canonical goal state.
    }
  }
}
