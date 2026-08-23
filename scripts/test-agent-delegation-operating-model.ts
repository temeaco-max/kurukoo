import fs from 'node:fs';
import assert from 'node:assert/strict';

const route = fs.readFileSync('src/routes/agentDelegationRoutes.ts', 'utf8');
const adapter = fs.readFileSync('src/services/agentDelegationOperatingModel.ts', 'utf8');

assert.match(route, /executeDelegatedAgentWithCanonicalRun/);
assert.doesNotMatch(route, /executeUserAgentDelegation\(phone, delegationId, task\)/);
assert.match(route, /req\.body\?\.action/);
assert.match(adapter, /ensureAgentRuntimeSchema/);
assert.match(adapter, /executeAgentTool/);
assert.match(adapter, /getCapabilityRegistration/);
assert.match(adapter, /resolveCapabilityAction/);
assert.match(adapter, /INSERT INTO agent_goals/);
assert.match(adapter, /INSERT INTO agent_goal_events/);
assert.match(adapter, /delegated_run_started/);
assert.match(adapter, /delegated_run_completed/);
assert.match(adapter, /canonical_capability_executor/);
assert.match(adapter, /legacy_compatibility/);
assert.match(adapter, /executeUserAgentDelegation/);

console.log('agent delegation operating-model compatibility contract passed');
