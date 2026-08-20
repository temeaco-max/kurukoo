import assert from 'node:assert/strict';
import { classifyWithFastText, getFastTextRuntimeStatus } from '../src/services/fastTextService.js';

const runtime = getFastTextRuntimeStatus();
assert.equal(runtime.modelState, 'real', `expected a real FastText binary, got ${runtime.modelState}`);
assert.equal(runtime.realModelPresent, true, 'realModelPresent must be true when the binary is valid');
console.log(`FastText executable availability: ${runtime.executableAvailable ? 'available' : 'not configured in this host; deterministic routing rules remain active'}`);

const cases: Array<[string, string]> = [
  ['hello', 'greeting'],
  ['Thanks', 'thanks'],
  ['yes', 'confirmation'],
  ['I need a taxi to Ikeja', 'ride_request'],
  ['Find me someone to repair my fridge', 'find_worker'],
  ['Order suya and bread near me', 'order_food'],
  ['I need emergency help after an accident', 'emergency'],
  ['Help me find a football match this weekend', 'sports_matchmaking'],
  ['How do I fix a leaking tap?', 'how_to'],
  ['How do I unlink my phone?', 'how_to'],
  ['How do I top up my wallet?', 'how_to'],
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
if (runtime.executableAvailable) assert.ok(fastTextSourceCount >= 4, `expected at least four representative non-conversational routes to use fasttext, got ${fastTextSourceCount}`);
else assert.equal(fastTextSourceCount, 0, 'FastText source attribution must remain honest when the executable is unavailable');
console.log(`FastText intent verification passed: ${cases.length - failures}/${cases.length} cases; ${fastTextSourceCount} used the real model.`);
