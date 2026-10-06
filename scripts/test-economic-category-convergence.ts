/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-economic-category-convergence-${process.pid}-${Date.now()}.sqlite`;
const { ECONOMIC_CATEGORIES, getSkillCapabilities, getSkillRequirements, getEconomicCategory } = await import('../src/services/skillFlows.js');
const { getAllConvergedSkillNames } = await import('../src/services/skillBehaviourConvergence.js');
const { buildSkillExecutionContract } = await import('../src/services/skillExecutionContract.js');

const skills = getAllConvergedSkillNames();
const representatives = new Map<string, string>();
for (const skill of skills) {
  const category = getEconomicCategory(skill);
  if (category && !representatives.has(category)) representatives.set(category, skill);
}

for (const category of ECONOMIC_CATEGORIES) {
  const skill = representatives.get(category);
  assert.ok(skill, `${category}: no converged representative skill`);
  const requirements = getSkillRequirements(skill!);
  const capabilities = getSkillCapabilities(skill!);
  const contract = buildSkillExecutionContract(skill!);
  assert.ok(requirements.length, `${category}/${skill}: no requirements`);
  assert.ok(capabilities.length, `${category}/${skill}: no capabilities`);
  assert.ok(contract.completionEvidence.length, `${category}/${skill}: no completion evidence`);
  assert.ok(contract.failureModes.length, `${category}/${skill}: no failure modes`);
  assert.ok(contract.memoryKeys.length, `${category}/${skill}: no memory policy`);
}

console.log(`Economic category convergence passed ${ECONOMIC_CATEGORIES.length} categories across ${skills.length} converged skills.`);
