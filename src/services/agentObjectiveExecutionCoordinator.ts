import {
  checkAgentExecutionBudget,
  defaultAgentExecutionBudget,
  initialAgentExecutionUsage,
  recordAgentExecutionAction,
  type AgentExecutionBudget,
  type AgentExecutionDecision,
  type AgentExecutionUsage,
} from './agentExecutionControls.js';
import { evaluateAgentObjective, type AgentObjectiveEvaluation, type AgentObjectiveEvaluationInput } from './agentObjectiveEvaluator.js';
import { recordAgentExecutionTrace } from './agentExecutionTrace.js';

export interface AgentObjectiveExecutionSession {
  budget: AgentExecutionBudget;
  usage: AgentExecutionUsage;
  ownerPhone: string;
  goalId: string;
  conversationId?: string;
}

export interface AgentObjectiveActionInput {
  estimatedCostMinor?: number;
  retry?: boolean;
  actor?: string;
  tool?: string;
  capability?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentObjectiveActionDecision extends AgentExecutionDecision {
  usage: AgentExecutionUsage;
}

export function startAgentObjectiveExecution(input: {
  ownerPhone: string;
  goalId: string;
  conversationId?: string;
  startedAtMs?: number;
  env?: NodeJS.ProcessEnv;
}): AgentObjectiveExecutionSession {
  return {
    budget: defaultAgentExecutionBudget(input.env),
    usage: initialAgentExecutionUsage(input.startedAtMs ?? Date.now()),
    ownerPhone: input.ownerPhone,
    goalId: input.goalId,
    conversationId: input.conversationId,
  };
}

export async function authorizeAgentObjectiveAction(
  session: AgentObjectiveExecutionSession,
  input: AgentObjectiveActionInput = {},
): Promise<AgentObjectiveActionDecision> {
  const decision = checkAgentExecutionBudget(
    session.budget,
    session.usage,
    input.estimatedCostMinor ?? 0,
  );

  if (!decision.allowed) {
    await recordAgentExecutionTrace({
      ownerPhone: session.ownerPhone,
      goalId: session.goalId,
      conversationId: session.conversationId,
      kind: 'execution_stopped',
      actor: input.actor ?? 'kurukoo-agent',
      status: 'blocked',
      tool: input.tool,
      capability: input.capability,
      action: input.action,
      reason: decision.reason,
      metadata: input.metadata,
    });
    return { ...decision, usage: session.usage };
  }

  session.usage = recordAgentExecutionAction(session.usage, {
    estimatedCostMinor: input.estimatedCostMinor,
    retry: input.retry,
  });

  await recordAgentExecutionTrace({
    ownerPhone: session.ownerPhone,
    goalId: session.goalId,
    conversationId: session.conversationId,
    kind: 'tool_call',
    actor: input.actor ?? 'kurukoo-agent',
    status: 'active',
    tool: input.tool,
    capability: input.capability,
    action: input.action,
    metadata: input.metadata,
  });

  return { allowed: true, usage: session.usage };
}

export async function evaluateAgentObjectiveExecution(
  input: AgentObjectiveEvaluationInput,
): Promise<AgentObjectiveEvaluation> {
  const evaluation = await evaluateAgentObjective(input);
  await recordAgentExecutionTrace({
    ownerPhone: input.ownerPhone,
    goalId: input.goalId,
    kind: evaluation.verdict === 'pass' ? 'outcome' : 'policy_decision',
    actor: 'agent-quality-gate',
    status: evaluation.verdict,
    reason: evaluation.reasons.join(', '),
    metadata: {
      traceCount: evaluation.traceCount,
      evidencePresent: evaluation.evidencePresent,
      externallyVerified: evaluation.externallyVerified,
    },
  });
  return evaluation;
}
