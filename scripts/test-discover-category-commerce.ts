/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-discover-category-commerce-${process.pid}-${Date.now()}.sqlite`;
const { getDiscoverCategoryInventory } = await import('../src/services/discoverCommercialComposition.js');

const items = await getDiscoverCategoryInventory('okada', undefined, 5);
assert.ok(Array.isArray(items), 'category inventory must return an array');
for (const item of items) {
  assert.equal(typeof item.sponsored, 'boolean', 'sponsored state must be explicit');
  assert.ok(Array.isArray(item.actions), 'category Discover items need actions');
  assert.ok(item.chatAction, 'category Discover items need a Chat handoff');
}
console.log(JSON.stringify({ passed: true, category: 'okada', count: items.length }, null, 2));
