import assert from 'node:assert/strict';
import { isPlausibleConversationalName } from '../src/services/conversationalAuthService.js';

const accepted = [
  'Tunde',
  'Tunde Charles',
  'My name is Tunde',
  "I'm Tunde",
  'Call me Tunde',
];

const rejected = [
  'rice and ikeja',
  'rice and yam delivered to me in ikeja',
  'i would like rice. the area is ikeja',
  'find me a plumber in Ikeja',
  'please get food for me',
];

for (const value of accepted) assert.equal(isPlausibleConversationalName(value), true, `Expected identity input to be accepted: ${value}`);
for (const value of rejected) assert.equal(isPlausibleConversationalName(value), false, `Expected task input to be rejected as identity: ${value}`);

console.log('Conversational auth name-boundary contract passed.');
