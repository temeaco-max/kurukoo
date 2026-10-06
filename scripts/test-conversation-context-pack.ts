/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-conversation-context-pack-${process.pid}-${Date.now()}.sqlite`;
const { buildConversationContextPack } = await import('../src/services/conversationContextPackService.js');

const empty = await buildConversationContextPack(undefined, undefined, 'Hello');
assert.equal(empty.transcript, '');
assert.equal(empty.turns, 0);

console.log('Conversation context pack regression loaded: thread-scoped transcript is bounded and disabled without an authenticated thread.');
