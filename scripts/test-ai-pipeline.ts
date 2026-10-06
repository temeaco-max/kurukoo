/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-pipeline-${process.pid}-${Date.now()}.sqlite`;
const { classifyWithFastText } = await import('../src/services/fastTextService.js');
const { queryUnifiedAI } = await import('../src/services/unifiedAiEngine.js');

const cases = [
  ['Book an okada to Ikeja', 'okada_rider'],
  ['Order jollof rice near me', 'order_food'],
  ['Find an electrician', 'find_worker'],
  ['How many points do I have?', 'check_balance']
] as const;

let failed = 0;
for (const [input, expected] of cases) {
  const result = classifyWithFastText(input);
  if (!result || result.intent !== expected) {
    failed++;
    console.error(`[AI TEST] FAIL: ${input} -> ${result?.intent || 'unknown'} (expected ${expected})`);
  } else {
    console.log(`[AI TEST] PASS: ${input} -> ${result.intent} (${result.confidence.toFixed(2)})`);
  }
}

const generalQuestion = classifyWithFastText('What should I know before using Kurukoo?');
if (!generalQuestion || generalQuestion.intent !== 'general_question') {
  failed++;
  console.error(`[AI TEST] FAIL: general question routed to ${generalQuestion?.intent || 'unknown'}`);
} else {
  console.log(`[AI TEST] PASS: general question -> ${generalQuestion.intent} (${generalQuestion.confidence?.toFixed(2) || 'n/a'})`);
}

const response = await queryUnifiedAI('What should I know before using Kurukoo?', { provider: 'smollm2' });
if (!response.text) {
  failed++;
  console.error('[AI TEST] FAIL: SmolLM2 returned no text');
} else {
  console.log(`[AI TEST] PASS: SmolLM2 response via ${response.model}`);
}

if (failed) process.exit(1);
console.log('[AI TEST] All smoke tests passed.');
