import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FASTTEXT_ROUTING_CONFIG } from '../src/services/fastTextRoutingConfig.js';

const models = path.join(process.cwd(), 'models');
const output = path.join(models, '.intent_training_data.merged.txt');
const manifestOutput = path.join(models, '.intent_training_data.merged.manifest.json');
const splitPaths = {
  train: path.join(models, '.intent_training_data.train.txt'),
  validation: path.join(models, '.intent_training_data.validation.txt'),
  test: path.join(models, '.intent_training_data.test.txt'),
};
const sources = [
  { name: 'curated', path: path.join(models, 'intent_training_curated.txt') },
  { name: 'behaviour', path: path.join(models, 'intent_training_behaviour_additions.txt') },
  { name: 'base', path: path.join(models, 'intent_training_data.txt') },
  { name: 'bootstrap', path: path.join(models, 'intent_training_skill_hints.txt') },
] as const;

const seen = new Set<string>();
const perLabel = new Map<string, number>();
const sourceStats: Record<string, { available: number; accepted: number; capped: number; duplicate: number }> = {};
const rows: string[] = [];
for (const source of sources) {
  const stats = sourceStats[source.name] = { available: 0, accepted: 0, capped: 0, duplicate: 0 };
  if (!fs.existsSync(source.path)) continue;
  for (const rawLine of fs.readFileSync(source.path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('__label__')) continue;
    stats.available += 1;
    if (seen.has(line)) { stats.duplicate += 1; continue; }
    const match = line.match(/^(__label__[^\s]+)/);
    if (!match) continue;
    const label = match[1];
    if ((perLabel.get(label) || 0) >= FASTTEXT_ROUTING_CONFIG.corpus.maxExamplesPerLabel) { stats.capped += 1; continue; }
    seen.add(line);
    perLabel.set(label, (perLabel.get(label) || 0) + 1);
    rows.push(line);
    stats.accepted += 1;
  }
}
const classCounts = Object.fromEntries([...perLabel.entries()].sort((a, b) => a[0].localeCompare(b[0])));
const counts = Object.values(classCounts);
const splitRows: Record<keyof typeof splitPaths, string[]> = { train: [], validation: [], test: [] };
for (const [label] of perLabel) {
  const labelRows = rows.filter(row => row.startsWith(`${label} `)).sort((a, b) => crypto.createHash('sha256').update(a).digest('hex').localeCompare(crypto.createHash('sha256').update(b).digest('hex')));
  if (labelRows.length >= 3) {
    splitRows.validation.push(labelRows[0]);
    splitRows.test.push(labelRows[1]);
    splitRows.train.push(...labelRows.slice(2));
  } else splitRows.train.push(...labelRows);
}
fs.writeFileSync(output, `${rows.join('\n')}\n`);
for (const [split, splitPath] of Object.entries(splitPaths)) fs.writeFileSync(splitPath, `${splitRows[split as keyof typeof splitPaths].join('\n')}\n`);
fs.writeFileSync(manifestOutput, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceStats,
  totalExamples: rows.length,
  splitCounts: Object.fromEntries(Object.entries(splitRows).map(([split, values]) => [split, values.length])),
  splitHashes: Object.fromEntries(Object.entries(splitRows).map(([split, values]) => [split, crypto.createHash('sha256').update(`${values.join('\n')}\n`).digest('hex')])),
  labelCount: counts.length,
  classCap: FASTTEXT_ROUTING_CONFIG.corpus.maxExamplesPerLabel,
  minExamplesPerLabel: counts.length ? Math.min(...counts) : 0,
  maxExamplesPerLabel: counts.length ? Math.max(...counts) : 0,
  classCounts,
  synthetic: true,
  productionUserData: false,
  teacherGeneratedExamplesIncluded: false,
}, null, 2)}\n`);
console.log(`[FastText] merged ${rows.length} examples across ${counts.length} labels (cap ${FASTTEXT_ROUTING_CONFIG.corpus.maxExamplesPerLabel}): ${output}`);
