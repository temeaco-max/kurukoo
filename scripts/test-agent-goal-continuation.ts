import assert from 'node:assert/strict';
import { getAgentGoalContinuation } from '../src/services/agentGoalContinuation.js';

const source = await import('../src/services/agentEconomicRequestOrchestrator.js');

assert.equal(typeof getAgentGoalContinuation, 'function');
assert.equal(typeof source.getAgentEconomicRequestLink, 'function');
assert.equal(typeof source.attachAgentGoalDependency, 'function');
assert.equal(typeof source.refreshAgentGoalDependencies, 'function');

console.log('Agent Goal continuation contract: PASS');
console.log('Owner-scoped request correlation, dependency refresh and next-action projection are registered.');
