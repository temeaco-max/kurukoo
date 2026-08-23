import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const route = readFileSync('src/routes/agentRouter.ts', 'utf8');
const model = readFileSync('src/services/agentOperatingModel.ts', 'utf8');

assert.match(route, /authenticateUser/);
assert.match(route, /getKurukooAgentCard/);
assert.match(route, /listAgentOperatingCapabilities/);
assert.match(route, /getAgentOperatingCapability/);
assert.match(route, /getAgentRunSummary/);
assert.match(route, /router\.get\('\/card'/);
assert.match(route, /router\.get\('\/capabilities'/);
assert.match(route, /router\.get\('\/capabilities\/:capability'/);
assert.match(route, /router\.get\('\/goals\/:id\/run-summary'/);
assert.match(model, /humanApprovalRequiredForExternalExecution: true/);
assert.match(model, /recursiveDelegationAllowed: false/);

for (const forbidden of ['createNewAgentRuntime', 'newCapabilityRegistry', 'newEconomicRequestLifecycle', 'executeExternalAgentDirectly']) {
  assert.equal(route.includes(forbidden), false, `route introduced forbidden authority ${forbidden}`);
}

console.log('Agent operating model API boundary passed.');
