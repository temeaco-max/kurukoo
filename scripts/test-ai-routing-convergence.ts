/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import { classifyAiRoutingSignal, shouldEscalateToAi } from '../src/services/aiRoutingConvergence.js';

const cases: Array<{ text: string; act?: string; skill?: string; escalate?: boolean }> = [
  { text: 'hello', act: 'greeting', escalate: false },
  { text: 'thanks', act: 'thanks', escalate: false },
  { text: 'how do I unlink my phone?', act: 'how_to', escalate: true },
  { text: 'remind me about my bin day', skill: 'bin_day' },
  { text: 'I need my iPhone 13 screen repaired', skill: 'phone_repairer' },
  { text: 'I need my MacBook screen repaired', skill: 'laptop_repairer' },
  { text: 'find a dentist near me tomorrow', skill: 'dentist_appointment' },
  { text: 'clear my driveway after the snow', skill: 'snow_removal' },
  { text: 'get an okada from Ikeja to VI now', skill: 'okada_rider' },
  { text: 'book a hotel and airport transfer', skill: 'hotel_deals' },
  { text: 'what are my options for fixing this', escalate: true },
];

for (const item of cases) {
  const signal = classifyAiRoutingSignal(item.text);
  if (item.act) assert.equal(signal.conversationAct, item.act, `${item.text}: wrong conversation act`);
  if (item.skill) assert.equal(signal.skill, item.skill, `${item.text}: wrong skill`);
  if (item.escalate !== undefined) assert.equal(shouldEscalateToAi(signal, item.text), item.escalate, `${item.text}: wrong escalation decision`);
}

const unknown = classifyAiRoutingSignal('the purple moon is talking to me');
assert.ok(unknown.source === 'none' || unknown.confidence < 0.72, 'unexpectedly confident classification for nonsense input');

console.log(`AI routing convergence passed ${cases.length + 1} cases.`);

// FastText boundary regression guard (canonical decision — see aiRoutingConvergence.ts):
// 1. The canonical conversational path (rules + skill catalogue) must classify
//    catalogue-solvable requests WITHOUT consulting FastText first-line.
// 2. FastText may only appear as a downstream hint, never above the escalation threshold.
import { FASTTEXT_HINT_MAX_CONFIDENCE } from '../src/services/aiRoutingConvergence.js';
import { getFastTextRuntimeStatus } from '../src/services/fastTextService.js';

assert.ok(FASTTEXT_HINT_MAX_CONFIDENCE < 0.72, 'FastText hint confidence cap must stay below the escalation threshold');

for (const item of cases.filter(c => c.skill)) {
  const signal = classifyAiRoutingSignal(item.text);
  assert.notEqual(signal.source, 'fasttext', `${item.text}: FastText must not be the first-line classifier for a catalogue-solvable request`);
  if (signal.source === 'catalogue') assert.equal(signal.skill, item.skill);
}

// Even when FastText answers, its hint confidence can never satisfy the canonical path alone.
const fastStatus = getFastTextRuntimeStatus();
const hintProbe = classifyAiRoutingSignal('zzz unknown domain probe qqq');
if (hintProbe.source === 'fasttext') {
  assert.ok(hintProbe.confidence <= FASTTEXT_HINT_MAX_CONFIDENCE, 'FastText hint exceeded its confidence cap');
  assert.equal(shouldEscalateToAi(hintProbe, 'zzz unknown domain probe qqq'), true, 'FastText-only hint must escalate to the model path');
}
assert.ok(fastStatus.trainingExamples >= 0);

console.log(`FastText boundary guard passed (modelState=${fastStatus.modelState}, hintCap=${FASTTEXT_HINT_MAX_CONFIDENCE}).`);
