import { getCapabilityActionContract } from './capabilityRegistry.js';
import { getCanonicalStore } from './canonicalStore.js';
import { recordAgentExecutionTrace } from './agentExecutionTrace.js';
import { evaluateAgentObjective } from './agentObjectiveEvaluator.js';

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

type PersistedGoalStatus = 'active' | 'waiting' | 'needs_user' | 'blocked' | 'completed' | 'failed';

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

function goalStatus(status: string, plan: GoalPlanStep[], currentIndex: number): PersistedGoalStatus {
  if (status === 'blocked' || status === 'unauthorized') return 'blocked';
  if (status === 'failed' || status === 'invalid') return 'failed';
  if (status === 'needs_user' || status === 'confirmation_required') return 'needs_user';
  const pending = plan.some((step, index) => index > currentIndex && ['pending', 'running', 'waiting'].includes(step.status));
  if (status === 'completed') return pending ? 'active' : 'completed';
  if (status === 'waiting' || status === 'externally_pending') return 'waiting';
  return 'active';
}

function qualityMappedStatus(verdict: 'pass' | 'needs_user' | 'blocked' | 'fail', reasons: string[]): PersistedGoalStatus {
  if (verdict === 'pass') return 'completed';
  if (reasons.includes('external_outcome_not_verified')) return 'blocked';
  if (verdict === 'needs_user') return 'needs_user';
  if (verdict === 'blocked') return 'blocked';
  return 'failed';
}

function externalCompletionRequiresEvidence(capability: string, action: string, outcome: CanonicalCapabilityOutcome): boolean {
  const contract = getCapabilityActionContract(capability, action);
  if (contract && contract.activationState !== 'locally_available') return true;
  const description = `${outcome.status} ${outcome.message || ''} ${outcome.evidence || ''}`;
  return /external|provider|repair(?:ed)?|sold|deliver(?:ed|y)|fulfil(?:led|ment)|payment|settle(?:d|ment)/i.test(description);
}

function verifiedEvidence(outcome: CanonicalCapabilityOutcome): boolean {
  return Boolean(outcome.evidence) && /verified|confirmed|validated/i.test(String(outcome.evidence));
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
  let status = goalStatus(input.outcome.status, steps, nextStep - 1);
  const summary = String(input.outcome.message || `Capability ${input.capability}:${input.action} returned ${input.outcome.status}.`).slice(0, 1000);
  const eventKey = input.idempotencyKey ? `agent-outcome:${input.goalId}:${input.idempotencyKey}` : `agent-outcome:${input.goalId}:${input.capability}:${input.action}:${input.outcome.status}:${stepIndex}`;
  const executionId = input.idempotencyKey || eventKey;
  const requiresEvidence = externalCompletionRequiresEvidence(input.capability, input.action, input.outcome);

  await recordAgentExecutionTrace({
    ownerPhone: input.phone,
    goalId: input.goalId,
    conversationId: goalRow.conversation_id ? String(goalRow.conversation_id) : undefined,
    kind: 'capability_execution',
    actor: 'agentCapabilityOutcomeService',
    status: input.outcome.status,
    capability: input.capability,
    action: input.action,
    canonicalObjectId: input.outcome.canonicalObjectId,
    reason: summary,
    idempotencyKey: `${eventKey}:capability`,
    metadata: { executionId, stepIndex, requiresEvidence },
  });
  if (input.outcome.evidence) {
    await recordAgentExecutionTrace({
      ownerPhone: input.phone,
      goalId: input.goalId,
      conversationId: goalRow.conversation_id ? String(goalRow.conversation_id) : undefined,
      kind: 'evidence',
      actor: 'agentCapabilityOutcomeService',
      status: verifiedEvidence(input.outcome) ? 'verified' : 'recorded',
      capability: input.capability,
      action: input.action,
      canonicalObjectId: input.outcome.canonicalObjectId,
      evidence: String(input.outcome.evidence).slice(0, 1000),
      idempotencyKey: `${eventKey}:evidence`,
      metadata: { executionId },
    });
  }
  await recordAgentExecutionTrace({
    ownerPhone: input.phone,
    goalId: input.goalId,
    conversationId: goalRow.conversation_id ? String(goalRow.conversation_id) : undefined,
    kind: 'outcome',
    actor: 'agentCapabilityOutcomeService',
    status: requiresEvidence ? `external_${input.outcome.status}` : input.outcome.status,
    capability: input.capability,
    action: input.action,
    canonicalObjectId: input.outcome.canonicalObjectId,
    reason: summary,
    evidence: input.outcome.evidence ? String(input.outcome.evidence).slice(0, 1000) : undefined,
    idempotencyKey: `${eventKey}:outcome`,
    metadata: { executionId, requiresEvidence },
  });

  if (status === 'completed') {
    const quality = await evaluateAgentObjective({
      ownerPhone: input.phone,
      goalId: input.goalId,
      objective: String(goalRow.objective || plan.objective || ''),
      planPresent: steps.length > 0,
      capabilityAllowed: true,
      authorizationSatisfied: true,
      dependenciesSatisfied: true,
      evidenceRequired: requiresEvidence,
    });
    await recordAgentExecutionTrace({
      ownerPhone: input.phone,
      goalId: input.goalId,
      conversationId: goalRow.conversation_id ? String(goalRow.conversation_id) : undefined,
      kind: 'quality_evaluated',
      actor: 'agentQualityGate',
      status: quality.verdict,
      capability: input.capability,
      action: input.action,
      reason: quality.reasons.join(',').slice(0, 1000),
      idempotencyKey: `${eventKey}:quality`,
      metadata: { executionId, traceCount: quality.traceCount, evidencePresent: quality.evidencePresent, externallyVerified: quality.externallyVerified },
    });
    status = qualityMappedStatus(quality.verdict, quality.reasons);
  }

  const nextActionAt = status === 'active' || status === 'waiting' ? new Date(Date.now() + 30000).toISOString() : null;
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  const failureReason = ['failed', 'blocked'].includes(status) ? (status === 'blocked' && requiresEvidence && !verifiedEvidence(input.outcome) ? 'verified_external_evidence_required' : summary) : null;
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

  const existing = await store.one<any>('SELECT id FROM agent_goal_events WHERE idempotency_key = ? LIMIT 1', [eventKey]);
  if (!existing) {
    await store.run('INSERT INTO agent_goal_events (goal_id, action, tool, result, evidence, detail, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      input.goalId,
      `${input.capability}:${input.action}`,
      'execute_capability',
      status === 'completed' ? 'success' : mapOutcome(status),
      input.outcome.evidence || `canonical_capability:${input.capability}:${input.action}:${input.outcome.status}`,
      summary,
      eventKey,
    ]);
  }

  if (['needs_user', 'blocked', 'completed', 'failed'].includes(status)) {
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
