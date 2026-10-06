/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-capability-composability-${process.pid}-${Date.now()}.sqlite`;
const { listUniversalCapabilities } = await import('../src/services/universalCapabilityProtocol.js');
const { ensureCapabilityFoundation } = await import('../src/services/capabilityFoundation.js');
const { resolveSkillCapabilityPlan } = await import('../src/services/capabilityFoundationIntegration.js');

ensureCapabilityFoundation();
const catalog = await listUniversalCapabilities();
assert.ok(catalog.length >= 205, 'canonical catalog must retain all known skills');
assert.ok(catalog.some(item => item.capability === 'atomic.discovery'), 'atomic discovery capability must exist');
assert.ok(catalog.some(item => item.capability === 'atomic.execute'), 'atomic execute capability must exist');

const workerPlan = resolveSkillCapabilityPlan('find_worker');
assert.ok(workerPlan && workerPlan.length > 0, 'find_worker must resolve to reusable capabilities');
assert.ok(workerPlan.some(item => item.includes('atomic.discovery')), 'provider-led skills must compose discovery');
assert.ok(workerPlan.some(item => item.includes('atomic.quote')), 'provider-led skills must compose quote');

const repairPlan = resolveSkillCapabilityPlan('repair');
assert.ok(repairPlan && repairPlan.some(item => item.includes('atomic.evidence')), 'repair must compose evidence');

console.log(`Capability composability regression passed: ${catalog.length} descriptors, reusable atomic plans verified.`);
