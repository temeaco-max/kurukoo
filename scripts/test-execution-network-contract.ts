import assert from 'node:assert/strict';
import { EXECUTION_NETWORK_CONTRACT_VERSION, listExecutionNetworkPillars, validateExecutionNetworkContract } from '../src/services/executionNetworkContract.js';

const result = validateExecutionNetworkContract();
assert.equal(EXECUTION_NETWORK_CONTRACT_VERSION, '1.0');
assert.equal(result.valid, true, JSON.stringify(result));
assert.equal(result.count, 43);

const pillars = listExecutionNetworkPillars();
assert.equal(new Set(pillars.map(pillar => pillar.id)).size, 43);
for (const pillar of pillars) {
  assert.ok(pillar.name.length > 0, `Missing name for ${pillar.id}`);
  assert.ok(pillar.owners.length > 0, `Missing owner for ${pillar.id}`);
  assert.ok(pillar.capabilityRefs.length > 0, `Missing capability reference for ${pillar.id}`);
  assert.ok(pillar.testIntent.length > 0, `Missing test intent for ${pillar.id}`);
}

console.log(`[execution-network-contract] PASS v${EXECUTION_NETWORK_CONTRACT_VERSION}: ${pillars.length} pillars are defined and testable.`);
