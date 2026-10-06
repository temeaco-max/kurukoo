/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-compliance-${process.pid}-${Date.now()}.sqlite`;

test('checkCompliance flags scam keywords', async () => {
  const { checkCompliance } = await import('../src/services/complianceFilter.js');
  // Scam keywords from SCAM_KEYWORDS in complianceFilter.ts
  const result = await checkCompliance('+2347012345678', 'Send money via western union now');
  assert.equal(result, false, 'western union scam must be flagged');
});

test('checkCompliance flags crypto scam patterns', async () => {
  const { checkCompliance } = await import('../src/services/complianceFilter.js');
  const result = await checkCompliance('+2347012345678', 'Invest in this bitcoin opportunity');
  assert.equal(result, false, 'bitcoin scam must be flagged');
});

test('checkCompliance passes benign content', async () => {
  const { checkCompliance } = await import('../src/services/complianceFilter.js');
  const result = await checkCompliance('+2347012345678', 'I need help fixing my car');
  assert.equal(result, true, 'benign content must pass');
});

test('checkCompliance flags blocklist patterns from config/blocklist.json', async () => {
  const { checkCompliance } = await import('../src/services/complianceFilter.js');
  // "send otp" is in blocklist.json patterns
  const result = await checkCompliance('+2347012345678', 'Please send otp code');
  assert.equal(result, false, 'otp phishing must be flagged');
});

test('config/blocklist.json exists and is valid JSON', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const blocklistPath = path.join(process.cwd(), 'config', 'blocklist.json');
  assert.ok(fs.existsSync(blocklistPath), 'config/blocklist.json must exist');
  const content = JSON.parse(fs.readFileSync(blocklistPath, 'utf8'));
  assert.ok(content.patterns && Array.isArray(content.patterns), 'blocklist must have patterns array');
});