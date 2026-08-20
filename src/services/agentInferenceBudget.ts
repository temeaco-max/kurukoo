export interface AgentInferenceBudgetConfig {
  dailyUsd: number;
  goalUsd: number;
  cycleUsd: number;
  maxHostedEscalationsPerDay: number;
}

const usage = new Map<string, { day: string; dailyUsd: number; goalUsd: Map<string, number>; cycleUsd: Map<string, number>; hostedEscalations: number }>();

function today(): string { return new Date().toISOString().slice(0, 10); }
function num(name: string, fallback: number): number { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) && value >= 0 ? value : fallback; }

export function getAgentInferenceBudget(): AgentInferenceBudgetConfig {
  return {
    dailyUsd: num('KURUKOO_AGENT_AI_DAILY_BUDGET_USD', 2),
    goalUsd: num('KURUKOO_AGENT_AI_GOAL_BUDGET_USD', 0.5),
    cycleUsd: num('KURUKOO_AGENT_AI_CYCLE_BUDGET_USD', 0.1),
    maxHostedEscalationsPerDay: Math.max(0, Math.floor(num('KURUKOO_AGENT_AI_MAX_HOSTED_ESCALATIONS_PER_DAY', 25))),
  };
}

function stateFor(agentId: string) {
  const day = today();
  const current = usage.get(agentId);
  if (!current || current.day !== day) {
    const created = { day, dailyUsd: 0, goalUsd: new Map<string, number>(), cycleUsd: new Map<string, number>(), hostedEscalations: 0 };
    usage.set(agentId, created);
    return created;
  }
  return current;
}

export function canSpendAgentInference(agentId: string, goalId: string, estimatedUsd: number, hostedEscalation = false): { allowed: boolean; reason?: string; remainingDailyUsd: number; remainingGoalUsd: number; remainingCycleUsd: number } {
  const budget = getAgentInferenceBudget();
  const state = stateFor(agentId);
  const goalSpent = state.goalUsd.get(goalId) || 0;
  const safeEstimate = Math.max(0, estimatedUsd);
  if (state.dailyUsd + safeEstimate > budget.dailyUsd) return { allowed: false, reason: 'daily_agent_inference_budget_exhausted', remainingDailyUsd: Math.max(0, budget.dailyUsd - state.dailyUsd), remainingGoalUsd: Math.max(0, budget.goalUsd - goalSpent), remainingCycleUsd: budget.cycleUsd };
  if (goalSpent + safeEstimate > budget.goalUsd) return { allowed: false, reason: 'goal_inference_budget_exhausted', remainingDailyUsd: Math.max(0, budget.dailyUsd - state.dailyUsd), remainingGoalUsd: Math.max(0, budget.goalUsd - goalSpent), remainingCycleUsd: budget.cycleUsd };
  const cycleSpent = state.cycleUsd.get(goalId) || 0;
  if (cycleSpent + safeEstimate > budget.cycleUsd) return { allowed: false, reason: 'cycle_inference_budget_exhausted', remainingDailyUsd: Math.max(0, budget.dailyUsd - state.dailyUsd), remainingGoalUsd: Math.max(0, budget.goalUsd - goalSpent), remainingCycleUsd: Math.max(0, budget.cycleUsd - cycleSpent) };
  if (hostedEscalation && state.hostedEscalations >= budget.maxHostedEscalationsPerDay) return { allowed: false, reason: 'daily_hosted_escalation_limit_exhausted', remainingDailyUsd: Math.max(0, budget.dailyUsd - state.dailyUsd), remainingGoalUsd: Math.max(0, budget.goalUsd - goalSpent), remainingCycleUsd: Math.max(0, budget.cycleUsd - cycleSpent) };
  return { allowed: true, remainingDailyUsd: Math.max(0, budget.dailyUsd - state.dailyUsd), remainingGoalUsd: Math.max(0, budget.goalUsd - goalSpent), remainingCycleUsd: Math.max(0, budget.cycleUsd - cycleSpent) };
}

export function recordAgentInferenceSpend(agentId: string, goalId: string, estimatedUsd: number, hostedEscalation = false): void {
  const state = stateFor(agentId);
  const amount = Math.max(0, estimatedUsd);
  state.dailyUsd += amount;
  state.goalUsd.set(goalId, (state.goalUsd.get(goalId) || 0) + amount);
  state.cycleUsd.set(goalId, (state.cycleUsd.get(goalId) || 0) + amount);
  if (hostedEscalation) state.hostedEscalations += 1;
}

export function resetAgentInferenceBudget(agentId?: string): void {
  if (agentId) usage.delete(agentId); else usage.clear();
}
