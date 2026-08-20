import fs from 'node:fs';
import path from 'node:path';
import { buildSkillOutcomeCoverage, getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';
import { getCatalogueStats, getLocalSkillExtensions } from '../src/services/skillCatalogueConvergence.js';

const root = process.cwd();
const output = path.join(root, 'data', 'audits', 'skill-outcome-convergence.json');
const coverage = buildSkillOutcomeCoverage();
const catalogue = getCatalogueStats();
const localSkills = getLocalSkillExtensions().map(x => x.skill);
const missing: string[] = [];
for (const skill of getAllConvergedSkillNames()) {
  const pack = getConvergedSkillBehaviour(skill);
  if (!pack.required.length) missing.push(`${skill}:requirements`);
  if (!pack.instructions.length) missing.push(`${skill}:behaviour`);
  if (!pack.completionEvidence.length) missing.push(`${skill}:evidence`);
  if (!pack.failureModes.length) missing.push(`${skill}:failure-recovery`);
  if (!pack.capabilities.length) missing.push(`${skill}:capabilities`);
}
const aliases = new Map<string,string[]>();
for (const skill of getAllConvergedSkillNames()) {
  const pack = getConvergedSkillBehaviour(skill);
  for (const alias of [skill, ...pack.aliases]) {
    const key = alias.trim().toLowerCase();
    const current = aliases.get(key) || [];
    current.push(skill);
    aliases.set(key, current);
  }
}
const collisions = [...aliases.entries()]
  .map(([alias, skills]) => ({ alias, skills: [...new Set(skills)] }))
  .filter(({ skills }) => skills.length > 1);
const result = {
  generatedAt: new Date().toISOString(),
  catalogue,
  baseSkillCount: catalogue.core,
  localExtensionCount: catalogue.extensions,
  totalSkillCount: catalogue.total,
  targetReached: getAllConvergedSkillNames().length === catalogue.total,
  completeContracts: missing.length === 0,
  missing,
  aliasCollisions: collisions,
  coverage,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ catalogue: result.catalogue, completeContracts: result.completeContracts, aliasCollisions: collisions.length, output }, null, 2));
if (!result.targetReached || !result.completeContracts) process.exitCode = 1;
