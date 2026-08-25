import { checkAgentExecutionBudget, defaultAgentExecutionBudget, initialAgentExecutionUsage, recordAgentExecutionAction, type AgentExecutionBudget, type AgentExecutionUsage } from './agentExecutionControls.js';
import { evaluateAgentWork, type AgentQualityDecision } from './agentQualityGate.js';

export type SimulatedStepStatus = 'waiting_on_dependency' | 'needs_user' | 'ready' | 'completed' | 'blocked' | 'failed';

export interface SimulatedGoal { id: string; objective: string; dependsOn?: string; status: SimulatedStepStatus; evidence?: string; }
export interface ObjectiveSimulationResult {
  parent: SimulatedGoal;
  goals: SimulatedGoal[];
  quality: AgentQualityDecision;
  checkpointQuality: AgentQualityDecision;
  approvalRequired: boolean;
  approvalGranted: boolean;
  usage: AgentExecutionUsage;
  events: string[];
}
export interface ObjectiveSimulationOptions { budget?: AgentExecutionBudget; }

/**
 * Deterministic sandbox proof of the canonical compound objective lifecycle.
 * It models the real lifecycle boundary: verification may pause the objective,
 * explicit approval resumes it, and only verified sale evidence permits parent
 * completion. No external provider or real transaction is invoked.
 */
export function simulateCompoundObjective(options: ObjectiveSimulationOptions = {}): ObjectiveSimulationResult {
  const budget = options.budget || defaultAgentExecutionBudget({
    KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE: '20',
    KURUKOO_AGENT_MAX_RETRIES: '2',
    KURUKOO_AGENT_MAX_ELAPSED_MS: '120000',
    KURUKOO_AGENT_MAX_CONCURRENT_GOALS: '5',
  });
  let usage = initialAgentExecutionUsage();
  const events: string[] = [];
  const parent: SimulatedGoal = { id: 'sim-parent', objective: 'Fix my laptop and sell it when it is ready', status: 'ready' };
  const repair: SimulatedGoal = { id: 'sim-repair', objective: 'Repair the laptop', status: 'ready' };
  const sale: SimulatedGoal = { id: 'sim-sale', objective: 'Sell the laptop after repair completion', dependsOn: repair.id, status: 'waiting_on_dependency' };
  events.push('parent_created', 'repair_ready', 'sale_waiting_on_repair');

  const startDecision = checkAgentExecutionBudget(budget, usage, 0);
  if (!startDecision.allowed) {
    parent.status = 'blocked';
    const quality = evaluateAgentWork({ objective: parent.objective, planPresent: true, capabilityAllowed: true, authorizationSatisfied: false, dependenciesSatisfied: false });
    events.push(`budget_blocked:${startDecision.reason}`, `quality:${quality.verdict}`);
    return { parent, goals: [repair, sale], quality, checkpointQuality: quality, approvalRequired: false, approvalGranted: false, usage, events };
  }

  usage = recordAgentExecutionAction(usage);
  repair.status = 'completed';
  repair.evidence = 'simulated_verified_repair_outcome';
  events.push('repair_completed_with_verified_evidence');

  // The dependency graph is refreshed after the prerequisite completes.
  sale.status = 'needs_user';
  events.push('sale_unblocked', 'sale_ready_but_requires_user_confirmation');
  const checkpointQuality = evaluateAgentWork({
    objective: parent.objective,
    planPresent: true,
    capabilityAllowed: true,
    authorizationSatisfied: false,
    dependenciesSatisfied: true,
    evidenceRequired: true,
    evidencePresent: true,
    externalOutcomeClaimed: false,
    externallyVerified: false,
  });
  parent.status = checkpointQuality.verdict === 'needs_user' ? 'needs_user' : checkpointQuality.verdict === 'pass' ? 'completed' : 'blocked';
  events.push(`quality:${checkpointQuality.verdict}`);

  // Explicit user approval is the only transition that permits the sale action.
  const approvalGranted = true;
  if (!approvalGranted) {
    return { parent, goals: [repair, sale], quality: checkpointQuality, checkpointQuality, approvalRequired: true, approvalGranted: false, usage, events };
  }
  events.push('user_approved_sale');
  parent.status = 'ready';
  sale.status = 'ready';

  const saleBudget = checkAgentExecutionBudget(budget, usage, 0);
  if (!saleBudget.allowed) {
    parent.status = 'blocked';
    sale.status = 'blocked';
    events.push(`budget_blocked:${saleBudget.reason}`);
    return { parent, goals: [repair, sale], quality: checkpointQuality, checkpointQuality, approvalRequired: true, approvalGranted, usage, events };
  }
  usage = recordAgentExecutionAction(usage);
  sale.status = 'completed';
  sale.evidence = 'simulated_verified_sale_outcome';
  events.push('sale_completed_with_verified_evidence');

  const quality = evaluateAgentWork({
    objective: parent.objective,
    planPresent: true,
    capabilityAllowed: true,
    authorizationSatisfied: true,
    dependenciesSatisfied: true,
    evidenceRequired: true,
    evidencePresent: true,
    externalOutcomeClaimed: true,
    externallyVerified: true,
  });
  parent.status = quality.verdict === 'pass' ? 'completed' : quality.verdict === 'needs_user' ? 'needs_user' : 'blocked';
  events.push(`quality:${quality.verdict}`, parent.status === 'completed' ? 'parent_completed' : 'parent_not_completed');
  return { parent, goals: [repair, sale], quality, checkpointQuality, approvalRequired: true, approvalGranted, usage, events };
}
