/**
 * Agent quality runtime integration test — budget, trace, quality gate,
 * completion semantics, needs_user persistence and compound gating.
 */
import {
  defaultAgentExecutionBudget,
  initialAgentExecutionUsage,
  evaluateExecutionBudget,
  agentStateForBudgetReason,
  recordAgentExecutionAction,
  type AgentExecutionBudget,
} from '../src/services/agentExecutionControls.js';
import {
  ensureAgentExecutionTraceSchema,
  recordAgentExecutionTrace,
  listAgentExecutionTrace,
} from '../src/services/agentExecutionTrace.js';
import { evaluateAgentWork } from '../src/services/agentQualityGate.js';
import { createConversationGoal, completeAgentGoal, getAgentGoal } from '../src/services/agentRuntime.js';
import { createCompoundGoalIfRecognized } from '../src/services/compoundGoalLifecycle.js';
import { syncSubGoalStatusesWithDependencies } from '../src/services/agentEconomicRequestOrchestrator.js';
import { syncAgentGoalFromCapabilityResult } from '../src/services/agentCapabilityOutcomeService.js';

let pass = 0, failCount = 0;
process.env.KURUKOO_AGENT_ENABLED = 'true';
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log('PASS', name); }
  else { failCount++; console.log('FAIL', name, detail !== undefined ? JSON.stringify(detail) : ''); }
}

async function main() {
  await ensureAgentExecutionTraceSchema();

  // ---- Budget ----
  const budget = defaultAgentExecutionBudget({ KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE: '3', KURUKOO_AGENT_MAX_RETRIES: '1', KURUKOO_AGENT_MAX_CONCURRENT_GOALS: '2', KURUKOO_AGENT_MAX_ELAPSED_MS: '60000' });
  let usage = initialAgentExecutionUsage();
  check('B1 fresh budget allows', evaluateExecutionBudget({ budget, usage }).allowed);
  for (let i = 0; i < 3; i++) usage = recordAgentExecutionAction(usage);
  const actionExhausted = evaluateExecutionBudget({ budget, usage });
  check('B2 action limit enforced', !actionExhausted.allowed && actionExhausted.reason === 'max_actions');
  check('B3 exhaustion state is needs_user', agentStateForBudgetReason(actionExhausted.reason!) === 'needs_user');
  const retryUsage = { ...initialAgentExecutionUsage(), retries: 2 };
  const retryExhausted = evaluateExecutionBudget({ budget, usage: retryUsage });
  check('B4 retry limit enforced', !retryExhausted.allowed && retryExhausted.reason === 'max_retries');
  const elapsedExhausted = evaluateExecutionBudget({ budget, usage: initialAgentExecutionUsage(Date.now() - 61_000) });
  check('B5 elapsed-time limit enforced', !elapsedExhausted.allowed && elapsedExhausted.reason === 'max_elapsed_ms');
  check('B6 elapsed exhaustion blocks', agentStateForBudgetReason(elapsedExhausted.reason!) === 'blocked');
  const concurrentExhausted = evaluateExecutionBudget({ budget, usage: initialAgentExecutionUsage(), concurrentGoals: 2 });
  check('B7 concurrent-goal limit enforced', !concurrentExhausted.allowed && concurrentExhausted.reason === 'max_concurrent_goals');
  const costBudget: AgentExecutionBudget = { ...budget, maxEstimatedCostMinor: 100 };
  const costExhausted = evaluateExecutionBudget({ budget: costBudget, usage: { ...initialAgentExecutionUsage(), estimatedCostMinor: 90 }, estimatedActionCostMinor: 20 });
  check('B8 cost limit enforced', !costExhausted.allowed && costExhausted.reason === 'cost_budget');

  // ---- Trace: idempotency + owner isolation ----
  const owner = `qri-${Date.now()}`;
  const goalId = `goal-qri-${Date.now()}`;
  await recordAgentExecutionTrace({ ownerPhone: owner, goalId, kind: 'evidence', status: 'verified', evidence: 'verified', idempotencyKey: `${goalId}:dup` });
  await recordAgentExecutionTrace({ ownerPhone: owner, goalId, kind: 'evidence', status: 'verified', evidence: 'verified', idempotencyKey: `${goalId}:dup` });
  const ownTrace = await listAgentExecutionTrace(owner, goalId);
  check('T1 idempotent trace insert', ownTrace.length === 1, ownTrace.length);
  await recordAgentExecutionTrace({ ownerPhone: `other-${owner}`, goalId, kind: 'evidence', status: 'verified', idempotencyKey: `${goalId}:other` });
  const otherTrace = await listAgentExecutionTrace(`other-${owner}`, goalId);
  check('T2 owner isolation', otherTrace.length === 1 && ownTrace.every(t => t.ownerPhone === owner));

  // ---- Quality gate primitives ----
  const passDecision = evaluateAgentWork({ objective: 'x', planPresent: true, capabilityAllowed: true, authorizationSatisfied: true, dependenciesSatisfied: true });
  check('Q1 local work passes without external evidence', passDecision.verdict === 'pass');
  const missingEvidence = evaluateAgentWork({ objective: 'x', planPresent: true, capabilityAllowed: true, authorizationSatisfied: true, dependenciesSatisfied: true, evidenceRequired: true, evidencePresent: false });
  check('Q2 missing evidence blocked', missingEvidence.verdict === 'blocked');
  const falseClaim = evaluateAgentWork({ objective: 'x', planPresent: true, capabilityAllowed: true, authorizationSatisfied: true, dependenciesSatisfied: true, externalOutcomeClaimed: true, externallyVerified: false });
  check('Q3 external claim without verification fails', falseClaim.verdict !== 'pass');

  await completionAndCompoundChecks();
}

async function completeCompoundChild(phone: string, goalId: string, skill: string, evidence: string) {
  for (let index = 0; index < 4; index++) {
    await syncAgentGoalFromCapabilityResult({ phone, goalId, capability: `skill.${skill}`, action: 'prepare_action', idempotencyKey: `${goalId}:quality-runtime:${index}`, outcome: { status: 'completed', capability: `skill.${skill}`, action: 'prepare_action', message: 'Fake provider reports the deterministic lifecycle step completed.', evidence } });
    const current = await getAgentGoal(phone, goalId);
    if (current?.status !== 'active') return current;
  }
  return getAgentGoal(phone, goalId);
}

async function completionAndCompoundChecks() {
  // ---- Completion gating: local vs external ----
  const A = `qri-owner-a-${Date.now()}`;
  const localGoal = await createConversationGoal({ phone: A, skill: 'reminder', objective: 'Remind me tomorrow to call the dentist', source: 'conversation' });
  check('C1 local goal created', !!localGoal);
  if (localGoal) {
    const done = await completeAgentGoal(A, localGoal.id);
    check('C2 deterministic/local work completes', done?.status === 'completed', done?.status);
    const again = await completeAgentGoal(A, localGoal.id);
    check('C3 completion idempotent', again?.status === 'completed');
  }

  const B = `qri-owner-b-${Date.now()}`;
  const extGoal = await createConversationGoal({ phone: B, skill: 'reminder', objective: 'Sell my repaired laptop', source: 'conversation' });
  if (extGoal) {
    await recordAgentExecutionTrace({ ownerPhone: B, goalId: extGoal.id, kind: 'outcome', status: 'claimed sold externally', reason: 'provider said completed', idempotencyKey: `${extGoal.id}:claim` });
    const refused = await completeAgentGoal(B, extGoal.id);
    check('C4 external claim w/o evidence NOT completed', !!refused && refused.status !== 'completed', refused?.status);
    check('C5 refusal durable needs_user/blocked', refused?.status === 'needs_user' || refused?.status === 'blocked', refused?.status);
    check('C6 quality decision traced', (await listAgentExecutionTrace(B, extGoal.id)).some(t => t.kind === 'quality_evaluated'));
    await recordAgentExecutionTrace({ ownerPhone: B, goalId: extGoal.id, kind: 'evidence', status: 'verified sale confirmed by provider receipt', evidence: 'verified receipt #123', idempotencyKey: `${extGoal.id}:proof` });
    const accepted = await completeAgentGoal(B, extGoal.id);
    check('C7 verified evidence → completed', accepted?.status === 'completed', accepted?.status);
  } else check('C4 setup', false, 'external goal not created');

  // ---- Compound gating ----
  const P = `qri-compound-${Date.now()}`;
  const res = await createCompoundGoalIfRecognized({ phone: P, objective: 'Fix my laptop and sell it when it is ready' });
  check('D1 compound created', !!res && res.subGoals.length === 2);
  if (res) {
    const parentBlocked = await completeAgentGoal(P, res.parentGoal.id);
    check('D2 parent blocked while children pending', parentBlocked?.status !== 'completed', parentBlocked?.status);
    await completeCompoundChild(P, res.subGoals[0].id, res.subGoals[0].goalType, 'verified fake-provider repair receipt');
    const midParent = await completeAgentGoal(P, res.parentGoal.id);
    check('D3 parent still incomplete with one child open', midParent?.status !== 'completed', midParent?.status);
    await completeCompoundChild(P, res.subGoals[1].id, res.subGoals[1].goalType, 'verified fake-provider sale receipt');
    await syncSubGoalStatusesWithDependencies(P, res.parentGoal.id);
    const parent = await getAgentGoal(P, res.parentGoal.id);
    check('D4 parent completes after children pass', parent?.status === 'completed', parent?.status);
  }

  console.log(`\n${pass} passed, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
