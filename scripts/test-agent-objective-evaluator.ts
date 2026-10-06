/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-agent-objective-evaluator-${process.pid}-${Date.now()}.sqlite`;
const { ensureAgentExecutionTraceSchema, recordAgentExecutionTrace } = await import('../src/services/agentExecutionTrace.js');
const { evaluateAgentObjective } = await import('../src/services/agentObjectiveEvaluator.js');

await ensureAgentExecutionTraceSchema();

const owner = `agent-eval-${Date.now()}`;
const goalId = `goal-${Date.now()}`;

await recordAgentExecutionTrace({
  ownerPhone: owner,
  goalId,
  kind: 'outcome',
  status: 'completed',
  evidence: 'external provider reported repair completed',
});

const blocked = await evaluateAgentObjective({
  ownerPhone: owner,
  goalId,
  objective: 'Repair laptop',
  planPresent: true,
  capabilityAllowed: true,
  authorizationSatisfied: true,
  dependenciesSatisfied: true,
  evidenceRequired: true,
});

assert.equal(blocked.verdict, 'fail');
assert.equal(blocked.externallyVerified, false);

await recordAgentExecutionTrace({
  ownerPhone: owner,
  goalId,
  kind: 'evidence',
  status: 'verified',
  evidence: 'verified technician completion record',
});

const passed = await evaluateAgentObjective({
  ownerPhone: owner,
  goalId,
  objective: 'Repair laptop',
  planPresent: true,
  capabilityAllowed: true,
  authorizationSatisfied: true,
  dependenciesSatisfied: true,
  evidenceRequired: true,
});

assert.equal(passed.verdict, 'pass');
assert.equal(passed.evidencePresent, true);
assert.equal(passed.externallyVerified, true);
assert.ok(passed.traceCount >= 2);

console.log('Agent objective evaluator contract passed.');
