import assert from 'node:assert/strict';
import { routeIntent } from '../src/services/intentRouter.js';

const exploratory = [
  'Where can I get good suya around here?',
  'Is there a cleaner in Ibadan this weekend?',
  'Who sells rice near me?',
];
for (const prompt of exploratory) {
  const result = await routeIntent(prompt);
  assert.equal(result.cardData, undefined, `Exploratory question must not create a consequential card: ${prompt}`);
  assert.notEqual(result.canonicalAction, 'start_storefront', `Exploratory question must not start a storefront: ${prompt}`);
  assert.notEqual(result.canonicalAction, 'create_economic_request', `Exploratory question must not create an Economic Request: ${prompt}`);
}

const explicitActions = [
  'Find me a cleaner in Ibadan this weekend.',
  'Order food for me in Ikeja.',
];
for (const prompt of explicitActions) {
  const result = await routeIntent(prompt);
  assert.ok(result.cardData, `Explicit action should retain a canonical preview/card boundary: ${prompt}`);
}

const deviceSupportRequests = [
  'My iPhone is running slowly. Check it.',
  'My MacBook is slow.',
  'Check my Wi-Fi.',
  "My TV won't connect to Wi-Fi.",
  'Check whether my camera is online.',
];
for (const prompt of deviceSupportRequests) {
  const result = await routeIntent(prompt, '+2348030000099');
  const card = result.cardData as { type?: string; stage?: string; status?: string; requestId?: string; message?: string } | undefined;
  assert.equal(result.skill, 'device_support', `Device troubleshooting must use the canonical device-support skill: ${prompt}`);
  assert.equal(card?.type, 'device_support', `Device troubleshooting must use the canonical device-support card: ${prompt}`);
  assert.ok(['needs_user', 'completed'].includes(String(card?.status)), `Device troubleshooting must remain information-first until evidence exists: ${prompt}`);
  assert.equal(card?.requestId, undefined, `Device troubleshooting must not create an Economic Request before physical work is established: ${prompt}`);
  assert.doesNotMatch(String(card?.message || ''), /I found .*provider|choose .*provider|provider options|quote|payment|booking/i, `Device troubleshooting must not prematurely claim or solicit provider work: ${prompt}`);
}

console.log(`Conversational route discrimination regression passed: ${exploratory.length} exploratory, ${explicitActions.length} explicit action, and ${deviceSupportRequests.length} information-first device-support cases.`);
