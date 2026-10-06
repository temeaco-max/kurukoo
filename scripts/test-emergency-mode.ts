/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-emergency-mode-${process.pid}-${Date.now()}.sqlite`;
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { getEmergencyDirectory } = await import('../src/services/emergencyService.js');
const { listUniversalCapabilities } = await import('../src/services/universalCapabilityProtocol.js');

const guest = `anon_emergency_${Date.now()}`;
const directory = getEmergencyDirectory();
assert.equal(directory.length, 3);
assert.ok(directory.every(record => record.emergencyNumber === '112'));
assert.ok(directory.every(record => record.sourceAuthority === 'Nigerian Communications Commission'));

for (const message of ['Help me, it\'s an emergency.', 'I need an ambulance.', 'Call the police.', 'My friend is unconscious.', 'There is a fire.', 'Someone is attacking me.', "I don't know exactly where I am."]) {
  const result = await processCanonicalChatTurn({ phone: guest, channel: 'web', message });
  assert.equal(result.progressStage, 'safety', message);
  assert.equal(result.cardData?.type, 'emergency', message);
  assert.notEqual(result.cardData?.type, 'auth_conversation', message);
  assert.doesNotMatch(result.reply, /tell me your name|phone number|OTP|sign in/i, message);
  assert.match(result.reply, /112|emergency/i, message);
}

const police = await processCanonicalChatTurn({ phone: guest, channel: 'web', message: 'call the police' });
assert.equal(police.canonicalAction, 'emergency.dial');
assert.equal(police.cardData?.service?.emergencyNumber, '112');
assert.equal(police.cardData?.session?.dialState, 'dial_requested');
assert.match(String(police.cardData?.actions?.[0]?.href), /^tel:112$/);
assert.doesNotMatch(police.reply, /\b(?:successfully\s+connected|connected\s+to\s+emergency|responders\s+are\s+coming|dispatch(?:ed)?\s+has\s+occurred)\b/i);

const ended = await processCanonicalChatTurn({ phone: guest, channel: 'web', message: 'Actually this is not an emergency anymore.' });
assert.equal(ended.canonicalAction, 'emergency.end');
assert.equal(ended.cardData?.status, 'ended');

const ordinaryGuest = `anon_ordinary_${Date.now()}`;
const ordinary = await processCanonicalChatTurn({ phone: ordinaryGuest, channel: 'web', message: 'I need someone to clean my flat.' });
assert.equal(ordinary.cardData?.type, 'auth_conversation');
assert.match(ordinary.reply, /name|sign in|save|continue/i);

const capabilities = await listUniversalCapabilities();
const emergency = capabilities.find(capability => capability.capability === 'emergency');
assert.ok(emergency);
assert.deepEqual(emergency?.actions, ['assess', 'location', 'dial', 'connect', 'end', 'followup']);
assert.ok(emergency?.permissions.includes('guest_initial_help'));

console.log('Emergency mode regression passed: interruptive guest safety, canonical 112 directory, police/ambulance/fire routing, location uncertainty, truthful dial state, cancellation, capability registration, and ordinary-auth preservation.');
