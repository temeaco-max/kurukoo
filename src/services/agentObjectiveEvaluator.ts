import { evaluateAgentWork, type AgentQualityDecision } from './agentQualityGate.js';
import { listAgentExecutionTrace, type AgentExecutionTraceEvent } from './agentExecutionTrace.js';

export interface AgentObjectiveEvaluationInput {
  ownerPhone: string;
  goalId: string;
  objective: string;
  planPresent: boolean;
  capabilityAllowed: boolean;
  authorizationSatisfied: boolean;
  dependenciesSatisfied: boolean;
  evidenceRequired?: boolean;
}

export interface AgentObjectiveEvaluation extends Omit<AgentQualityDecision, 'verdict'> {
  verdict: 'pass' | 'needs_user' | 'blocked' | 'failed';
  traceCount: number;
  latestStatus?: string;
  evidencePresent: boolean;
  externallyVerified: boolean;
}

function hasEvidenceRecord(trace: AgentExecutionTraceEvent[]): boolean {
  return trace.some((event) =>
    ['evidence', 'evidence_recorded', 'tool_completed'].includes(event.kind) &&
    Boolean(String(event.evidence || '').trim()),
  );
}

function hasExternallyVerifiedOutcome(trace: AgentExecutionTraceEvent[]): boolean {
  return trace.some((event) =>
    ['evidence', 'evidence_recorded', 'outcome', 'tool_completed'].includes(event.kind) &&
    Boolean(event.evidence) &&
    /verified|confirmed|validated|external_verification/i.test(
      `${event.status || ''} ${event.reason || ''} ${event.evidence || ''}`,
    ),
  );
}

function hasExternalOutcomeClaim(trace: AgentExecutionTraceEvent[]): boolean {
  return trace.some((event) =>
    event.kind === 'outcome' &&
    /external|provider|completed|delivered|sold|repaired/i.test(
      `${event.status || ''} ${event.reason || ''} ${event.evidence || ''}`,
    ),
  );
}

function executionRequiresEvidence(trace: AgentExecutionTraceEvent[]): boolean {
  return trace.some((event) =>
    ['tool_started', 'tool_completed', 'tool_failed', 'evidence_recorded'].includes(event.kind),
  );
}

export async function evaluateAgentObjective(
  input: AgentObjectiveEvaluationInput,
): Promise<AgentObjectiveEvaluation> {
  const trace = await listAgentExecutionTrace(input.ownerPhone, input.goalId, 200);
  const evidencePresent = hasEvidenceRecord(trace);
  const externallyVerified = hasExternallyVerifiedOutcome(trace);
  const latestStatus = trace.length ? trace[trace.length - 1]?.status : undefined;
  const decision = evaluateAgentWork({
    objective: input.objective,
    planPresent: input.planPresent,
    capabilityAllowed: input.capabilityAllowed,
    authorizationSatisfied: input.authorizationSatisfied,
    dependenciesSatisfied: input.dependenciesSatisfied,
    evidenceRequired: Boolean(input.evidenceRequired || executionRequiresEvidence(trace)),
    evidencePresent,
    externalOutcomeClaimed: hasExternalOutcomeClaim(trace),
    externallyVerified,
  });
  const verdict: AgentObjectiveEvaluation['verdict'] = decision.verdict === 'fail' ? 'failed' : decision.verdict;
  return { ...decision, verdict, traceCount: trace.length, latestStatus, evidencePresent, externallyVerified };
}
