import assert from 'node:assert/strict';
import { getDb, saveDb } from '../src/database.js';
import { checkAgentInferenceBudget, getAgentInferenceBudgetStatus, recordAgentInferenceBudget } from '../src/services/agentInferenceBudgetService.js';

const agentId = 'agent-inference-budget-regression';
const original = {
  perGoal: process.env.KURUKOO_AGENT_PER_GOAL_TOKEN_BUDGET,
  perCycle: process.env.KURUKOO_AGENT_PER_CYCLE_TOKEN_BUDGET,
  maxHosted: process.env.KURUKOO_AGENT_MAX_HOSTED_ESCALATIONS_PER_DAY,
  cooldown: process.env.KURUKOO_AGENT_BUDGET_COOLDOWN_SECONDS,
};
process.env.KURUKOO_AGENT_PER_GOAL_TOKEN_BUDGET = '150';
process.env.KURUKOO_AGENT_PER_CYCLE_TOKEN_BUDGET = '500';
process.env.KURUKOO_AGENT_MAX_HOSTED_ESCALATIONS_PER_DAY = '1';
process.env.KURUKOO_AGENT_BUDGET_COOLDOWN_SECONDS = '30';

await getAgentInferenceBudgetStatus(agentId);
const db = await getDb();
db.run(`DELETE FROM agent_inference_budget_usage WHERE agent_id=?`, [agentId]); saveDb();

const initial = await checkAgentInferenceBudget({ agentId, goalId: 'goal-a', estimatedTokens: 100 });
assert.equal(initial.allowed, true, 'a fresh goal must start within its budget');
assert.equal(initial.forceLocal, false, 'a fresh goal may use one hosted escalation');
await recordAgentInferenceBudget({ agentId, goalId: 'goal-a', tokens: 100, usedHosted: true });

const afterHostedCap = await checkAgentInferenceBudget({ agentId, goalId: 'goal-a', estimatedTokens: 20 });
assert.equal(afterHostedCap.allowed, true, 'hosted escalation exhaustion must not block bounded local inference');
assert.equal(afterHostedCap.forceLocal, true, 'the hosted escalation cap must force local inference');

const exhausted = await checkAgentInferenceBudget({ agentId, goalId: 'goal-a', estimatedTokens: 60 });
assert.equal(exhausted.allowed, false, 'a goal must not exceed its configured token budget');
await recordAgentInferenceBudget({ agentId, goalId: 'goal-a', tokens: 0, usedHosted: false, exhaust: true });
const coolingDown = await checkAgentInferenceBudget({ agentId, goalId: 'goal-a', estimatedTokens: 1 });
assert.equal(coolingDown.allowed, false, 'an exhausted goal must observe a cooldown');
assert.match(coolingDown.reason || '', /cooling down/i);

const independentGoal = await checkAgentInferenceBudget({ agentId, goalId: 'goal-b', estimatedTokens: 100 });
assert.equal(independentGoal.allowed, true, 'one goal must not consume another goal’s token budget');
const status = await getAgentInferenceBudgetStatus(agentId);
assert.equal(status.goals.length, 1, 'only recorded goal usage should be exposed in status');
assert.equal(status.goals[0]?.hostedEscalations, 1, 'status must report actual hosted escalations without fabricated costs');

db.run(`DELETE FROM agent_inference_budget_usage WHERE agent_id=?`, [agentId]); saveDb();
for (const [key, value] of Object.entries(original)) {
  const name = key === 'perGoal' ? 'KURUKOO_AGENT_PER_GOAL_TOKEN_BUDGET' : key === 'perCycle' ? 'KURUKOO_AGENT_PER_CYCLE_TOKEN_BUDGET' : key === 'maxHosted' ? 'KURUKOO_AGENT_MAX_HOSTED_ESCALATIONS_PER_DAY' : 'KURUKOO_AGENT_BUDGET_COOLDOWN_SECONDS';
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
}
console.log('Agent inference budget regression passed: per-goal ceiling, bounded local fallback, and cooldown verified.');
