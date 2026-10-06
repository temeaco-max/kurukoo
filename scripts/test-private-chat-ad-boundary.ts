/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-private-chat-ad-boundary-${process.pid}-${Date.now()}.sqlite`;
const { routeIntent } = await import('../src/services/intentRouter.js');

const result = await routeIntent('Tell me about rice offers and local food options', '+2348030000000');
assert.ok(result.skill, 'the canonical router should still classify and answer the conversation');
assert.ok(!result.cardData?.sponsored, 'private Chat must not receive a sponsored payload based on message keywords');
console.log('Private Chat advertising boundary passed: conversational text is not used for hidden ad targeting.');
