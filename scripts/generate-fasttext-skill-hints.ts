import fs from 'node:fs';
import path from 'node:path';
import { getAllConvergedSkillNames, getConvergedSkillBehaviour } from '../src/services/skillBehaviourConvergence.js';

const output = path.join(process.cwd(), 'models', 'intent_training_skill_hints.txt');
fs.mkdirSync(path.dirname(output), { recursive: true });

function normalize(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function examplesForAlias(alias: string): string[] {
  const clean = normalize(alias);
  if (!clean) return [];
  return [
    clean,
    `i need ${clean}`,
    `can you help me with ${clean}`,
    `please help me find ${clean}`,
    `abeg i need ${clean}`,
    `i dey look for ${clean}`,
    `fit you help me with ${clean}`,
    `i need ${clean} around my area`,
  ];
}

const examples = new Set<string>();
for (const skill of getAllConvergedSkillNames()) {
  const pack = getConvergedSkillBehaviour(skill);
  const label = `__label__skill_route_${skill.replace(/[^a-z0-9_]+/gi, '_')}`;
  const aliases = Array.from(new Set([
    skill.replace(/_/g, ' '),
    ...pack.aliases,
  ].map(normalize).filter(Boolean))).slice(0, 3);
  for (const alias of aliases) {
    for (const example of examplesForAlias(alias)) examples.add(`${label} ${example}`);
  }
}
const lines = Array.from(examples).sort();
fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(`[FastText] generated ${lines.length} deterministic real-world skill-hint examples for ${getAllConvergedSkillNames().length} skills: ${output}`);
