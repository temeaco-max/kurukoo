/**
 * Compound goal lifecycle: creates the parent goal, sub-goals and dependency
 * edges for a recognised compound objective. Goal creation, dependency
 * attachment and status transitions remain owned by the canonical services
 * (agentRuntime / agentEconomicRequestOrchestrator); this module only wires
 * them together and never invents providers, requests or outcomes.
 */
import { createConversationGoal, ensureAgentRuntimeSchema, getAgentGoal, listSubGoals, type AgentGoal } from './agentRuntime.js';
import { attachAgentGoalDependency, refreshAgentGoalDependencies } from './agentEconomicRequestOrchestrator.js';
import { recognizeCompoundObjective, resolveSubGoalSkill, type CompoundDecomposition } from './compoundObjectiveResolver.js';
import { getCanonicalStore } from './canonicalStore.js';
import { recordAgentExecutionTrace } from './agentExecutionTrace.js';

export interface CompoundGoalResult {
  parentGoal: AgentGoal;
  subGoals: AgentGoal[];
  dependencies: Awaited<ReturnType<typeof refreshAgentGoalDependencies>>;
  decomposition: CompoundDecomposition;
}

export async function createCompoundGoalIfRecognized(input: { phone: string; conversationId?: string; objective: string }): Promise<CompoundGoalResult | null> {
  const owner = String(input.phone || '').trim();
  if (!owner || owner.startsWith('anon_')) return null;
  const decomposition = recognizeCompoundObjective(input.objective);
  if (!decomposition) return null;
  await ensureAgentRuntimeSchema();

  // Idempotent: an existing active parent with the same objective wins.
  const store = await getCanonicalStore();
  const existingParent = await store.one<any>(
    `SELECT id FROM agent_goals WHERE phone=? AND lower(objective)=lower(?) AND parent_goal_id IS NULL AND status IN ('active','waiting','waiting_on_dependency','needs_user','blocked') LIMIT 1`,
    [owner, decomposition.parentObjective]
  );
  if (existingParent) {
    const parentGoal = await getAgentGoal(owner, String(existingParent.id));
    if (!parentGoal) return null;
    const subGoals = await listSubGoals(owner, parentGoal.id);
    let dependencies: Awaited<ReturnType<typeof refreshAgentGoalDependencies>> = [];
    try { dependencies = await refreshAgentGoalDependencies(owner, parentGoal.id); } catch { /* existing lifecycle state remains authoritative */ }
    return { parentGoal, subGoals, dependencies, decomposition };
  }

  const parentSkill = decomposition.subObjectives[0]?.skill || 'find_worker';
  const parentGoal = await createConversationGoal({
    phone: owner,
    conversationId: input.conversationId,
    skill: parentSkill,
    objective: decomposition.parentObjective,
    source: 'conversation',
    persistWhenDisabled: true,
  });
  if (!parentGoal) return null;

  // A compound parent coordinates child Goals; it is not itself a consequential
  // repair or sale action. Keep it active without scheduling an independent
  // capability execution cycle, while child plans retain their own safeguards.
  parentGoal.status = 'active';
  parentGoal.nextActionAt = undefined;
  parentGoal.summary = 'Kurukoo is coordinating the dependent goals for this objective.';
  parentGoal.plan = { ...parentGoal.plan, status: 'active', requiredInputs: [], confirmationRequired: false, steps: [] };
  await store.run(
    `UPDATE agent_goals SET status='active',next_action_at=NULL,summary=?,plan_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`,
    [parentGoal.summary, JSON.stringify(parentGoal.plan), parentGoal.id, owner],
  );
  await recordAgentExecutionTrace({
    ownerPhone: owner,
    goalId: parentGoal.id,
    conversationId: input.conversationId,
    kind: 'continuation',
    actor: 'compoundGoalLifecycle',
    status: 'active',
    reason: 'compound_parent_coordinating_children',
    idempotencyKey: `compound:${parentGoal.id}:coordination`,
  });

  const subGoals: AgentGoal[] = [];
  for (const [index, sub] of decomposition.subObjectives.entries()) {
    const skill = resolveSubGoalSkill(sub.objective);
    const isDependent = typeof sub.dependsOn === 'number';
    const subGoal = await createConversationGoal({
      phone: owner,
      conversationId: input.conversationId,
      parentGoalId: parentGoal.id,
      skill,
      objective: sub.objective,
      source: 'conversation',
      persistWhenDisabled: true,
    });
    if (!subGoal) continue;
    subGoals.push(subGoal);
    if (isDependent && sub.dependsOn !== undefined && subGoals[sub.dependsOn]) {
      try {
        await attachAgentGoalDependency({
          phone: owner,
          parentGoalId: parentGoal.id,
          skill,
          goalId: subGoal.id,
          purpose: `depends on ${decomposition.subObjectives[sub.dependsOn].skill}`,
          blockedBy: `goal:${subGoals[sub.dependsOn].id}`,
        });
      } catch {
        // Non-fatal; the edge can be attached later via the API route.
      }
    }
  }

  for (let i = 0; i < subGoals.length; i++) {
    const sub = decomposition.subObjectives[i];
    if (typeof sub.dependsOn === 'number') {
      await store.run(
        `UPDATE agent_goals SET status='waiting_on_dependency',updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`,
        [subGoals[i].id, owner]
      ).catch(() => {});
    }
  }

  let dependencies: Awaited<ReturnType<typeof refreshAgentGoalDependencies>> = [];
  try {
    dependencies = await refreshAgentGoalDependencies(owner, parentGoal.id);
  } catch {
    // Non-fatal.
  }
  return { parentGoal, subGoals, dependencies, decomposition };
}
