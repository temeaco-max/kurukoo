/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-agent-execution-trace-${process.pid}-${Date.now()}.sqlite`;
const { ensureAgentExecutionTraceSchema, listAgentExecutionTrace, recordAgentExecutionTrace } = await import('../src/services/agentExecutionTrace.js');

await ensureAgentExecutionTraceSchema();

const ownerA = `agent-trace-test-a-${Date.now()}`;
const ownerB = `agent-trace-test-b-${Date.now()}`;
const goalId = `goal-${Date.now()}`;

await recordAgentExecutionTrace({
  ownerPhone: ownerA,
  goalId,
  conversationId: 'conversation-test',
  kind: 'goal_started',
  actor: 'kurukoo-agent',
  status: 'active',
  metadata: { objective: 'Fix my laptop and sell it when ready' },
});

await recordAgentExecutionTrace({
  ownerPhone: ownerA,
  goalId,
  kind: 'policy_decision',
  actor: 'capability-policy',
  status: 'needs_user',
  reason: 'confirmation_required',
});

const ownerATrace = await listAgentExecutionTrace(ownerA, goalId);
assert.equal(ownerATrace.length, 2);
assert.equal(ownerATrace[0]?.kind, 'goal_started');
assert.equal(ownerATrace[1]?.kind, 'policy_decision');
assert.equal(ownerATrace[0]?.metadata?.objective, 'Fix my laptop and sell it when ready');

const ownerBTrace = await listAgentExecutionTrace(ownerB, goalId);
assert.equal(ownerBTrace.length, 0);

const missingOwnerTrace = await listAgentExecutionTrace('');
assert.equal(missingOwnerTrace.length, 0);

console.log('Agent execution trace contract passed.');
