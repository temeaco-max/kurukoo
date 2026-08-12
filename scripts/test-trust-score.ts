import assert from 'node:assert/strict';
import { calculateTrustScoreValue } from '../src/services/trustScore.js';

assert.equal(calculateTrustScoreValue({ avgRating: 3, completedJobs: 0, verifiedProvider: false, disputesLost: 0, accountAgeDays: 0 }), 5, 'neutral profile should begin at the 5.0 baseline');
assert.equal(calculateTrustScoreValue({ avgRating: 5, completedJobs: 100, verifiedProvider: true, disputesLost: 0, accountAgeDays: 365 }), 8, 'formula should cap at the documented 8.0 range');
assert.equal(calculateTrustScoreValue({ avgRating: 3, completedJobs: 0, verifiedProvider: false, disputesLost: 5, accountAgeDays: 0 }), 4, 'each reviewed lost dispute should reduce the score by 0.2');
assert.equal(calculateTrustScoreValue({ avgRating: 0, completedJobs: 0, verifiedProvider: false, disputesLost: 0, accountAgeDays: 0 }), 5, 'profiles without ratings should use the neutral 3.0 rating');
console.log('Trust Score formula regression passed.');
