/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-memory-self-service-${process.pid}-${Date.now()}.sqlite`;

process.env.NODE_ENV = 'test';
const { getDb } = await import('../src/database.js');
const { getMemoryFacts, recordMemoryFact, revokeMemoryFact } = await import('../src/services/memoryProfile.js');

const db = await getDb();
const owner = '+2347000099001';
const stranger = '+2347000099002';
db.run('INSERT OR IGNORE INTO memory_profiles (phone, name) VALUES (?, ?)', [owner, 'Memory Owner']);
db.run('INSERT OR IGNORE INTO memory_profiles (phone, name) VALUES (?, ?)', [stranger, 'Memory Stranger']);

await recordMemoryFact(owner, 'preference', 'short answers', 'user_declared', { sourceRef: 'test' });
await recordMemoryFact(stranger, 'preference', 'long answers', 'user_declared', { sourceRef: 'test' });
const ownerFacts = await getMemoryFacts(owner);
assert.ok(ownerFacts.some((fact) => fact.field === 'preference' && fact.value === 'short answers'));
const ownerFact = ownerFacts.find((fact) => fact.field === 'preference' && fact.value === 'short answers');
assert.ok(ownerFact, 'owner fact should be present');

const strangerAttempt = await revokeMemoryFact(stranger, ownerFact.id);
assert.equal(strangerAttempt.revoked, false, 'another account must not revoke the owner fact');
assert.equal(strangerAttempt.reason, 'not_found');

const revoked = await revokeMemoryFact(owner, ownerFact.id);
assert.deepEqual(revoked, { revoked: true });
assert.equal((await getMemoryFacts(owner)).some((fact) => fact.id === ownerFact.id), false, 'revoked facts must leave active retrieval');
const repeated = await revokeMemoryFact(owner, ownerFact.id);
assert.equal(repeated.revoked, false);
assert.equal(repeated.reason, 'already_revoked');

const source = fs.readFileSync(path.join(process.cwd(), 'src/routes/economicRequestRouter.ts'), 'utf8');
assert.match(source, /router\.get\('\/memory\/facts', authenticateUser/);
assert.match(source, /router\.delete\('\/memory\/facts\/:id', authenticateUser/);
assert.match(source, /facts\.map\(\(\{ id, field, value, provenance, confidence, sourceConversationId, observedAt, expiresAt \}\)/, 'memory route must project only the owner-verified conversation context');
assert.doesNotMatch(source, /source_ref/, 'memory route must not expose raw source_ref provenance');

console.log('Memory self-service contract passed: owner scoping, revocation, repeat handling, active retrieval, and source-reference redaction.');
