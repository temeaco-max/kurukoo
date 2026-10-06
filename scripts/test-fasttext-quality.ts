/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-fasttext-quality-${process.pid}-${Date.now()}.sqlite`;
const { classifyWithFastText, getFastTextRuntimeStatus } = await import('../src/services/fastTextService.js');

const cases = [
  ['hello', 'greeting'],
  ['thanks', 'thanks'],
  ['how do I unlink my phone?', 'how_to'],
  ['remind me when my bins go out', 'bin_day'],
  ['my macbook screen is damaged', 'laptop_repairer'],
  ['my ipad needs repair', 'tablet_repairer'],
  ['my PS5 needs repair', 'console_repairer'],
  ['my samsung television needs repair', 'tv_repairer'],
  ['repair my airpods', 'earbuds_repairer'],
  ['my washing machine is broken', 'appliance_repairer'],
  ['I need a taxi tomorrow morning', 'ride_request'],
  ['book my MOT', 'mot_booking'],
  ['I am locked out', 'locksmith'],
  ['find a POS agent', 'pos_agent'],
  ['help me pray', 'prayer'],
] as const;

for (const [text, expected] of cases) {
  const result = classifyWithFastText(text);
  assert.ok(result, `${text}: classifier returned no result`);
  assert.equal(result?.intent, expected, `${text}: expected ${expected}, received ${result?.intent}`);
  assert.ok((result?.confidence || 0) >= 0.55, `${text}: confidence unexpectedly low`);
}

const uncertain = classifyWithFastText('the purple moon is talking to me');
assert.ok(!uncertain || uncertain.confidence < 0.78, 'nonsense input should not produce an overconfident classification');

const status = getFastTextRuntimeStatus();
assert.ok(['real', 'missing', 'invalid'].includes(status.modelState), 'FastText runtime state must be explicit');
console.log(`FastText quality regression passed ${cases.length} deterministic/skill cases; modelState=${status.modelState}.`);
