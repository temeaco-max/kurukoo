import assert from 'node:assert/strict';
import { calculateTrustScoreValue } from '../src/services/trustScore.js';

const neutral = calculateTrustScoreValue({
  avgRating: 3,
  completedJobs: 0,
  verifiedProvider: false,
  disputesLost: 0,
  accountAgeDays: 0,
});
assert.equal(neutral, 5, 'neutral profile should start at the 5.0 base');

const strong = calculateTrustScoreValue({
  avgRating: 5,
  completedJobs: 100,
  verifiedProvider: true,
  disputesLost: 0,
  accountAgeDays: 365,
});
assert.equal(strong, 8, 'formula should cap at the documented 8.0 range');

const penalised = calculateTrustScoreValue({
  avgRating: 3,
  completedJobs: 0,
  verifiedProvider: false,
  disputesLost: 5,
  accountAgeDays: 0,
});
assert.equal(penalised, 4, 'each lost dispute should reduce the score by 0.2');

const neutralisesMissingRating = calculateTrustScoreValue({
  avgRating: 0,
  completedJobs: 0,
  verifiedProvider: false,
  disputesLost: 0,
  accountAgeDays: 0,
});
assert.equal(neutralisesMissingRating, 5, 'missing ratings should use the neutral 3.0 rating');

console.log('Trust Score regression passed.');
