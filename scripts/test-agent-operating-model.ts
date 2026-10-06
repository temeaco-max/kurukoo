/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-agent-operating-model-${process.pid}-${Date.now()}.sqlite`;
const { getAgentRunSummary, getKurukooAgentCard, listAgentOperatingCapabilities, validateAgentOperatingModel } = await import('../src/services/agentOperatingModel.js');
const { listAgentTools } = await import('../src/services/agentToolRegistry.js');

const card = getKurukooAgentCard();
assert.equal(card.id, 'kurukoo.agent');
assert.equal(card.userFacing, true);
assert.equal(card.guardrails.recursiveDelegationAllowed, false);
assert.equal(card.guardrails.humanApprovalRequiredForExternalExecution, true);
assert.ok(card.roles.includes('request_coordinator'));
assert.ok(card.roles.includes('provider_liaison'));
assert.ok(card.externalInterfaces.includes('a2a'));
assert.ok(card.externalInterfaces.includes('mcp'));
assert.ok(card.toolNames.length > 0);

const tools = listAgentTools();
assert.deepEqual(card.toolNames.sort(), tools.map(tool => tool.name).sort());
assert.ok(tools.every(tool => tool.authorization && tool.audit && tool.idempotency));

const capabilities = await listAgentOperatingCapabilities();
assert.ok(capabilities.length > 0);
assert.ok(capabilities.some(item => item.capability === 'agent'));
assert.ok(capabilities.some(item => item.capability === 'economic_request'));
assert.ok(capabilities.every(item => item.actions.length > 0));
assert.ok(capabilities.every(item => item.continuationContext.length > 0));

const validation = validateAgentOperatingModel();
assert.equal(typeof validation.valid, 'boolean');
assert.equal(typeof validation.capabilityRegistry.valid, 'boolean');
assert.ok(Array.isArray(validation.missingCanonicalOwners));
assert.ok(Array.isArray(validation.invalidToolAuthorization));

// An absent goal must remain a clean read-only miss and never create state.
assert.equal(await getAgentRunSummary('agent-operating-model-test-owner', 'missing-goal'), null);

console.log('Agent operating model contract passed: one user-facing Agent card, canonical capabilities/tools, bounded delegation, explicit authority/evidence ownership, and read-only run projection.');
