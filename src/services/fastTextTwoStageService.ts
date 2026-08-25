// Two-stage FastText routing: coarse canonical-category model -> category-restricted
// skill candidates from the existing fine-grained intent model.
//
// FastText is NOT the final authority over consequential intent: weak confidence
// returns an ambiguous verdict with candidates so the existing AI routing/convergence
// layer (aiRoutingConvergence.ts) remains the authority.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { getEconomicCategory } from './skillFlows.js';

export type TwoStageVerdict = 'confident' | 'ambiguous' | 'unknown';

export interface TwoStageResult {
  verdict: TwoStageVerdict;
  category: string | null;
  categoryConfidence: number;
  skill: string | null;
  confidence: number;
  candidates: string[];
}

const CATEGORY_MODEL_PATH = path.join(process.cwd(), 'models', 'kurukoo_category.bin');
const INTENT_MODEL_PATH = path.join(process.cwd(), 'models', 'kurukoo_intent.bin');
// Mirrors fastTextService.normalize() so both stages see identical text.
function normalize(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface Prediction { label: string; confidence: number }

function runModel(modelPath: string, text: string, k: number): Prediction[] {
  const inputPath = path.join(os.tmpdir(), `kurukoo-twostage-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  try {
    fs.writeFileSync(inputPath, `${normalize(text)}\n`, { mode: 0o600 });
    const stdout = execFileSync('fasttext', ['predict-prob', modelPath, inputPath, String(k)], { encoding: 'utf8', timeout: 2500 }).trim();
    return stdout.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/__label__([^\s]+)\s+([0-9.]+)/);
      return match ? [{ label: match[1], confidence: Number(match[2]) }] : [];
    });
  } catch {
    return [];
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
  }
}

function labelToSkill(label: string): string {
  return label.replace(/^__label__/, '');
}

function skillMatchesCategory(skillLabel: string, category: string): boolean {
  if (category.startsWith('act_')) return skillLabel === category.slice(4);
  return getEconomicCategory(skillLabel) === category;
}

const CATEGORY_MIN_CONFIDENCE = 0.4;
const SKILL_MIN_CONFIDENCE = 0.35;

/**
 * Stage 1 picks a coarse canonical category. Stage 2 restricts the existing
 * intent-model candidates to that category and reports honest confidence.
 */
export function classifyTwoStage(query: string, topN = 3): TwoStageResult {
  if (!fs.existsSync(CATEGORY_MODEL_PATH) || !fs.existsSync(INTENT_MODEL_PATH)) {
    return { verdict: 'unknown', category: null, categoryConfidence: 0, skill: null, confidence: 0, candidates: [] };
  }
  const categoryPredictions = runModel(CATEGORY_MODEL_PATH, query, 3);
  const bestCategory = categoryPredictions[0];
  if (!bestCategory || bestCategory.confidence < CATEGORY_MIN_CONFIDENCE) {
    return { verdict: 'unknown', category: null, categoryConfidence: bestCategory?.confidence ?? 0, skill: null, confidence: 0, candidates: [] };
  }
  const category = bestCategory.label;

  const intentPredictions = runModel(INTENT_MODEL_PATH, query, 10);
  const inCategory = intentPredictions.filter((p) => skillMatchesCategory(labelToSkill(p.label), category));
  const best = inCategory[0];
  if (!best || best.confidence < SKILL_MIN_CONFIDENCE) {
    return {
      verdict: 'ambiguous',
      category,
      categoryConfidence: bestCategory.confidence,
      skill: null,
      confidence: best?.confidence ?? 0,
      candidates: inCategory.slice(0, topN).map((p) => labelToSkill(p.label)),
    };
  }
  const runnerUp = inCategory[1];
  const marginTooSmall = runnerUp !== undefined && best.confidence - runnerUp.confidence < 0.08;
  return {
    verdict: marginTooSmall ? 'ambiguous' : 'confident',
    category,
    categoryConfidence: bestCategory.confidence,
    skill: labelToSkill(best.label),
    confidence: best.confidence,
    candidates: inCategory.slice(0, topN).map((p) => labelToSkill(p.label)),
  };
}

export function getTwoStageRuntimeStatus(): { categoryModelPresent: boolean; intentModelPresent: boolean } {
  return { categoryModelPresent: fs.existsSync(CATEGORY_MODEL_PATH), intentModelPresent: fs.existsSync(INTENT_MODEL_PATH) };
}
