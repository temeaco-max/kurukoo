import assert from 'node:assert/strict';
import { simulateCompoundObjective } from '../src/services/agentObjectiveSimulator.js';

const result = simulateCompoundObjective();

assert.equal(result.parent.objective, 'Fix my laptop and sell it when it is ready');
assert.equal(result.goals.find((goal) => goal.id === 'sim-repair')?.status, 'completed');
assert.equal(result.goals.find((goal) => goal.id === 'sim-sale')?.status, 'completed');
assert.equal(result.checkpointQuality.verdict, 'needs_user');
assert.equal(result.quality.verdict, 'pass');
assert.equal(result.approvalRequired, true);
assert.equal(result.approvalGranted, true);
assert.equal(result.parent.status, 'completed');
assert.ok(result.events.includes('repair_completed_with_verified_evidence'));
assert.ok(result.events.includes('sale_unblocked'));
assert.ok(result.events.includes('sale_ready_but_requires_user_confirmation'));
assert.ok(result.events.includes('user_approved_sale'));
assert.ok(result.events.includes('sale_completed_with_verified_evidence'));
assert.ok(result.events.includes('parent_completed'));
assert.equal(result.events.filter((event) => event === 'quality:needs_user').length, 1);
assert.equal(result.events.filter((event) => event === 'quality:pass').length, 1);
assert.equal(result.usage.actions, 2);

console.log('Agent objective simulator end-to-end contract passed: dependency completion, human checkpoint, continuation, verified sale evidence, quality PASS and parent completion.');
