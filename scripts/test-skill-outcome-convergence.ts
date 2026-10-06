/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-skill-outcome-convergence-${process.pid}-${Date.now()}.sqlite`;
const { buildSkillOutcomeCoverage, getAllConvergedSkillNames, getConvergedSkillBehaviour } = await import('../src/services/skillBehaviourConvergence.js');
const { getLocalSkillExtensions } = await import('../src/services/skillCatalogueConvergence.js');
const { getKnownSkills } = await import('../src/services/skillFlows.js');

const names = getAllConvergedSkillNames();
assert.equal(new Set(names).size, names.length, 'skill IDs must be unique');
assert.ok(names.length >= 205, `expected at least 205 skills, found ${names.length}`);
assert.ok(names.includes('bin_day'), 'bin_day must remain canonical');
for (const skill of getKnownSkills()) {
  const pack = getConvergedSkillBehaviour(skill);
  assert.ok(pack.instructions.length, `${skill} missing behaviour instructions`);
  assert.ok(pack.required.length, `${skill} missing required context`);
  assert.ok(pack.capabilities.length, `${skill} missing capabilities`);
  assert.ok(pack.completionEvidence.length, `${skill} missing completion evidence`);
  assert.ok(pack.failureModes.length, `${skill} missing recovery model`);
}
for (const extension of getLocalSkillExtensions()) {
  const pack = getConvergedSkillBehaviour(extension.skill);
  assert.ok(pack.instructions.length, `${extension.skill} missing behaviour instructions`);
  assert.ok(pack.required.length, `${extension.skill} missing requirements`);
  assert.ok(pack.completionEvidence.length, `${extension.skill} missing evidence`);
  assert.ok(pack.failureModes.length, `${extension.skill} missing failures`);
}
for (const deviceSkill of ['phone_repairer','laptop_repairer','tablet_repairer','console_repairer','tv_repairer','smartwatch_repairer','earbuds_repairer','speaker_repairer','appliance_repairer','bicycle_repairer','motorbike_repairer','vehicle_recovery']) {
  assert.ok(names.includes(deviceSkill), `${deviceSkill} missing from convergence catalogue`);
  const pack = getConvergedSkillBehaviour(deviceSkill);
  assert.ok(pack.instructions.some(x => /memory profile/i.test(x)), `${deviceSkill} must be memory-aware`);
}
const bin = getConvergedSkillBehaviour('bin_day');
assert.equal(bin.completionEvidence.length > 0, true);
assert.ok(bin.instructions.some(x => /authoritative information/i.test(x)), 'bin_day must require authoritative source handling');
const audit = buildSkillOutcomeCoverage();
assert.equal(audit.length, names.length);
assert.ok(audit.every(item => item.behaviour && item.evidence && item.failureRecovery && item.memoryAware));
console.log(`Skill outcome convergence passed: ${names.length} skills, ${getLocalSkillExtensions().length} local additions.`);
