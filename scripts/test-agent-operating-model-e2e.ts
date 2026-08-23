import assert from 'node:assert/strict';

/**
 * Repository-level end-to-end contract for the governed Agent operating model.
 * It verifies the canonical owners are present without executing external work.
 */
import { getKurukooAgentCard } from '../src/services/agentOperatingModel.js';
import { routeAgentModel } from '../src/services/agentModelRouter.js';

const card = getKurukooAgentCard();
assert.equal(card.id, 'kurukoo');
assert.equal(card.delegation.recursiveDelegationAllowed, false);
assert.equal(card.delegation.humanApprovalRequiredForExternalExecution, true);

const bounded = routeAgentModel({ reasoningClass: 'bounded', slmEnabled: false, cheapRemoteEnabled: false });
assert.equal(bounded.route, 'strong_remote');

console.log('Agent operating model end-to-end contract passed: canonical Agent identity, governed delegation and bounded model routing remain connected without granting external execution authority.');
