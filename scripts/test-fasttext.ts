import assert from 'node:assert/strict';
import { classifyWithFastText, getFastTextRuntimeStatus } from '../src/services/fastTextService.js';

const runtime = getFastTextRuntimeStatus();
assert.equal(runtime.modelState, 'real', `expected a real FastText binary, got ${runtime.modelState}`);
assert.equal(runtime.realModelPresent, true, 'realModelPresent must be true when the binary is valid');
assert.ok(runtime.trainingExamples > 500, `expected merged training corpus coverage, received ${runtime.trainingExamples} examples`);
console.log(`FastText executable availability: ${runtime.executableAvailable ? 'available' : 'not configured in this host; deterministic routing rules remain active'}`);

const cases: Array<[string, string]> = [
  ['hello', 'greeting'],
  ['how far my guy', 'greeting'],
  ['Thanks', 'thanks'],
  ['yes', 'confirmation'],
  ['I need a taxi to Ikeja', 'ride_request'],
  ['Find me someone to repair my fridge', 'find_worker'],
  ['My iPhone 13 screen is broken', 'phone_repairer'],
  ['Order suya and bread near me', 'order_food'],
  ['I need emergency help after an accident', 'emergency'],
  ['Help me find a football match this weekend', 'sports_matchmaking'],
  ['Help me pray', 'prayer'],
  ['How do I fix a leaking tap?', 'how_to'],
  ['How do I unlink my phone?', 'how_to'],
  ['How do I top up my wallet?', 'how_to'],
  ['What are Kurukoo fees for?', 'general_question'],
  ['I need an MOT appointment next week', 'mot_booking'],
  ['Can you solve a made up space maths puzzle?', 'unknown'],
];

let failures = 0;
let fastTextSourceCount = 0;
for (const [query, expected] of cases) {
  const result = classifyWithFastText(query);
  const ok = result?.intent === expected;
  if (result?.source === 'fasttext') fastTextSourceCount += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(query)} -> ${result?.intent || 'unknown'} (${result?.source || 'none'}, ${result?.confidence?.toFixed(2) || 'n/a'})`);
  if (!ok) failures += 1;
}

if (failures) throw new Error(`FastText intent verification failed for ${failures} sample(s)`);
if (runtime.executableAvailable) {
  // Curated blueprint rules intentionally take precedence for known intents, so the
  // original cases resolve via `rules`. With a working executable, prove the real
  // binary-model path end-to-end using queries the rules deliberately do not cover.
  const modelPathCases: Array<[string, string]> = [
    ['my fridge stopped cooling', 'find_worker'],
    ['need a dj for a party', 'find_worker'],
    ['abeg i dey look for a cleaner around my area', 'find_worker'],
  ];
  let modelSourceCount = 0;
  for (const [query, expected] of modelPathCases) {
    const result = classifyWithFastText(query);
    const ok = result?.intent === expected && result?.source === 'fasttext';
    console.log(`${ok ? 'PASS' : 'FAIL'} [model-path] ${JSON.stringify(query)} -> ${result?.intent || 'unknown'} (${result?.source || 'none'}, ${result?.confidence?.toFixed(2) || 'n/a'})`);
    if (ok) modelSourceCount += 1;
  }
  assert.ok(modelSourceCount >= 1, `expected the real FastText binary to classify at least one rule-uncovered query, got ${modelSourceCount}`);
} else {
  assert.equal(fastTextSourceCount, 0, 'FastText source attribution must remain honest when the executable is unavailable');
}
console.log(`FastText intent verification passed: ${cases.length - failures}/${cases.length} cases; ${fastTextSourceCount} used the real model.`);
