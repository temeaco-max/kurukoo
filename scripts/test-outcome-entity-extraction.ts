import assert from 'node:assert/strict';
import { extractConversationalEntities, validateConversationalEntities } from '../src/services/conversationalExtraction.js';
import { detectUserOutcomeVerb, isDirectOutcomeRequest } from '../src/services/outcomeSupport.js';
import { routeIntent } from '../src/services/intentRouter.js';

const slowPhone = validateConversationalEntities(extractConversationalEntities('My iPhone 13 is running slowly. Can you check it?', 'device_support'), 'device_support');
assert.equal(slowPhone.outcomeVerb, 'check');
assert.equal(slowPhone.device, 'iPhone');
assert.equal(slowPhone.deviceModel, 'iPhone 13');
assert.match(String(slowPhone.issue), /slow/i);
assert.equal(slowPhone.subject, 'iPhone');

const wifi = validateConversationalEntities(extractConversationalEntities("Please diagnose why my Wi-Fi won't connect.", 'device_support'), 'device_support');
assert.equal(wifi.outcomeVerb, 'diagnose');
assert.equal(wifi.network?.toLowerCase(), 'wi-fi');
assert.match(String(wifi.issue), /connect/i);

const printer = validateConversationalEntities(extractConversationalEntities("My laptop won't connect to the printer. Help me fix it.", 'device_support'), 'device_support');
assert.equal(printer.outcomeVerb, 'help');
assert.equal(printer.device, 'laptop');
assert.match(String(printer.issue), /connect to the printer/i);

assert.equal(detectUserOutcomeVerb('Keep an eye on this and tell me if anything changes'), 'monitor');
assert.equal(isDirectOutcomeRequest('Something is wrong with my router'), true);
assert.equal(isDirectOutcomeRequest('What is the weather?'), false);

const routed = await routeIntent('My phone is running slowly. Can you check it?', `+234809${String(Date.now()).slice(-7)}`);
assert.equal(routed.skill, 'device_support');
assert.equal(routed.extractedEntities?.device, 'phone');
assert.match(String(routed.extractedEntities?.issue), /slowly|slow/i);

console.log('Outcome entity extraction contract passed: user intent, device/model, issue, network, and direct-outcome language are bounded and available to the canonical conversation path.');
