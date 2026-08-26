// Holds-out FastText evaluation framework.
// Evaluates the CURRENT production classifier (src/services/fastTextService.ts)
// against models/eval/intent_eval_heldout.v1.txt — NEVER used for training.
//
// Reports: P@1, P@3, R@3, confusion matrix, per-category accuracy,
// sparse-label accuracy (catalogue labels with <=2 training examples), and
// hard-negative accuracy (off_topic cases that should not be confidently mapped
// to a real skill).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyWithFastText } from '../src/services/fastTextService.js';
import { getEconomicCategory } from '../src/services/skillFlows.js';

const root = process.cwd();
const evalPath = path.join(root, 'models', 'eval', 'intent_eval_heldout.v1.txt');
assert.ok(fs.existsSync(evalPath), 'held-out eval corpus missing');

interface Case { text: string; label: string }
const legacyFixtureAliases: Record<string, string> = {
  off_topic: 'unknown',
  safety: 'emergency',
  school_run: 'school_run_uk',
};
const cases: Case[] = [];
for (const raw of fs.readFileSync(evalPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line.startsWith('__label__')) continue;
  const idx = line.indexOf(' ');
  if (idx === -1) continue;
  const fixtureLabel = line.slice(9, idx).trim();
  cases.push({ text: line.slice(idx + 1).trim(), label: legacyFixtureAliases[fixtureLabel] || fixtureLabel });
}

function predictTopK(query: string, k: number): { label: string; confidence: number }[] {
  const r = classifyWithFastText(query);
  const best = r ? [{ label: r.skill || r.intent, confidence: r.confidence }] : [];
  return [...best, ...(r?.alternateIntents || []).map((s, i) => ({ label: s, confidence: Math.max(0, r!.confidence - (i + 1) * 0.05) }))].slice(0, k);
}

let p1 = 0, p3 = 0, r3 = 0;
const confusion = new Map<string, Map<string, number>>();
const perCategory = new Map<string, { correct: number; total: number }>();
const sparseCounts: Record<string, number> = {};
for (const f of ['intent_training_data.txt', 'intent_training_behaviour_additions.txt', 'intent_training_skill_hints.txt']) {
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

const hardNegatives = cases.filter((c) => c.label === 'unknown');
let hardNegativeCorrect = 0;

function catOf(label: string): string { return getEconomicCategory(label) || `act_${label}`; }
function bump(confusion: Map<string, Map<string, number>>, a: string, b: string) {
  let row = confusion.get(a);
  if (!row) { row = new Map(); confusion.set(a, row); }
  row.set(b, (row.get(b) || 0) + 1);
}

for (const c of cases) {
  const preds = predictTopK(c.text, 3);
  const top1 = preds[0]?.label || 'unknown';
  const topLabels = new Set(preds.map((p) => p.label));
  if (top1 === c.label) p1 += 1;
  if (topLabels.has(c.label)) { p3 += 1; r3 += 1; }
  bump(confusion, c.label, top1);
  const cat = catOf(c.label);
  const pc = perCategory.get(cat) || { correct: 0, total: 0 };
  pc.total += 1;
  if (top1 === c.label) pc.correct += 1;
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
console.log(`[eval] P@1=${(p1 / cases.length * 100).toFixed(1)}%`);
console.log(`[eval] P@3=${(p3 / cases.length * 100).toFixed(1)}%`);
console.log(`[eval] R@3=${(r3 / cases.length * 100).toFixed(1)}%`);
console.log(`[eval] sparse-label accuracy (<=2 train ex): ${sparseTotal ? (sparseCorrect / sparseTotal * 100).toFixed(1) : 'n/a'}% (${sparseCorrect}/${sparseTotal})`);
console.log(`[eval] hard-negative accuracy: ${(hardNegativeCorrect / hardNegatives.length * 100).toFixed(1)}% (${hardNegativeCorrect}/${hardNegatives.length})`);

console.log('[eval] per-category accuracy:');
for (const [cat, v] of [...perCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${cat.padEnd(26)} ${(v.correct / v.total * 100).toFixed(1).padStart(5)}%  (${v.correct}/${v.total})`);
}

if (p1 / cases.length < 0.9) throw new Error(`Held-out P@1 is below the real-world acceptance floor: ${(p1 / cases.length * 100).toFixed(1)}% < 90.0%`);
if (hardNegatives.length && hardNegativeCorrect / hardNegatives.length < 1) throw new Error('Held-out off-topic cases must never be confidently routed to a real skill.');

console.log('[eval] confusion matrix (true -> predicted, counts):');
for (const [a, row] of [...confusion.entries()].sort()) {
  const items = [...row.entries()].filter(([, n]) => n > 0).map(([b, n]) => `${b}:${n}`).join('  ');
  console.log(`  ${a} -> ${items || '(none)'}`);
}
