import { randomUUID } from 'node:crypto';
import { ensureAgentRuntimeSchema } from './agentRuntime.js';
import { getCanonicalStore } from './canonicalStore.js';
import { executeAgentTool } from './agentToolRegistry.js';
import { getCapabilityRegistration, resolveCapabilityAction } from './capabilityRegistry.js';
import { executeUserAgentDelegation } from './commercialLedger.js';

export interface DelegatedAgentRunResult {
  success: boolean;
  result: string;
  agentId?: string;
  provider?: string;
  model?: string;
  goalId: string;
  executionPath: 'canonical_capability_executor' | 'legacy_compatibility';
}

function planJson(skill: string, task: string, action?: string): string {
  return JSON.stringify({ objective: task.slice(0, 1000), currentStep: 0, status: 'active', requiredInputs: [], dependencies: [`skill.${skill}`], confirmationRequired: true, riskLevel: 'user_confirmation_required', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), steps: [{ id: 'delegated_execution', action: action ? `Execute delegated ${skill}.${action} through the canonical executor.` : `Execute delegated ${skill} through the canonical Agent Operating Model.`, tool: 'execute_capability', risk: 'user_confirmation_required', status: 'running', authorization: 'canonical_executor_policy', idempotencyKey: `delegated:${skill}:${action || 'auto'}:${task.slice(0, 80)}` }] });
}

async function recordEvent(goalId: string, action: string, result: string, detail: string, idempotencyKey: string) {
  const store = await getCanonicalStore();
  await store.run(`INSERT INTO agent_goal_events(goal_id,action,tool,result,detail,idempotency_key) VALUES(?,?,?,?,?,?)`, [goalId, action, 'execute_capability', result, detail.slice(0, 1200), idempotencyKey]);
}

export async function executeDelegatedAgentWithCanonicalRun(ownerPhone: string, delegationId: string, skill: string, task: string, requestedAction?: string): Promise<DelegatedAgentRunResult> {
  await ensureAgentRuntimeSchema();
  const store = await getCanonicalStore();
  const goalId = `delegated-goal-${randomUUID()}`;
  const normalizedSkill = String(skill || '').trim().toLowerCase().replace(/^skill\./, '');
  const capability = normalizedSkill ? `skill.${normalizedSkill}` : '';
  const registration = capability ? getCapabilityRegistration(capability) || getCapabilityRegistration(normalizedSkill) : null;
  const action = registration ? resolveCapabilityAction(registration.descriptor.capability, requestedAction || registration.descriptor.actions[0] || '') : null;
  const useCanonical = Boolean(registration && action);

  await store.run(`INSERT INTO agent_goals(id,phone,source,goal_type,objective,status,priority,autonomy,plan_json,risk_level,confirmation_required,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [goalId, ownerPhone, 'network', 'delegated_agent', task.slice(0, 1000), 'active', 50, 'assist', planJson(normalizedSkill, task, action || requestedAction), 'user_confirmation_required', 1, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]);
  await recordEvent(goalId, 'delegated_run_started', 'success', `delegation:${delegationId};skill:${normalizedSkill};path:${useCanonical ? 'canonical_capability_executor' : 'legacy_compatibility'}`, `delegated-run:${goalId}:start`);

  try {
    if (useCanonical && action) {
      const result = await executeAgentTool('execute_capability', { capability: registration!.descriptor.capability, action, contextId: goalId, canonicalObjectId: delegationId, argumentsJson: JSON.stringify({ task, delegationId }), confirmationGranted: false }, { phone: ownerPhone, goalId });
      const success = result.ok;
      const message = result.message || String(result.data?.message || (success ? 'Delegated capability execution completed.' : 'Delegated capability execution was blocked.'));
      await store.run(`UPDATE agent_goals SET status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`, [success ? 'completed' : 'blocked', success ? 'completed' : 'blocked', message.slice(0, 1000), goalId, ownerPhone]);
      await recordEvent(goalId, success ? 'delegated_run_completed' : 'delegated_run_blocked', success ? 'success' : 'blocked', `${message}; evidence:${result.evidence || 'none'}`, `delegated-run:${goalId}:${success ? 'completed' : 'blocked'}`);
      return { success, result: message, goalId, executionPath: 'canonical_capability_executor' };
    }

    const legacy = await executeUserAgentDelegation(ownerPhone, delegationId, task);
    const terminalStatus = legacy.success ? 'completed' : 'blocked';
    await store.run(`UPDATE agent_goals SET status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`, [terminalStatus, terminalStatus, legacy.result.slice(0, 1000), goalId, ownerPhone]);
    await recordEvent(goalId, 'delegated_run_completed', legacy.success ? 'success' : 'blocked', legacy.result.slice(0, 1200), `delegated-run:${goalId}:${terminalStatus}`);
    return { ...legacy, goalId, executionPath: 'legacy_compatibility' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Delegated agent execution failed.';
    await store.run(`UPDATE agent_goals SET status='failed',failure_reason=?,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`, [detail.slice(0, 500), detail.slice(0, 1000), goalId, ownerPhone]);
    await recordEvent(goalId, 'delegated_run_failed', 'failed', detail, `delegated-run:${goalId}:failed`);
    throw error;
  }
}