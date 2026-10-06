/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-points-${process.pid}-${Date.now()}.sqlite`;
const { getDb } = await import('../src/database.js');
const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { addPoints, awardJobCompletion, deductPoints, getPointsBalance, getPointsHistory } = await import('../src/services/pointsEngine.js');

const ngPhone = `+234810${String(Date.now()).slice(-8)}`;
const ukPhone = `+44770${String(Date.now()).slice(-7)}`;
const providerPhone = `+234811${String(Date.now()).slice(-7)}`;
await upsertProfile(ngPhone, 'Points NG Actor');
await upsertProfile(ukPhone, 'Points UK Actor');
await upsertProfile(providerPhone, 'Points Provider Actor');
const db = await getDb();
db.run('UPDATE memory_profiles SET country = ? WHERE phone = ?', ['gb', ukPhone]);

const initial = await getPointsBalance(ngPhone);
await addPoints(ngPhone, 25, 'Points matrix award');
assert.equal(await getPointsBalance(ngPhone), initial + 25);
const spent = await deductPoints(ngPhone, 5, 'Points matrix spend');
assert.equal(spent.success, true);
assert.equal(spent.remainingPoints, initial + 20);
const history = await getPointsHistory(ngPhone, 20);
assert.ok(history.some((entry: any) => String(entry.description).includes('Points matrix award')));
assert.ok(history.some((entry: any) => String(entry.description).includes('Points matrix spend')));
assert.equal(await getPointsBalance(ukPhone), 0, 'UK Points must remain disabled by design');
const completionBefore = await getPointsBalance(providerPhone);
await awardJobCompletion(providerPhone, 5, 'verified-outcome:test-request-1');
await awardJobCompletion(providerPhone, 5, 'verified-outcome:test-request-1');
assert.equal(await getPointsBalance(providerPhone), completionBefore + 5, 'A verified outcome marker must award completion Points only once.');
await awardJobCompletion(providerPhone, 4, 'verified-outcome:test-request-2');
assert.equal(await getPointsBalance(providerPhone), completionBefore + 9, 'A distinct verified outcome marker must remain independently rewardable.');
console.log('Points regression passed: owner-scoped award/spend history, distinct loyalty units, UK boundary, and idempotent verified outcome rewards verified.');
