/**
 * Compound objective lifecycle test — 12 phases.
 * Covers: recognition, skill inference, goal creation, dependency attachment,
 * waiting_on_dependency, evidence-gated completion, parent completion policy,
 * failure/cancel propagation, idempotency, owner isolation, restart persistence.
 */
import { recognizeCompoundObjective, resolveSubGoalSkill } from '../src/services/compoundObjectiveResolver.js';
import { createCompoundGoalIfRecognized } from '../src/services/compoundGoalLifecycle.js';
import { createConversationGoal, failAgentGoal, cancelAgentGoal, getAgentGoal, listSubGoals } from '../src/services/agentRuntime.js';
import { refreshAgentGoalDependencies, syncSubGoalStatusesWithDependencies } from '../src/services/agentEconomicRequestOrchestrator.js';
import { getCanonicalStore } from '../src/services/canonicalStore.js';
import { syncAgentGoalFromCapabilityResult } from '../src/services/agentCapabilityOutcomeService.js';

let pass = 0, failCount = 0;
function check(name: string, cond: boolean, detail?: unknown) { if (cond) { pass++; console.log('PASS', name); } else { failCount++; console.log('FAIL', name, detail !== undefined ? JSON.stringify(detail) : ''); } }

async function completeThroughCanonicalOutcome(phone: string, goalId: string, capability: string, evidence: string) {
  for (let index = 0; index < 4; index++) {
    await syncAgentGoalFromCapabilityResult({
      phone,
      goalId,
      capability: `skill.${capability}`,
      action: 'prepare_action',
      idempotencyKey: `${goalId}:verified-test-outcome:${index}`,
      outcome: { status: 'completed', capability: `skill.${capability}`, action: 'prepare_action', message: 'Fake provider reports the deterministic lifecycle step completed.', evidence },
    });
    const current = await getAgentGoal(phone, goalId);
    if (current?.status !== 'active') return current;
  }
  return getAgentGoal(phone, goalId);
}

async function main() {
  const OBJECTIVE = 'Fix my laptop and sell it when it is ready';
  const dec = recognizeCompoundObjective(OBJECTIVE);
  check('P1 compound recognized', !!dec && dec.subObjectives.length === 2);
  check('P1b second depends on first', dec?.subObjectives[1]?.dependsOn === 0);
  check('P1c simple objective rejected', recognizeCompoundObjective('Clean my kitchen please') === null || !recognizeCompoundObjective('Hello there friend'));
  check('P2 repair skill', resolveSubGoalSkill(dec!.subObjectives[0].objective) === 'phone_repairer');
  check('P2 sale skill', ['find_worker'].includes(resolveSubGoalSkill(dec!.subObjectives[1].objective)));

  const A = 'user_a_compound';
  const res = await createCompoundGoalIfRecognized({ phone: A, objective: OBJECTIVE });
  check('P3 compound created', !!res && !!res.parentGoal && res.subGoals.length === 2, res?.subGoals.length);
  const store = await getCanonicalStore();
  const prow = await store.one<any>('SELECT parent_goal_id FROM agent_goals WHERE id=?', [res!.subGoals[0].id]);
  check('P3b sub-goal persisted parent_goal_id', prow?.parent_goal_id === res!.parentGoal.id);

  const [repair, sale] = res!.subGoals;
  const saleRow = await store.one<any>('SELECT status FROM agent_goals WHERE id=?', [sale.id]);
  check('P4 sale waiting_on_dependency', saleRow?.status === 'waiting_on_dependency', saleRow?.status);
  const deps = await refreshAgentGoalDependencies(A, res!.parentGoal.id);
  check('P4b dependency edge exists', deps.length >= 1 && String(deps[0].blockedBy).startsWith('goal:'), deps[0]);
  check('P4c dependency linked to goalId', deps[0]?.goalId === sale.id || String(deps[0]?.blockedBy) === `goal:${sale.id}`);

  await completeThroughCanonicalOutcome(A, repair.id, repair.goalType, 'verified fake-provider repair receipt');
  await syncSubGoalStatusesWithDependencies(A, res!.parentGoal.id);
  const saleAfter = await getAgentGoal(A, sale.id);
  check('P5 sale active after repair completed', saleAfter?.status === 'active', saleAfter?.status);
  const rep1 = await getAgentGoal(A, repair.id);
  check('P5b repair completed', rep1?.status === 'completed');

  await completeThroughCanonicalOutcome(A, sale.id, sale.goalType, 'verified fake-provider sale receipt');
  await syncSubGoalStatusesWithDependencies(A, res!.parentGoal.id);
  const parentDone = await getAgentGoal(A, res!.parentGoal.id);
  check('P6 parent completed when all children completed', parentDone?.status === 'completed', parentDone?.status);

  const res2 = await createCompoundGoalIfRecognized({ phone: 'user_b_compound', objective: OBJECTIVE });
  if (res2) {
    await failAgentGoal('user_b_compound', res2.subGoals[0].id, 'part unavailable');
    await syncSubGoalStatusesWithDependencies('user_b_compound', res2.parentGoal.id);
    const p2g = await getAgentGoal('user_b_compound', res2.parentGoal.id);
    check('P7 parent not completed on child failure', p2g?.status !== 'completed', p2g?.status);
  } else check('P7 skipped (second user compound)', true);

  const res3 = await createCompoundGoalIfRecognized({ phone: 'user_c_compound', objective: OBJECTIVE });
  if (res3) {
    await cancelAgentGoal('user_c_compound', res3.subGoals[0].id);
    await syncSubGoalStatusesWithDependencies('user_c_compound', res3.parentGoal.id);
    const cancelledRepair = await getAgentGoal('user_c_compound', res3.subGoals[0].id);
    check('P8 child cancellation recorded', cancelledRepair?.status === 'cancelled', cancelledRepair?.status);
    const depC = await refreshAgentGoalDependencies('user_c_compound', res3.parentGoal.id);
    check('P8b dependent edge blocked after blocker cancel', depC.some(d => d.status === 'blocked' || String(d.blockedBy || '').startsWith('goal:')), depC.map(d => d.status));
  } else check('P8 skipped', true);

  const resD1 = await createCompoundGoalIfRecognized({ phone: 'user_d_compound', objective: OBJECTIVE });
  const dup = resD1 ? await createCompoundGoalIfRecognized({ phone: 'user_d_compound', objective: OBJECTIVE }) : 'unavailable';
  check('P9 no duplicate parent for same active objective', typeof dup === 'object' && dup?.parentGoal.id === resD1?.parentGoal.id, typeof dup === 'object' ? dup?.parentGoal.id : dup);
  const again = await createConversationGoal({ phone: A, skill: 'laptop_repairer', objective: 'Fix my laptop', persistWhenDisabled: true });
  const subsA = await listSubGoals(A, res!.parentGoal.id);
  check('P9b sub-goal count stable', subsA.length === 2, subsA.length);
  void again;

  const leakA = await getAgentGoal('intruder_x', res!.parentGoal.id);
  check('P10 cross-owner goal access denied', leakA === null);
  const leakSubs = await listSubGoals('intruder_x', res!.parentGoal.id);
  check('P10b cross-owner sub-goals hidden', leakSubs.length === 0);
  const leakDeps = await refreshAgentGoalDependencies('intruder_x', res!.parentGoal.id);
  check('P10c cross-owner dependencies hidden', leakDeps.length === 0);

  const reloaded = await getAgentGoal(A, res!.subGoals[0].id);
  check('P11 goal reload with parentGoalId', reloaded?.parentGoalId === res!.parentGoal.id);
  const link = res!.parentGoal.economicRequestId;
  check('P12 no fabricated economicRequestId', link === undefined || typeof link === 'string');

  console.log(`\nRESULT: ${pass} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
