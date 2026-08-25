// Reproducible comparison: (A) existing flat FastText classifier vs
// (B) two-stage category->skill classifier on the SAME held-out corpus split.
//
// Split is deterministic (hash of normalized text) so runs are comparable.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { classifyWithFastText } from '../src/services/fastTextService.js';
import { classifyTwoStage } from '../src/services/fastTextTwoStageService.js';
import { getEconomicCategory } from '../src/services/skillFlows.js';

const root = process.cwd();
const modelsDir = path.join(root, 'models');
const corpusFiles = [
  path.join(modelsDir, 'intent_training_data.txt'),
  path.join(modelsDir, 'intent_training_behaviour_additions.txt'),
].filter((p) => fs.existsSync(p));

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

interface Case { text: string; label: string }
const all: Case[] = [];
for (const file of corpusFiles) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('__label__')) continue;
    const idx = line.indexOf(' ');
    if (idx === -1) continue;
    const label = line.slice(9, idx).trim();
    const text = line.slice(idx + 1).trim();
    if (text) all.push({ text, label });
  }
}
// Held-out = 20% via stable hash; guarantees identical split across both arms.
const heldOut = all.filter((c) => hash(c.text.toLowerCase()) % 5 === 0);
console.log(`[eval] corpus=${all.length} heldOut=${heldOut.length}`);

function flatPredict(text: string): string | null {
  return classifyWithFastText(text)?.intent ?? null;
}

function twoStagePredict(text: string): string | null {
  const r = classifyTwoStage(text);
  if (r.verdict === 'confident' && r.skill) return r.skill;
  return null; // ambiguous/unknown count as misses unless the flat arm also abstains
}

function predictWithCli(modelPath: string, text: string): string | null {
  const tmp = path.join(os.tmpdir(), `kurukoo-eval-${process.pid}.txt`);
  fs.writeFileSync(tmp, `${text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()}\n`);
  try {
    const out = execFileSync('fasttext', ['predict', modelPath, tmp], { encoding: 'utf8', timeout: 2500 }).trim();
    const m = out.match(/__label__([^\s]+)/);
    return m ? m[1] : null;
  } catch { return null; } finally { try { fs.unlinkSync(tmp); } catch {} }
}

interface ArmStats { top1: number; top3: number; attempts: number; latencyMs: number[] }
function newArm(): ArmStats { return { top1: 0, top3: 0, attempts: 0, latencyMs: [] }; }

const flatRaw = newArm();
const twoStage = newArm();

for (const c of heldOut) {
  // Flat arm: existing service first, raw CLI model as fallback so the model itself is judged.
  let t0 = Date.now();
  let pred = flatPredict(c.text) ?? predictWithCli(path.join(modelsDir, 'kurukoo_intent.bin'), c.text);
  flatRaw.latencyMs.push(Date.now() - t0);
  if (pred) {
    flatRaw.attempts += 1;
    if (pred === c.label) flatRaw.top1 += 1;
  }

  t0 = Date.now();
  pred = twoStagePredict(c.text);
  twoStage.latencyMs.push(Date.now() - t0);
  if (pred) {
    twoStage.attempts += 1;
    if (pred === c.label) twoStage.top1 += 1;
  }
}

function median(values: number[]): number { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; }

function report(name: string, arm: ArmStats): void {
  const n = heldOut.length;
  console.log(`[eval] ${name}: P@1=${(arm.top1 / n * 100).toFixed(1)}% answered=${arm.attempts}/${n} medianLatency=${median(arm.latencyMs)}ms`);
}

report('flat   ', flatRaw);
report('twoStg ', twoStage);

// Stage-1 category accuracy (category of the true skill label vs predicted category).
let catHit = 0;
let catTotal = 0;
for (const c of heldOut) {
  const truthCat = getEconomicCategory(c.label) || `act_${c.label}`;
  const t0 = Date.now();
  const r = classifyTwoStage(c.text);
  twoStage.latencyMs.push(Date.now() - t0);
  if (!truthCat.startsWith('act_')) continue; // conversational acts have no economic category
  catTotal += 1;
  if (r.category === truthCat) catHit += 1;
}
console.log(`[eval] stage1 category accuracy=${catTotal ? (catHit / catTotal * 100).toFixed(1) : 'n/a'}% (${catHit}/${catTotal})`);

// Hard-negative check: nonsense input must not produce confident verdicts.
const hardNegatives = ['the purple moon is talking to me', 'xyzzy plugh frobnicate'];
let hnOk = 0;
for (const hn of hardNegatives) {
  const r = classifyTwoStage(hn);
  if (r.verdict !== 'confident') hnOk += 1;
}
console.log(`[eval] hard-negative abstentions=${hnOk}/${hardNegatives.length}`);
