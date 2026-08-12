import assert from 'node:assert/strict';
import { calculateTrustScoreValue, listTrustScoreLedger, recalculateTrustScore } from '../src/services/trustScore.js';
import { upsertProfile } from '../src/routes/authRoutes.js';

assert.equal(calculateTrustScoreValue({ avgRating: 3, completedJobs: 0, verifiedProvider: false, disputesLost: 0, accountAgeDays: 0 }), 5, 'neutral profile should begin at the 5.0 baseline');
assert.equal(calculateTrustScoreValue({ avgRating: 5, completedJobs: 100, verifiedProvider: true, disputesLost: 0, accountAgeDays: 365 }), 8, 'formula should cap at the documented 8.0 range');
assert.equal(calculateTrustScoreValue({ avgRating: 3, completedJobs: 0, verifiedProvider: false, disputesLost: 5, accountAgeDays: 0 }), 4, 'each reviewed lost dispute should reduce the score by 0.2');
assert.equal(calculateTrustScoreValue({ avgRating: 0, completedJobs: 0, verifiedProvider: false, disputesLost: 0, accountAgeDays: 0 }), 5, 'profiles without ratings should use the neutral 3.0 rating');

const phone = `+234809${String(Date.now()).slice(-7)}`;
await upsertProfile(phone, 'Trust Ledger Test');
const recalculated = await recalculateTrustScore(phone, 'regression_recalculation');
assert.ok(recalculated, 'An existing profile must produce a canonical Trust Score');
const ledger = await listTrustScoreLedger(phone);
assert.equal(ledger[0]?.reason, 'regression_recalculation', 'Recalculation must record an explicit audit reason');
assert.equal(ledger[0]?.score, recalculated?.score, 'Ledger score must match the persisted canonical score result');
assert.equal(typeof ledger[0]?.breakdown.completedJobs, 'number', 'Ledger evidence must contain a concise canonical breakdown rather than hidden reasoning');
console.log('Trust Score formula and ledger regression passed.');
