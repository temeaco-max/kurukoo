import assert from 'node:assert/strict';

const { prayerLiveSystemInstruction } = await import('../src/services/prayerAgentService.js');
const instruction = prayerLiveSystemInstruction('christian');
assert.match(instruction, /live prayer conversation/i);
assert.match(instruction, /interrupt/i);
assert.match(instruction, /guaranteed/i);
assert.match(instruction, /christian/i);
assert.match(instruction, /Never impersonate a real religious leader/i);
console.log(JSON.stringify({ test: 'prayer-live-contract', passed: true }));
