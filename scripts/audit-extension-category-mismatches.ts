import assert from 'node:assert/strict';
import { ECONOMIC_CATEGORIES, getEconomicCategory, getKnownSkills, getSkillCapabilities, getSkillRequirements } from '../src/services/skillFlows.js';

const knownCategories = new Set<string>(ECONOMIC_CATEGORIES);
const skills = getKnownSkills();
const mismatches: Array<{ skill: string; reason: string }> = [];

for (const skill of skills) {
  const category = getEconomicCategory(skill);
  if (!category || !knownCategories.has(category)) {
    mismatches.push({ skill, reason: `unknown category: ${category || 'none'}` });
    continue;
  }
  const requirements = getSkillRequirements(skill);
  if (!requirements.length || requirements.some(requirement => !requirement.key || !requirement.label)) {
    mismatches.push({ skill, reason: 'missing canonical requirement metadata' });
  }
  if (!getSkillCapabilities(skill).length) {
    mismatches.push({ skill, reason: 'missing canonical capability metadata' });
  }
}

assert.ok(skills.length > 0, 'canonical skill catalogue is empty');
assert.equal(getEconomicCategory('__unknown_extension_skill__'), null, 'unknown extension skills must not be assigned a category');
assert.deepEqual(mismatches, [], `category/capability mismatch: ${JSON.stringify(mismatches)}`);
console.log(JSON.stringify({ passed: true, auditedSkills: skills.length, categories: knownCategories.size, mismatches }, null, 2));
