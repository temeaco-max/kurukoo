import fs from 'node:fs';
import path from 'node:path';
import { getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';
import { FASTTEXT_ROUTING_CONFIG } from '../src/services/fastTextRoutingConfig.js';

const output = path.join(process.cwd(), 'models', 'intent_training_skill_hints.txt');
fs.mkdirSync(path.dirname(output), { recursive: true });

const examples = new Set<string>();
for (const skill of getAllConvergedSkillNames()) {
  const pack = getConvergedSkillBehaviour(skill);
  const label = `__label__skill_route_${skill.replace(/[^a-z0-9_]+/gi, '_')}`;
  const aliases = Array.from(new Set([skill.replace(/_/g, ' '), ...pack.aliases]))
    .map(alias => alias.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const candidates = aliases.flatMap(alias => [alias, `i need ${alias}`]);
  for (const example of candidates.slice(0, FASTTEXT_ROUTING_CONFIG.corpus.bootstrapWeightCapPerLabel)) examples.add(`${label} ${example}`);
}
fs.writeFileSync(output, `${Array.from(examples).sort().join('\n')}\n`, 'utf8');
console.log(`[FastText] generated ${examples.size} skill-hint examples for ${getAllConvergedSkillNames().length} skills: ${output}`);
