import assert from 'node:assert/strict';
import { getKurukooAgentCard } from '../src/services/agentOperatingModel.js';
import { routeAgentModel } from '../src/services/agentModelRouter.js';

const card = getKurukooAgentCard();
assert.equal(card.id, 'kurukoo');
assert.equal(card.delegation.recursiveDelegationAllowed, false);
assert.equal(card.delegation.humanApprovalRequiredForExternalExecution, true);

const bounded = routeAgentModel({ reasoningClass: 'bounded', slmEnabled: false, cheapRemoteEnabled: false });
assert.equal(bounded.route, 'strong_remote');

console.log('Agent operating model end-to-end contract passed.');
