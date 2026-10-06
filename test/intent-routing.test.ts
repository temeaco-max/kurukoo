/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-intent-routing-${process.pid}-${Date.now()}.sqlite`;

test('intentRouter exports routeIntent function', async () => {
  const { routeIntent } = await import('../src/services/intentRouter.js');
  assert.equal(typeof routeIntent, 'function', 'routeIntent must be a function');
});

test('intentRouter accepts string query and phone', async () => {
  const { routeIntent } = await import('../src/services/intentRouter.js');
  // Should not throw when called with valid params
  const result = await routeIntent('How many points do I have?', '+2347012345678');
  assert.ok(result !== undefined, 'routeIntent must return a result');
});

test('legacyIntentRouter exports routeIntent function', async () => {
  const { routeIntent } = await import('../src/services/legacyIntentRouter.js');
  assert.equal(typeof routeIntent, 'function', 'routeIntent must be a function');
});