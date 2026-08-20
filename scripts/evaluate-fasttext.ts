import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getFastTextRuntimeStatus, getFastTextRoutingSignal } from '../src/services/fastTextService.js';
import { FASTTEXT_ROUTING_CONFIG } from '../src/services/fastTextRoutingConfig.js';
import { getSkillCategoryConverged } from '../src/services/skillCatalogueConvergence.js';

interface EvaluationRow { label: string; text: string; }
interface Prediction { labels: string[]; }
const root = process.cwd();
const models = path.join(root, 'models');
const manifestPath = path.join(root, 'data', 'audits', 'fasttext-evaluation-manifest.json');
const splitPaths = {
  train: path.join(models, '.intent_training_data.train.txt'),
  validation: path.join(models, '.intent_training_data.validation.txt'),
  test: path.join(models, '.intent_training_data.test.txt'),
};
function readRows(filePath: string): EvaluationRow[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^(__label__[^\s]+)\s+(.+)$/);
    return match ? [{ label: match[1].slice('__label__'.length), text: match[2] }] : [];
  });
}
function categoryFor(label: string): string {
  const skill = label.startsWith('skill_route_') ? label.slice('skill_route_'.length) : label;
  return getSkillCategoryConverged(skill) || (['greeting', 'thanks', 'farewell', 'confirmation', 'rejection', 'correction', 'clarification', 'how_to', 'status', 'cancel'].includes(label) ? 'conversation_act' : label);
}
function predict(text: string): Prediction {
  const input = path.join(os.tmpdir(), `kurukoo-fasttext-eval-${process.pid}-${crypto.randomUUID()}.txt`);
  try {
    fs.writeFileSync(input, `${text}\n`, { mode: 0o600 });
    const output = execFileSync('fasttext', ['predict-prob', path.join(models, 'kurukoo_intent.bin'), input, '3'], { encoding: 'utf8', timeout: 2500 });
    return { labels: output.split(/\r?\n/).flatMap(line => line.match(/__label__([^\s]+)/)?.[1] ? [line.match(/__label__([^\s]+)/)![1]] : []) };
  } finally { try { fs.unlinkSync(input); } catch {} }
}
function metrics(rows: EvaluationRow[]) {
  let skillTop1 = 0; let skillTop3 = 0; let categoryTop1 = 0; let categoryTop3 = 0; let conversationTop1 = 0; let conversationTotal = 0; let falsePositiveRoutes = 0; let abstained = 0;
  const confusion: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const labels = predict(row.text).labels;
    const expected = row.label;
    const expectedCategory = categoryFor(expected);
    const predicted = labels[0] || 'abstained';
    const predictedCategories = labels.map(categoryFor);
    if (!labels.length) abstained += 1;
    if (predicted === expected) skillTop1 += 1;
    if (labels.includes(expected)) skillTop3 += 1;
    if (predictedCategories[0] === expectedCategory) categoryTop1 += 1;
    if (predictedCategories.includes(expectedCategory)) categoryTop3 += 1;
    if (expectedCategory === 'conversation_act') {
      conversationTotal += 1;
      if (predicted === expected) conversationTop1 += 1;
      if (predicted.startsWith('skill_route_')) falsePositiveRoutes += 1;
    }
    confusion[expected] ||= {};
    confusion[expected][predicted] = (confusion[expected][predicted] || 0) + 1;
  }
  const total = rows.length || 1;
  return {
    examples: rows.length,
    conversationActTop1: conversationTotal ? conversationTop1 / conversationTotal : null,
    categoryTop1: categoryTop1 / total,
    categoryTop3: categoryTop3 / total,
    skillTop1: skillTop1 / total,
    skillTop3: skillTop3 / total,
    precision: skillTop1 / total,
    recall: skillTop1 / total,
    abstentionRate: abstained / total,
    falsePositiveRoutingRate: conversationTotal ? falsePositiveRoutes / conversationTotal : 0,
    confusionMatrix: confusion,
  };
}
const boundaryCases = [
  { text: 'hello', expectedConversationAct: 'greeting', expectAbstain: false },
  { text: 'thanks', expectedConversationAct: 'thanks', expectAbstain: false },
  { text: 'yes', expectedConversationAct: 'confirmation', expectAbstain: false },
  { text: 'no', expectedConversationAct: 'rejection', expectAbstain: false },
  { text: 'the purple moon is talking to me', expectedConversationAct: undefined, expectAbstain: true },
  { text: 'I need a ride and food after that', expectedConversationAct: undefined, expectAbstain: true },
].map(test => {
  const signal = getFastTextRoutingSignal(test.text);
  return { ...test, actualConversationAct: signal.conversationAct || null, actualAbstain: signal.abstained, passed: test.expectedConversationAct ? signal.conversationAct === test.expectedConversationAct : signal.abstained === test.expectAbstain };
});
const status = getFastTextRuntimeStatus();
const gitSha = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'unavailable'; } })();
const splitRows = Object.fromEntries(Object.entries(splitPaths).map(([split, filePath]) => [split, readRows(filePath)])) as Record<keyof typeof splitPaths, EvaluationRow[]>;
const disjoint = new Set(splitRows.train.map(row => `${row.label}\u0000${row.text}`));
for (const split of ['validation', 'test'] as const) for (const row of splitRows[split]) if (disjoint.has(`${row.label}\u0000${row.text}`)) throw new Error(`Training leakage: ${split} contains a training example.`);
const executableMetrics = status.ready ? { validation: metrics(splitRows.validation), test: metrics(splitRows.test) } : null;
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  gitSha,
  model: { path: status.modelPath, modelState: status.modelState, executableAvailable: status.executableAvailable, evaluated: status.ready },
  thresholds: FASTTEXT_ROUTING_CONFIG,
  splitCounts: Object.fromEntries(Object.entries(splitRows).map(([split, rows]) => [split, rows.length])),
  evaluationStatus: status.ready ? 'measured_on_held_out_test' : 'model_unavailable_no_accuracy_claim',
  metrics: executableMetrics,
  boundaryCases,
  boundaryPassed: boundaryCases.every(test => test.passed),
  productionAccuracyClaimed: false,
  trainingUsesRawUserTraffic: false,
  provenance: { synthetic: true, teacherGenerated: false, candidateRequiresReview: true, productionUserData: false },
};
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (!manifest.boundaryPassed) throw new Error('FastText routing boundary checks failed.');
console.log(JSON.stringify({ manifestPath, evaluationStatus: manifest.evaluationStatus, splitCounts: manifest.splitCounts, boundaryPassed: manifest.boundaryPassed }, null, 2));
