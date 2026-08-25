// Stage 1 (coarse category) FastText model builder.
//
// Derives category training data STRICTLY from the canonical taxonomy:
//   - every existing intent/skill training line is re-labelled via getEconomicCategory()
//   - conversational acts keep their own coarse label (they are not economic skills)
// No new taxonomy and no mechanically fabricated examples.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';



const root = process.cwd();
const modelsDir = path.join(root, 'models');

const sourceCorpusFiles = [
  path.join(modelsDir, 'intent_training_data.txt'),
  path.join(modelsDir, 'intent_training_behaviour_additions.txt'),
  path.join(modelsDir, 'intent_training_skill_hints.txt'),
].filter((p) => fs.existsSync(p));

const { getEconomicCategory } = await import('../src/services/skillFlows.js');

const CONVERSATIONAL_ACTS = new Set([
  'general_question', 'greeting', 'thanks', 'confirmation', 'negation', 'correction',
  'clarification', 'how_to', 'status', 'cancel', 'emergency', 'bin_day', 'advertising',
  'prayer', 'sports_matchmaking', 'order_food', 'ride_request', 'find_worker',
]);

function categoryForLabel(label) {
  const economic = getEconomicCategory(label);
  if (economic) return economic;
  if (CONVERSATIONAL_ACTS.has(label)) return `act_${label}`;
  return null;
}

const linesByCategory = new Map();
let total = 0;
let skipped = 0;
for (const file of sourceCorpusFiles) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('__label__')) continue;
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) continue;
    const label = line.slice(9, spaceIdx).trim();
    const text = line.slice(spaceIdx + 1).trim();
    if (!text) continue;
    const category = categoryForLabel(label);
    if (!category) { skipped += 1; continue; }
    if (!linesByCategory.has(category)) linesByCategory.set(category, []);
    linesByCategory.get(category).push(text);
    total += 1;
  }
}

const outLines = [];
for (const [category, texts] of [...linesByCategory.entries()].sort()) {
  for (const text of texts) outLines.push(`__label__${category} ${text}`);
}
const corpusPath = path.join(modelsDir, '.intent_category_training.merged.txt');
fs.writeFileSync(corpusPath, `${outLines.join('\n')}\n`, 'utf8');
console.log(`[FastText category build] sources=${sourceCorpusFiles.length} examples=${total} categories=${linesByCategory.size} unmapped=${skipped}`);

const outputBase = path.join(modelsDir, 'kurukoo_category');
execFileSync('fasttext', [
  'supervised', '-input', corpusPath, '-output', outputBase,
  '-lr', '0.75', '-epoch', '80', '-wordNgrams', '2', '-dim', '75',
  '-bucket', '20000', '-minn', '1', '-maxn', '3', '-thread', '1',
], { stdio: 'inherit', timeout: 180000 });

try { fs.unlinkSync(corpusPath); } catch {}
const binPath = `${outputBase}.bin`;
if (fs.existsSync(binPath)) {
  console.log(`[FastText category build] model ready: ${binPath} (${fs.statSync(binPath).size} bytes)`);
} else {
  process.exitCode = 1;
}
