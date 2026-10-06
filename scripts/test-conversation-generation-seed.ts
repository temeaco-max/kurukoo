/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-conversation-generation-seed-${process.pid}-${Date.now()}.sqlite`;
const { generateConversationalResponse } = await import('../src/services/conversationalGenerationService.js');

const seeded = await generateConversationalResponse({
  prompt: 'My phone has been acting weird since yesterday.',
  seedResponse: {
    provider: 'Kurukoo Router',
    model: 'router-response',
    text: 'That sounds frustrating. What is the phone doing differently?',
    latencyMs: 0,
    cost: 'already-generated',
  },
});

assert.equal(seeded.text, 'That sounds frustrating. What is the phone doing differently?');
assert.equal(seeded.attemptCount, 1);
assert.equal(seeded.escalated, false);
assert.equal(seeded.contract.mode, 'conversation');
assert.ok(!seeded.quality.issues.includes('premature_action'));

const unsafeSeed = await generateConversationalResponse({
  prompt: "I'm thinking about getting a cleaner this weekend.",
  seedResponse: {
    provider: 'Kurukoo Router',
    model: 'router-response',
    text: 'Please confirm the booking and payment.',
    latencyMs: 0,
    cost: 'already-generated',
  },
});

assert.equal(unsafeSeed.contract.mode, 'exploration');
assert.ok(unsafeSeed.quality.issues.includes('premature_action'));
assert.notEqual(unsafeSeed.text, 'Please confirm the booking and payment.');

console.log('Seeded conversational generation regression passed.');
