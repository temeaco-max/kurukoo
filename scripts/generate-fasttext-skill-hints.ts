import fs from 'node:fs';
import path from 'node:path';
import { getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';

const output = path.join(process.cwd(), 'models', 'intent_training_skill_hints.txt');
fs.mkdirSync(path.dirname(output), { recursive: true });

const examples = new Set<string>();
for (const skill of getAllConvergedSkillNames()) {
  const pack = getConvergedSkillBehaviour(skill);
  const label = `__label__skill_route_${skill.replace(/[^a-z0-9_]+/gi, '_')}`;
  const aliases = Array.from(new Set([skill.replace(/_/g, ' '), ...pack.aliases])).filter(Boolean);
  const primary = aliases[0] || skill.replace(/_/g, ' ');
  const alternate = aliases.find((alias) => alias !== primary) || primary;
  for (const clean of [primary, alternate]) {
    const normalized = clean.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    examples.add(`${label} ${normalized}`);
    examples.add(`${label} i need ${normalized}`);
  }
}
const lines = Array.from(examples).sort();
fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(`[FastText] generated ${lines.length} bounded skill-hint examples for ${getAllConvergedSkillNames().length} skills: ${output}`);