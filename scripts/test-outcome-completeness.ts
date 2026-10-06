/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-outcome-completeness-${process.pid}-${Date.now()}.sqlite`;
const { buildOutcomeCompletenessMatrix, summarizeOutcomeCompleteness } = await import('../src/services/outcomeCompleteness.js');
const { getAllConvergedSkillNames } = await import('../src/services/skillBehaviourConvergence.js');

const rows = await buildOutcomeCompletenessMatrix('ng');
const summary = summarizeOutcomeCompleteness(rows);
assert.equal(summary.skillCount, getAllConvergedSkillNames().length, 'the outcome matrix must cover every converged canonical skill');
assert.equal(summary.missingImplementationCount, 0, 'every canonical skill must have a canonical flow definition');
assert.ok(summary.familyCount > 0, 'the outcome matrix must cover canonical skill families');
assert.ok(rows.every((row) => row.canonicalOwner.length > 0), 'every skill must name a canonical owner');
assert.ok(rows.every((row) => row.chatEntry.includes('canonicalChatTurnService')), 'every skill must retain the canonical Chat entry');
assert.ok(rows.every((row) => row.lifecycleStates.length >= 4), 'every skill must expose an applicable outcome lifecycle');
assert.ok(rows.every((row) => row.executionBoundaries.length > 0 && row.failureRecovery.length > 0), 'every skill must expose execution and failure boundaries');
assert.ok(rows.every((row) => row.status === 'REPOSITORY_READY_EXTERNAL_ACTIVATION' || row.status === 'IMPLEMENTED_AND_VERIFIED'), 'matrix status must use truthful repository-side vocabulary');
console.log(`Outcome completeness regression passed: ${summary.skillCount} skills, ${summary.familyCount} families, ${summary.missingImplementationCount} missing flows.`);
