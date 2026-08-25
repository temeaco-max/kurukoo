// Holds-out FastText evaluation framework.
// Evaluates the CURRENT production classifier (src/services/fastTextService.ts)
// against models/eval/intent_eval_heldout.v1.txt — NEVER used for training.
//
// Reports: Top-1 accuracy, Top-3 hit rate, confusion matrix, per-category
// accuracy, sparse-label accuracy (catalogue labels with <=2 training examples),
// and hard-negative accuracy (off_topic cases that should not be confidently
// mapped to a real skill).
//
// Metric note (single-label, each case has exactly one true label):
// - Top-1 accuracy   = fraction of cases whose TRUE label is the #1 prediction.
// - Top-3 hit rate   = fraction of cases whose TRUE label appears anywhere in
//                      the top-3 predictions. For single-label ranking this
//                      equals Recall@3; it is NOT precision@3 (precision@3 would
//                      require multiple independent predictions per case).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyWithFastText } from '../src/services/fastTextService.js';
import { getEconomicCategory } from '../src/services/skillFlows.js';

const root = process.cwd();
const evalPath = path.join(root, 'models', 'eval', 'intent_eval_heldout.v1.txt');
assert.ok(fs.existsSync(evalPath), 'held-out eval corpus missing');

interface Case { text: string; label: string }
const cases: Case[] = [];
for (const raw of fs.readFileSync(evalPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line.startsWith('__label__')) continue;
  const idx = line.indexOf(' ');
  if (idx === -1) continue;
  cases.push({ text: line.slice(idx + 1).trim(), label: line.slice(9, idx).trim() });
}

function predictTopK(query: string, k: number): { label: string; confidence: number }[] {
  const r = classifyWithFastText(query);
  const best = r ? [{ label: r.skill || r.intent, confidence: r.confidence }] : [];
  return [...best, ...(r?.alternateIntents || []).map((s, i) => ({ label: s, confidence: Math.max(0, r!.confidence - (i + 1) * 0.05) }))].slice(0, k);
}

let top1 = 0, top3 = 0;
const confusion = new Map<string, Map<string, number>>();
const perCategory = new Map<string, { correct: number; total: number }>();
// Guard: the held-out corpus must NEVER appear in, or be appended to, any
// training input consumed by the FastText build (see scripts/build-fasttext.mjs).
// Fail fast if it has been accidentally included. We compare the *content* of the
// corpus against each training file (the corpus text is the contamination marker,
// not its filename or a substring of its lines).
const trainingFiles = [
  'intent_training_data.txt',
  'intent_training_behaviour_additions.txt',
  'intent_training_skill_hits.txt',
  'intent_training_skill_hints.txt',
];
const heldoutText = fs.readFileSync(evalPath, 'utf8');
for (const f of trainingFiles) {
  const tp = path.join(root, 'models', f);
  if (!fs.existsSync(tp)) continue;
  const content = fs.readFileSync(tp, 'utf8');
  assert.ok(!content.includes(heldoutText),
    `held-out eval content found verbatim in training file ${f} — train/test contamination`);
  assert.ok(!content.includes('intent_eval_heldout'),
    `training file ${f} references the held-out corpus path — train/test contamination`);
}

const sparseCounts: Record<string, number> = {};
for (const f of trainingFiles) {
  const p = path.join(root, 'models', f);
  if (!fs.existsSync(p)) continue;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('__label__')) continue;
    const idx = line.indexOf(' ');
    if (idx === -1) continue;
    const label = line.slice(9, idx).trim();
    sparseCounts[label] = (sparseCounts[label] || 0) + 1;
  }
}
const sparseSet = new Set(Object.keys(sparseCounts).filter((l) => sparseCounts[l] <= 2));

const hardNegatives = cases.filter((c) => c.label === 'off_topic');
let hardNegativeCorrect = 0;

function catOf(label: string): string { return getEconomicCategory(label) || `act_${label}`; }
function bump(confusion: Map<string, Map<string, number>>, a: string, b: string) {
  let row = confusion.get(a);
  if (!row) { row = new Map(); confusion.set(a, row); }
  row.set(b, (row.get(b) || 0) + 1);
}

for (const c of cases) {
  const preds = predictTopK(c.text, 3);
  const predicted1 = preds[0]?.label || 'unknown';
  const topLabels = new Set(preds.map((p) => p.label));
  if (predicted1 === c.label) top1 += 1;
  if (topLabels.has(c.label)) { top3 += 1; }
  bump(confusion, c.label, predicted1);
  const cat = catOf(c.label);
  const pc = perCategory.get(cat) || { correct: 0, total: 0 };
          pc.total += 1;
  if (predicted1 === c.label) pc.correct += 1;
  perCategory.set(cat, pc);
}

let sparseCorrect = 0, sparseTotal = 0;
for (const c of cases) {
  if (!sparseSet.has(c.label)) continue;
  sparseTotal += 1;
  if (predictTopK(c.text, 1)[0]?.label === c.label) sparseCorrect += 1;
}
for (const c of hardNegatives) {
  const r = classifyWithFastText(c.text);
  // "correct" = the classifier does NOT confidently assign a real catalogue skill
  const real = r && r.skill && r.skill !== 'off_topic' && r.confidence >= 0.78;
  if (!real) hardNegativeCorrect += 1;
}

console.log(`[eval] cases=${cases.length}`);
console.log(`[eval] Top-1 accuracy=${(top1 / cases.length * 100).toFixed(1)}%`);
console.log(`[eval] Top-3 hit rate=${(top3 / cases.length * 100).toFixed(1)}%`);
console.log(`[eval] (Top-3 hit rate == Recall@3 for single-label ranking; NOT precision@3)`);
console.log(`[eval] sparse-label accuracy (<=2 train ex): ${sparseTotal ? (sparseCorrect / sparseTotal * 100).toFixed(1) : 'n/a'}% (${sparseCorrect}/${sparseTotal})`);
console.log(`[eval] hard-negative accuracy: ${(hardNegativeCorrect / hardNegatives.length * 100).toFixed(1)}% (${hardNegativeCorrect}/${hardNegatives.length})`);

console.log('[eval] per-category accuracy:');
for (const [cat, v] of [...perCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${cat.padEnd(26)} ${(v.correct / v.total * 100).toFixed(1).padStart(5)}%  (${v.correct}/${v.total})`);
}

console.log('[eval] confusion matrix (true -> predicted, counts):');
for (const [a, row] of [...confusion.entries()].sort()) {
  const items = [...row.entries()].filter(([, n]) => n > 0).map(([b, n]) => `${b}:${n}`).join('  ');
  console.log(`  ${a} -> ${items || '(none)'}`);
}
