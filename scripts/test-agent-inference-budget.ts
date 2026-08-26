import assert from 'node:assert/strict';

process.env.KURUKOO_AGENT_PER_GOAL_TOKEN_BUDGET = '100';
process.env.KURUKOO_AGENT_PER_CYCLE_TOKEN_BUDGET = '100';
process.env.KURUKOO_AGENT_MAX_HOSTED_ESCALATIONS_PER_DAY = '1';
process.env.KURUKOO_AGENT_BUDGET_COOLDOWN_SECONDS = '30';

const { checkAgentInferenceBudget, getAgentInferenceBudgetStatus, recordAgentInferenceBudget } = await import('../src/services/agentInferenceBudgetService.js');
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const agentId = `budget-agent-${suffix}`;
const goalId = `budget-goal-${suffix}`;

assert.equal((await checkAgentInferenceBudget({ agentId, goalId, estimatedTokens: 50 })).allowed, true);
await recordAgentInferenceBudget({ agentId, goalId, tokens: 50, usedHosted: true });
const hostedLimited = await checkAgentInferenceBudget({ agentId, goalId, estimatedTokens: 25 });
assert.equal(hostedLimited.allowed, true);
assert.equal(hostedLimited.forceLocal, true, 'hosted escalation limit must force bounded local inference');
await recordAgentInferenceBudget({ agentId, goalId, tokens: 50, usedHosted: false, exhaust: true });
const exhausted = await checkAgentInferenceBudget({ agentId, goalId, estimatedTokens: 1 });
assert.equal(exhausted.allowed, false);
assert.equal(exhausted.forceLocal, true);
assert.match(exhausted.reason || '', /cooling down|budget/i);
const status = await getAgentInferenceBudgetStatus(agentId, goalId);
assert.equal(status.goals.length, 1);
assert.equal(status.goals[0].tokensUsed, 100);
assert.equal(status.goals[0].hostedEscalations, 1);
assert.ok(status.goals[0].cooldownUntil);
console.log('Agent inference budget contract passed: per-goal accounting, hosted fallback, cooldown, and durable status.');
