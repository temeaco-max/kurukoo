/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-secure-services-${process.pid}-${Date.now()}.sqlite`;
const { encryptSecret, decryptSecret, deriveKey } = await import('../src/services/secureCredentialStore.js');

test('secure credential crypto roundtrip', () => {
  const passphrase = 'correct horse battery staple';
  const secret = 's3cr3t-password';
  const encrypted = encryptSecret(secret, passphrase);
  assert.ok(encrypted.ciphertext, 'must produce ciphertext');
  assert.ok(encrypted.iv && encrypted.salt, 'must produce iv and salt');
  const decrypted = decryptSecret(encrypted, passphrase);
  assert.equal(decrypted, secret, 'must decrypt back to original');
});

test('secure credential wrong passphrase fails', () => {
  const encrypted = encryptSecret('my-secret', 'right-pass');
  let threw = false;
  try { decryptSecret(encrypted, 'wrong-pass'); } catch { threw = true; }
  assert.ok(threw, 'decrypt with wrong passphrase should fail');
});

test('deriveKey is deterministic with same salt, different with different salt', () => {
  const saltA = Buffer.from('00000000000000000000000000000000');
  const a1 = deriveKey('pw', saltA);
  const a2 = deriveKey('pw', saltA);
  assert.deepEqual(Buffer.from(a1), Buffer.from(a2), 'same salt+pass -> same key');
  const saltB = Buffer.from('11111111111111111111111111111111');
  const b = deriveKey('pw', saltB);
  assert.notDeepEqual(Buffer.from(a1), Buffer.from(b), 'different salt -> different key');
});

test('feature flags expose the 4 new UK-gated capabilities', async () => {
  const { FEATURE_REGISTRY } = await import('../src/services/featureFlags.js');
  assert.ok(FEATURE_REGISTRY['secure_credentials'], 'secure_credentials flag');
  assert.ok(FEATURE_REGISTRY['one_time_cards'], 'one_time_cards flag');
  assert.ok(FEATURE_REGISTRY['secure_execution'], 'secure_execution flag');
  assert.ok(FEATURE_REGISTRY['execution_audit'], 'execution_audit flag');
  // All four are UK-gated
  for (const flag of ['secure_credentials', 'one_time_cards', 'secure_execution', 'execution_audit']) {
    assert.ok((FEATURE_REGISTRY[flag].markets ?? []).includes('gb'), `${flag} must be gated to gb market`);
  }
});

test('execution network contract has the 4 new pillars (43 total)', async () => {
  const { listExecutionNetworkPillars, validateExecutionNetworkContract } = await import('../src/services/executionNetworkContract.js');
  const result = validateExecutionNetworkContract();
  assert.equal(result.valid, true, 'contract must validate');
  assert.equal(result.count, 43, 'contract must have 43 pillars');
  const ids = new Set(listExecutionNetworkPillars().map((p) => p.id));
  for (const id of ['secure_credential_vault', 'one_time_card_protection', 'isolated_execution_surface', 'user_audit_timeline']) {
    assert.ok(ids.has(id), `${id} pillar must exist`);
  }
});