/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-memory-context-continuation-${process.pid}-${Date.now()}.sqlite`;
const { getDb, saveDb } = await import('../src/database.js');
const { getMemoryFacts } = await import('../src/services/memoryProfile.js');
const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { routeIntent } = await import('../src/services/legacyIntentRouter.js');

const owner = `memory-context-${crypto.randomUUID()}@example.test`;
const otherOwner = `memory-context-other-${crypto.randomUUID()}@example.test`;
const conversationId = `memory-conversation-${crypto.randomUUID()}`;
const db = await getDb();
db.run(`INSERT INTO chat_conversations (id, phone, title, channel) VALUES (?, ?, ?, ?)`, [conversationId, owner, 'Memory context proof', 'web']);
saveDb(true);

const recorded = await routeIntent('Remember that my usual area is Ikeja.', owner, undefined, undefined, conversationId);
assert.equal(recorded.canonicalAction, 'memory.record', 'The existing conversation router must record an explicit Memory preference.');
const fact = (await getMemoryFacts(owner)).find((item) => item.field === 'location' && item.value === 'ikeja');
assert.ok(fact, 'The owner must be able to read their recorded memory fact.');
assert.equal(fact.sourceConversationId, conversationId, 'A real source conversation owned by the fact owner must be projected for exact continuation.');

const review = await processCanonicalChatTurn({
  phone: owner,
  message: 'Open this saved detail.',
  channel: 'web',
  conversationId,
  contextAction: { type: 'resume_canonical_context', contextId: `memory_context:${fact.id}`, canonicalAction: 'memory.context.open', objectType: 'memory_context', objectId: String(fact.id) },
});
assert.equal(review.canonicalAction, 'memory.context.open', 'The canonical memory review action must be preserved.');
assert.equal(review.cardData?.type, 'memory', 'Memory continuation must return the established saved-context card type.');
assert.equal(review.cardData?.facts?.[0]?.title, 'Location', 'Memory continuation must return a user-facing fact title.');
assert.equal(review.cardData?.facts?.[0]?.description, 'ikeja', 'Memory continuation must return the exact owner-scoped fact value.');
assert.equal(review.cardData?.ownerScoped, true, 'Memory continuation must remain owner-scoped.');
assert.ok(!JSON.stringify(review.cardData).includes('sourceRef'), 'Memory review card must not expose the raw source reference.');

const foreignFacts = await getMemoryFacts(otherOwner);
assert.equal(foreignFacts.some((item) => item.id === fact.id), false, 'A different owner must not be able to read another user’s fact.');
const foreignReview = await processCanonicalChatTurn({
  phone: otherOwner,
  message: 'Open this saved detail.',
  channel: 'web',
  contextAction: { type: 'resume_canonical_context', contextId: `memory_context:${fact.id}`, canonicalAction: 'memory.context.open', objectType: 'memory_context', objectId: String(fact.id) },
});
assert.equal(foreignReview.canonicalAction, 'context.continuation.unavailable', 'A foreign memory fact continuation must fail closed.');

console.log('Memory context continuation regression passed: owner-scoped facts return exact user-facing review and foreign context fails closed.');
