import { randomUUID } from 'node:crypto';
import { ensureAgentRuntimeSchema } from './agentRuntime.js';
import { getCanonicalStore } from './canonicalStore.js';
import { executeUserAgentDelegation } from './commercialLedger.js';

export interface DelegatedAgentRunResult {
  success: boolean;
  result: string;
  agentId?: string;
  provider?: string;
  model?: string;
  goalId: string;
  executionPath: 'legacy_compatibility';
}

function planJson(skill: string, task: string): string {
  return JSON.stringify({
    objective: task.slice(0, 1000),
    currentStep: 0,
    status: 'active',
    requiredInputs: [],
    dependencies: [`skill.${skill}`],
    confirmationRequired: true,
    riskLevel: 'user_confirmation_required',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    steps: [{
      id: 'delegated_execution',
      action: `Execute delegated ${skill} work through the canonical Agent Operating Model.`,
      tool: 'execute_capability',
      risk: 'user_confirmation_required',
      status: 'running',
      authorization: 'delegated_agent_compatibility_boundary',
      idempotencyKey: `delegated:${skill}:${task.slice(0, 80)}`,
    }],
  });
}

export async function executeDelegatedAgentWithCanonicalRun(
  ownerPhone: string,
  delegationId: string,
  skill: string,
  task: string,
): Promise<DelegatedAgentRunResult> {
  await ensureAgentRuntimeSchema();
  const store = getCanonicalStore();
  const goalId = `delegated-goal-${randomUUID()}`;
  await store.run(
    `INSERT INTO agent_goals(id,phone,source,goal_type,objective,status,priority,autonomy,plan_json,risk_level,confirmation_required,expires_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      goalId,
      ownerPhone,
      'network',
      'delegated_agent',
      task.slice(0, 1000),
      'active',
      50,
      'assist',
      planJson(skill, task),
      'user_confirmation_required',
      1,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ],
  );

  const startKey = `delegated-run:${goalId}:start`;
  await store.run(
    `INSERT INTO agent_goal_events(goal_id,action,tool,result,detail,idempotency_key)
     VALUES(?,?,?,?,?,?)`,
    [goalId, 'delegated_run_started', 'execute_capability', 'success', `delegation:${delegationId};skill:${skill}`, startKey],
  );

  try {
    const result = await executeUserAgentDelegation(ownerPhone, delegationId, task);
    const terminalStatus = result.success ? 'completed' : 'blocked';
    await store.run(
      `UPDATE agent_goals SET status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`,
      [terminalStatus, terminalStatus, result.result.slice(0, 1000), goalId, ownerPhone],
    );
    const eventKey = `delegated-run:${goalId}:${terminalStatus}`;
    await store.run(
      `INSERT INTO agent_goal_events(goal_id,action,tool,result,detail,idempotency_key)
       VALUES(?,?,?,?,?,?)`,
      [goalId, 'delegated_run_completed', 'execute_capability', result.success ? 'success' : 'blocked', result.result.slice(0, 1200), eventKey],
    );
    return { ...result, goalId, executionPath: 'legacy_compatibility' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Delegated agent execution failed.';
    await store.run(
      `UPDATE agent_goals SET status='failed',failure_reason=?,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`,
      [detail.slice(0, 500), detail.slice(0, 1000), goalId, ownerPhone],
    );
    await store.run(
      `INSERT INTO agent_goal_events(goal_id,action,tool,result,detail,idempotency_key)
       VALUES(?,?,?,?,?,?)`,
      [goalId, 'delegated_run_failed', 'execute_capability', 'failed', detail.slice(0, 1200), `delegated-run:${goalId}:failed`],
    );
    throw error;
  }
}
