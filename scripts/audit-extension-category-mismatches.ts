import { getEconomicCategory } from '../src/services/skillFlows.js';
import { getCatalogueStats, getLocalSkillExtensions } from '../src/services/skillCatalogueConvergence.js';
import { buildSkillOutcomeCoverage, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';

const coverage = new Map(buildSkillOutcomeCoverage().map(item => [item.skill, item]));
const invalidBases: Array<{ skill: string; baseSkill: string }> = [];
const undocumented: string[] = [];
const unnecessaryDocumentation: string[] = [];
const overrides = getLocalSkillExtensions().flatMap(extension => {
  if (!extension.baseSkill) return [];
  const baseCategory = getEconomicCategory(extension.baseSkill);
  if (!baseCategory) {
    invalidBases.push({ skill: extension.skill, baseSkill: extension.baseSkill });
    return [];
  }
  if (baseCategory === extension.category) {
    if (extension.categoryOverride) unnecessaryDocumentation.push(extension.skill);
    return [];
  }
  if (!extension.categoryOverride?.rationale.trim() || !extension.categoryOverride.scenarioFocus.trim()) undocumented.push(extension.skill);
  const behaviour = getConvergedSkillBehaviour(extension.skill);
  return [{
    skill: extension.skill,
    baseSkill: extension.baseSkill,
    baseCategory,
    extensionCategory: extension.category,
    rationale: extension.categoryOverride?.rationale || null,
    scenarioFocus: extension.categoryOverride?.scenarioFocus || null,
    mode: behaviour.mode,
    outcomeCategory: coverage.get(extension.skill)?.category || null,
  }];
});

console.log(JSON.stringify({
  catalogue: getCatalogueStats(),
  deliberateOverrides: overrides,
  invalidBases,
  undocumented,
  unnecessaryDocumentation,
}, null, 2));

if (invalidBases.length || undocumented.length || unnecessaryDocumentation.length) process.exitCode = 1;
