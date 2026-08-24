import { getAgentGoal } from './agentRuntime.js';
import {
  getAgentEconomicRequestLink,
  listAgentGoalDependencies,
  refreshAgentGoalDependencies,
  type AgentEconomicLink,
  type CompoundGoalDependency,
} from './agentEconomicRequestOrchestrator.js';

export interface AgentGoalContinuation {
  goalId: string;
  goalStatus: string;
  economicLink: AgentEconomicLink | null;
  dependencies: CompoundGoalDependency[];
  ready: boolean;
  nextAction: string;
  blockedBy: string[];
}

function nextAction(goalStatus: string, economicLink: AgentEconomicLink | null, dependencies: CompoundGoalDependency[], ready: boolean): string {
  if (goalStatus === 'completed') return 'review the completed goal';
  if (goalStatus === 'cancelled' || goalStatus === 'failed' || goalStatus === 'expired') return 'review the terminal goal state';
  if (!ready) {
    const blocker = dependencies.find(item => item.status === 'blocked' || item.status === 'waiting');
    if (blocker?.blockedBy) return `wait for ${blocker.blockedBy} before continuing`;
    if (blocker) return `wait for the ${blocker.skill} dependency to become ready`;
    return 'wait for the current objective dependencies';
  }
  if (economicLink) return economicLink.nextAction;
  if (goalStatus === 'needs_user') return 'provide the requested input or confirmation';
  if (goalStatus === 'blocked') return 'resolve the blocker before continuing';
  if (goalStatus === 'waiting') return 'wait for the next agent event';
  return 'continue the objective through the canonical capability path';
}

export async function getAgentGoalContinuation(phone: string, goalId: string): Promise<AgentGoalContinuation | null> {
  const owner = String(phone || '').trim();
  if (!owner || !goalId) return null;
  const goal = await getAgentGoal(owner, goalId);
  if (!goal) return null;

  const economicLink = await getAgentEconomicRequestLink(owner, goalId);
  const dependencies = await refreshAgentGoalDependencies(owner, goalId);
  const ready = dependencies.every(item => ['ready', 'completed'].includes(item.status));
  const blockedBy = dependencies
    .filter(item => item.status === 'blocked' || item.status === 'waiting')
    .map(item => item.blockedBy || item.skill);

  return {
    goalId: goal.id,
    goalStatus: goal.status,
    economicLink,
    dependencies,
    ready,
    nextAction: nextAction(goal.status, economicLink, dependencies, ready),
    blockedBy: [...new Set(blockedBy)],
  };
}
