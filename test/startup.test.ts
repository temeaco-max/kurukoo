/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-startup-${process.pid}-${Date.now()}.sqlite`;

test('persistenceReadiness module exports required functions', async () => {
  const { assertProductionPersistenceSafe } = await import('../src/services/persistenceReadiness.js');
  assert.equal(typeof assertProductionPersistenceSafe, 'function');
});

test('featureFlags module exports required functions', async () => {
  const mod = await import('../src/services/featureFlags.js');
  assert.equal(typeof mod.isFeatureEnabled, 'function');
  assert.equal(typeof mod.getFeatureFlag, 'function');
  assert.equal(typeof mod.getFeatureFlagStatus, 'function');
  assert.ok(mod.FEATURE_REGISTRY, 'FEATURE_REGISTRY must be exported');
});

test('intentRouter module exports routeIntent', async () => {
  const mod = await import('../src/services/intentRouter.js');
  assert.equal(typeof mod.routeIntent, 'function');
});

test('complianceFilter module exports checkCompliance', async () => {
  const mod = await import('../src/services/complianceFilter.js');
  assert.equal(typeof mod.checkCompliance, 'function');
});

test('orphanWireBackRoutes module exports router', async () => {
  const mod = await import('../src/routes/orphanWireBackRoutes.js');
  assert.ok(mod.default, 'orphanWireBackRoutes must export a default router');
});

test('quickRepliesRoutes module exports router', async () => {
  const mod = await import('../src/routes/quickRepliesRoutes.js');
  assert.ok(mod.default, 'quickRepliesRoutes must export a default router');
});
