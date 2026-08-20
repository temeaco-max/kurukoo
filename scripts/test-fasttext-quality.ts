import assert from 'node:assert/strict';
import { classifyWithFastText, getFastTextRoutingSignal, getFastTextRuntimeStatus } from '../src/services/fastTextService.js';

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

const greetingSignal = getFastTextRoutingSignal('hello');
assert.equal(greetingSignal.conversationAct, 'greeting', 'greeting must remain a deterministic conversation act');
assert.equal(greetingSignal.skills.length, 0, 'greeting must not create a skill candidate');
const confirmationSignal = getFastTextRoutingSignal('yes');
assert.equal(confirmationSignal.conversationAct, 'confirmation', 'confirmation must remain a deterministic conversation act');
assert.equal(confirmationSignal.skills.length, 0, 'confirmation must not create an economic request candidate');
const repairSignal = getFastTextRoutingSignal('my macbook screen is damaged');
assert.equal(repairSignal.selectedSkill, 'laptop_repairer', 'a strong device repair signal must choose the canonical skill only within its category');
assert.equal(repairSignal.categories[0]?.category, 'repairs-maintenance', 'device repair must receive a repairs category signal');
const multiGoalSignal = getFastTextRoutingSignal('I need a ride and food after that');
assert.ok(multiGoalSignal.requiresSemanticReasoning, 'multi-goal requests must escalate for semantic arbitration rather than force one skill');
const abstainedSignal = getFastTextRoutingSignal('the purple moon is talking to me');
assert.ok(abstainedSignal.abstained, 'unsafe-to-route nonsense must abstain rather than force an economic skill');

const status = getFastTextRuntimeStatus();
assert.ok(['real', 'missing', 'invalid'].includes(status.modelState), 'FastText runtime state must be explicit');
console.log(`FastText quality regression passed ${cases.length} deterministic/skill cases; modelState=${status.modelState}.`);
