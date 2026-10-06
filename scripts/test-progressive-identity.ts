/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-progressive-identity-${process.pid}-${Date.now()}.sqlite`;
const { getDb } = await import('../src/database.js');
const { createAuthChallenge, consumeAuthChallengeToken, isProvisionalEmailSubject, progressiveAuthReadiness, sanitizeReturnPath } = await import('../src/services/authChallengeService.js');
const { assessProgressiveIdentity } = await import('../src/services/progressiveIdentityService.js');

process.env.NODE_ENV = 'test';
process.env.KURUKOO_PROGRESSIVE_TRUST_ENABLED = 'false';
process.env.KURUKOO_MAGIC_LINK_AUTH = 'true';
process.env.KURUKOO_AUTH_CHALLENGE_DEBUG = 'true';

assert.equal(sanitizeReturnPath('/chat?x=1'), '/chat?x=1');
assert.equal(sanitizeReturnPath('https://evil.example'), undefined);
assert.equal(sanitizeReturnPath('//evil.example'), undefined);
assert.equal(sanitizeReturnPath('/unknown'), '/chat');
assert.equal(isProvisionalEmailSubject('em_123'), true);

const guest = await assessProgressiveIdentity('anon_progressive_test');
assert.equal(guest.tier, 'presence');
assert.equal(guest.allowed.economic_request, false);
assert.equal(guest.allowed.payment, false);

const provisional = await assessProgressiveIdentity('em_progressive_test');
assert.equal(provisional.tier, 'account');
assert.equal(provisional.isProvisionalEmail, true);
assert.equal(provisional.allowed.economic_request, false);
assert.equal(provisional.allowed.provider_action, false);
assert.equal(provisional.allowed.pulse_broadcast, false);

const readiness = progressiveAuthReadiness();
assert.equal(readiness.magicLinkEnabled, true);

const created = await createAuthChallenge({
  phone: 'em_test_progressive_subject',
  email: 'progressive@example.test',
  purpose: 'email_account_provisional',
  channel: 'email',
  returnPath: '/chat?progressive=1',
});
assert.ok(created.token);
assert.match(created.challenge.id, /^[0-9a-f-]{36}$/i);

const first = await consumeAuthChallengeToken(created.token);
assert.equal(first.success, true);
if (first.success) assert.equal(first.challenge.consumedAt !== undefined, true);

const second = await consumeAuthChallengeToken(created.token);
assert.equal(second.success, false);

const db = await getDb();
db.run('DELETE FROM auth_challenges WHERE id = ?', [created.challenge.id]);

console.log('Progressive identity contract passed.');
