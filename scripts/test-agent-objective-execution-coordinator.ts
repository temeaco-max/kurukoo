import assert from 'node:assert/strict';
import {
  authorizeAgentObjectiveAction,
  startAgentObjectiveExecution,
} from '../src/services/agentObjectiveExecutionCoordinator.js';

const session = startAgentObjectiveExecution({
  ownerPhone: `objective-coordinator-${Date.now()}`,
  goalId: `goal-${Date.now()}`,
  conversationId: 'conversation-coordinator-test',
  startedAtMs: 1_000,
  env: {
    KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE: '1',
    KURUKOO_AGENT_MAX_RETRIES: '0',
    KURUKOO_AGENT_MAX_ELAPSED_MS: '60000',
    KURUKOO_AGENT_MAX_CONCURRENT_GOALS: '1',
  },
});

const first = await authorizeAgentObjectiveAction(session, {
  actor: 'test-agent',
  tool: 'execute_capability',
  capability: 'skill.laptop_repairer',
  action: 'inspect',
});
assert.equal(first.allowed, true);
assert.equal(first.usage.actions, 1);

const second = await authorizeAgentObjectiveAction(session, {
  actor: 'test-agent',
  tool: 'execute_capability',
  capability: 'skill.sale',
  action: 'prepare',
});
assert.equal(second.allowed, false);
assert.equal(second.reason, 'max_actions');

console.log('Agent objective execution coordinator contract passed.');
