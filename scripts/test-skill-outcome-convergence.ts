import assert from 'node:assert/strict';
import { buildSkillOutcomeCoverage, getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';
import { getCatalogueStats, getLocalSkillExtensions } from '../src/services/skillCatalogueConvergence.js';
import { getEconomicCategory, getKnownSkills } from '../src/services/skillFlows.js';
import { buildSkillExecutionContract } from '../src/services/skillExecutionContract.js';

const names = getAllConvergedSkillNames();
assert.equal(new Set(names).size, names.length, 'skill IDs must be unique');
const catalogue = getCatalogueStats();
const audit = buildSkillOutcomeCoverage();
const outcomeBySkill = new Map(audit.map(item => [item.skill, item]));
assert.deepEqual(catalogue, { core: 205, extensions: 36, total: 241 }, 'catalogue counts must be derived from the canonical registry and extensions');
assert.equal(names.length, catalogue.total, 'converged names must equal the derived catalogue total');
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
  const contract = buildSkillExecutionContract(extension.skill);
  assert.ok(pack.instructions.length, `${extension.skill} missing behaviour instructions`);
  assert.ok(pack.required.length, `${extension.skill} missing requirements`);
  assert.ok(pack.completionEvidence.length, `${extension.skill} missing evidence`);
  assert.ok(pack.failureModes.length, `${extension.skill} missing failures`);
  assert.equal(contract.category, extension.category, `${extension.skill} contract must consume the canonical extension category`);
  if (!extension.baseSkill) {
    assert.equal(extension.categoryOverride, undefined, `${extension.skill} cannot declare an override without a base skill`);
    continue;
  }
  const baseCategory = getEconomicCategory(extension.baseSkill);
  assert.ok(baseCategory, `${extension.skill} base skill ${extension.baseSkill} must exist in the canonical core catalogue`);
  if (baseCategory === extension.category) {
    assert.equal(extension.categoryOverride, undefined, `${extension.skill} must not document an override when its category matches ${extension.baseSkill}`);
  } else {
    assert.ok(extension.categoryOverride?.rationale.trim(), `${extension.skill} category override must document its rationale`);
    assert.ok(extension.categoryOverride?.scenarioFocus.trim(), `${extension.skill} category override must document its scenario focus`);
    assert.equal(outcomeBySkill.get(extension.skill)?.mode, extension.mode, `${extension.skill} outcome coverage must preserve its canonical extension mode`);
  }
}
for (const deviceSkill of ['phone_repairer','laptop_repairer','tablet_repairer','console_repairer','tv_repairer','smartwatch_repairer','earbuds_repairer','speaker_repairer','appliance_repairer','bicycle_repairer','motorbike_repairer','vehicle_recovery']) {
  assert.ok(names.includes(deviceSkill), `${deviceSkill} missing from convergence catalogue`);
  const pack = getConvergedSkillBehaviour(deviceSkill);
  assert.ok(pack.instructions.some(x => /memory profile/i.test(x)), `${deviceSkill} must be memory-aware`);
}
const bin = getConvergedSkillBehaviour('bin_day');
assert.equal(bin.completionEvidence.length > 0, true);
assert.ok(bin.instructions.some(x => /authoritative information/i.test(x)), 'bin_day must require authoritative source handling');
assert.equal(audit.length, names.length);
assert.ok(audit.every(item => item.behaviour && item.evidence && item.failureRecovery && item.memoryAware));
const documentedOverrides = getLocalSkillExtensions().filter(extension => extension.categoryOverride);
console.log(`Skill outcome convergence passed: ${catalogue.total} skills (${catalogue.core} core + ${catalogue.extensions} extensions), ${documentedOverrides.length} documented category overrides.`);
