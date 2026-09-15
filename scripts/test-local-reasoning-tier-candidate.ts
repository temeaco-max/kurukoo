/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';

/**
 * Prepared (NOT activated) test for the proposed local reasoning/tool tier.
 *
 * Two phases:
 *  1. Guard: with the CURRENT policy (patch NOT applied), assert production
 *     behaviour is unchanged — Qwen2.5-0.5B fast tier, SmolLM2 360M fallback,
 *     hosted complex reasoning, and that no localReasoningTool role exists yet.
 *  2. Prepared-contract check: validate that the proposed patch file keeps the
 *     safety invariants (opt-in via env, default unset, hosted tasks preserved,
 *     fast tier unchanged) so the change can be reviewed before activation.
 *
 * This test does NOT modify the policy and does not activate any model.
 */

const policySource = fs.readFileSync(
  new URL('../src/services/localModelPolicy.ts', import.meta.url),
  'utf8',
);

// --- Phase 1: current production behaviour is unchanged ---
const { LOCAL_MODEL_POLICY, resolveLocalModelSelection } = await import('../src/services/localModelPolicy.js');
assert.equal(LOCAL_MODEL_POLICY.defaultModel, 'qwen2.5-0.5b', 'fast tier must remain Qwen2.5-0.5B');
assert.equal(LOCAL_MODEL_POLICY.fallbackModel, 'smollm2:360m', 'fallback must remain SmolLM2 360M');
assert.equal(LOCAL_MODEL_POLICY.roles.localFast, 'qwen2.5-0.5b', 'localFast role unchanged');
assert.equal(LOCAL_MODEL_POLICY.roles.complexReasoning, 'hosted', 'complex reasoning must remain hosted');
assert.deepEqual([...LOCAL_MODEL_POLICY.hostedRequiredTasks], ['planning', 'agent_execution', 'high_stakes'], 'hosted-required tasks unchanged');
assert.ok(!('localReasoningTool' in (LOCAL_MODEL_POLICY.roles as Record<string, unknown>)), 'localReasoningTool must NOT exist until the prepared change is approved');
const selection = resolveLocalModelSelection();
assert.match(selection.source, /policy-default|explicit|registry/, 'selection source must be a recognised boundary');
assert.ok(selection.model, 'a local model must always be resolvable');
console.log('guard: production policy unchanged (fast=' + selection.model + ', fallback=' + selection.fallbackModel + ', source=' + selection.source + ')');

// --- Phase 2: prepared patch preserves safety invariants ---
const patchSource = fs.readFileSync(
  new URL('../docs/verification/proposed-local-model-policy.patch', import.meta.url),
  'utf8',
);
assert.match(patchSource, /KURUKOO_LOCAL_REASONING_MODEL/, 'proposed role must be env-gated');
assert.match(patchSource, /\|\| ''\)\.trim\(\) \|\| null/, 'proposed role must default to null (unset = unchanged behaviour)');
assert.match(patchSource, /localReasoningToolTasks: \['planning'\]/, 'proposed tier may only attempt planning, never high_stakes');
assert.ok(!/high_stakes/.test(patchSource.split('localReasoningToolTasks')[1].split(';')[0]), 'proposed tier must not include high_stakes');
assert.match(patchSource, /per-model prompt-template adapter/, 'patch must document the smolLm2Service template-adapter prerequisite');
assert.match(patchSource, /runtime qualification/, 'patch must require runtime qualification before activation');
assert.match(policySource, /Qwen2\.5-0\.5B/, 'policy docstring must keep naming the qualified fast candidate');
console.log('prepared: proposed patch preserves all safety invariants (NOT activated)');
