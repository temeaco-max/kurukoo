/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-agent-goal-continuation-${process.pid}-${Date.now()}.sqlite`;
const { getAgentGoalContinuation } = await import('../src/services/agentGoalContinuation.js');

const source = await import('../src/services/agentEconomicRequestOrchestrator.js');

assert.equal(typeof getAgentGoalContinuation, 'function');
assert.equal(typeof source.getAgentEconomicRequestLink, 'function');
assert.equal(typeof source.attachAgentGoalDependency, 'function');
assert.equal(typeof source.refreshAgentGoalDependencies, 'function');

console.log('Agent Goal continuation contract: PASS');
console.log('Owner-scoped request correlation, dependency refresh and next-action projection are registered.');
