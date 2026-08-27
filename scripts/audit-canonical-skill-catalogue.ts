import { getKnownSkills, getEconomicCategory } from '../src/services/skillFlows.js';
import { getAllCatalogueSkillNames, getSkillExtension, getSkillCategoryConverged } from '../src/services/skillCatalogueConvergence.js';
import { getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';
import fs from 'node:fs';
import path from 'node:path';

const core = [...new Set(getKnownSkills())];
const canonical = [...new Set(getAllCatalogueSkillNames())].sort();
const extensions = canonical.filter(skill => !core.includes(skill));
const duplicateCore = getKnownSkills().filter((skill, index, list) => list.indexOf(skill) !== index);
const duplicateCanonical = canonical.filter((skill, index, list) => list.indexOf(skill) !== index);
const categoryOverrides: Array<{ skill: string; baseSkill: string; baseCategory: string; declaredCategory: string; rationale: string }> = [];
const missingBehaviour: string[] = [];

for (const skill of canonical) {
  const ext = getSkillExtension(skill);
  if (ext?.baseSkill) {
    const baseCategory = getEconomicCategory(ext.baseSkill) || getSkillCategoryConverged(ext.baseSkill) || 'general';
    if (baseCategory !== ext.category) categoryOverrides.push({ skill, baseSkill: ext.baseSkill, baseCategory, declaredCategory: ext.category, rationale: 'Explicit SkillExtension category override is authoritative for the specialized skill; baseSkill supplies capability reuse, not taxonomy ownership.' });
  }
  const behaviour = getConvergedSkillBehaviour(skill);
  if (!behaviour.instructions.length || !behaviour.required || !behaviour.completionEvidence.length || !behaviour.failureModes.length) missingBehaviour.push(skill);
}

const report = {
  generatedAt: new Date().toISOString(),
  coreCount: core.length,
  extensionCount: extensions.length,
  canonicalCount: canonical.length,
  canonicalMinimumSatisfied: canonical.length >= 241,
  duplicateCore,
  duplicateCanonical,
  categoryOverrideCount: categoryOverrides.length,
  categoryOverrides,
  missingBehaviourCount: missingBehaviour.length,
  missingBehaviour,
  extensions,
};
fs.mkdirSync(path.join(process.cwd(), 'data', 'audits'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'data', 'audits', 'canonical-skill-catalogue.json'), `${JSON.stringify(report, null, 2)}\n`);
if (report.coreCount !== 206) throw new Error(`Canonical core skill count changed unexpectedly: expected 206, found ${report.coreCount}`);
if (report.canonicalCount < 241) throw new Error(`Canonical catalogue regressed below 241 skills: found ${report.canonicalCount}`);
if (duplicateCore.length || duplicateCanonical.length || missingBehaviour.length) throw new Error(`Canonical catalogue integrity failed: duplicateCore=${duplicateCore.length} duplicateCanonical=${duplicateCanonical.length} missingBehaviour=${missingBehaviour.length}`);
console.log(JSON.stringify({ core: core.length, extensions: extensions.length, canonical: canonical.length, categoryOverrides: categoryOverrides.length }, null, 2));
