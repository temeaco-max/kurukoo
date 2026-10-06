/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-capability-reconciliation-${process.pid}-${Date.now()}.sqlite`;
const { reconcileAICapabilityProposal } = await import('../src/services/aiCapabilityReconciliationService.js');

const contract: any = {
  mode: 'proposal',
  actionPosture: 'action',
  shouldAskClarification: false,
  shouldRequireCanonicalAction: true,
  requiresStructuredProposal: true,
  shouldPreserveExistingContext: true,
  protectedContextIds: ['request:req-1'],
};

const canonical: any = {
  skill: 'find_worker',
  target_skill: undefined,
  canonicalAction: 'economic_request.create',
  extractedEntities: { service: 'plumber', location: 'Ibadan' },
  intentConfidence: 0.97,
};

const semantic = {
  capability: 'unrelated_capability',
  action: 'wrong.action',
  arguments: { service: 'something-else' },
  confidence: 0.99,
  posture: 'propose' as const,
};

const decision = reconcileAICapabilityProposal(canonical, semantic, contract);
assert.equal(decision.source, 'canonical');
assert.equal(decision.capability, 'find_worker');
assert.equal(decision.action, 'economic_request.create');
assert.equal(decision.arguments.service, 'plumber');
assert.equal(decision.arguments.location, 'Ibadan');
assert.equal(decision.requiresCanonicalValidation, true);

const gapRouting: any = {
  skill: 'general_question',
  target_skill: undefined,
  canonicalAction: undefined,
  extractedEntities: {},
  intentConfidence: 0.42,
};
const gapSemantic = {
  capability: 'find_worker',
  action: 'economic_request.create',
  arguments: { service: 'cleaner', location: 'Ibadan' },
  confidence: 0.91,
  posture: 'propose' as const,
};
const gapDecision = reconcileAICapabilityProposal(gapRouting, gapSemantic, contract);
assert.equal(gapDecision.source, 'semantic');
assert.equal(gapDecision.capability, 'find_worker');
assert.equal(gapDecision.action, 'economic_request.create');

const blockedContract = { ...contract, shouldAvoidAction: true };
const blocked = reconcileAICapabilityProposal(gapRouting, gapSemantic, blockedContract);
assert.equal(blocked.posture, 'none');
assert.equal(blocked.source, 'none');

console.log('AI capability reconciliation regression passed.');
