import assert from 'node:assert/strict';
import {
  getUnknownIntentFeedbackSummary,
  listUnknownIntentFeedback,
  recordUnknownIntentCandidate,
  reviewUnknownIntentCandidate,
} from '../src/services/unknownIntentFeedbackService.js';

const suffix = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 10) || 'contractcase';
const query = `unmapped service ${suffix}`;
await recordUnknownIntentCandidate(query, { category: 'digital-services', skill: 'digital_executor', confidence: 0.22, provenance: 'contract_test' });
await recordUnknownIntentCandidate(query, { category: 'digital-services', skill: 'digital_executor', confidence: 0.22, provenance: 'contract_test' });
const pending = (await listUnknownIntentFeedback(200)).find(item => String(item.normalized_query) === query.toLowerCase());
assert.ok(pending);
assert.equal(Number(pending.frequency), 2, 'repeated canonical feedback must aggregate rather than create a duplicate candidate');
const review = await reviewUnknownIntentCandidate(Number(pending.id), 'accepted', `reviewer-${suffix}`, { label: 'digital_executor', text: query });
assert.equal(review.automaticTraining, false, 'reviewed feedback must not mutate training automatically');
assert.ok(review.trainingLineageId?.startsWith('fasttext-review:'));
const summary = await getUnknownIntentFeedbackSummary();
assert.ok(summary.total >= 1);
assert.equal(summary.trainingPolicy, 'reviewed_candidates_only_no_raw_traffic_auto_training');
console.log('Unknown-intent feedback contract passed: deduplication, review lineage, canonical summary, and no automatic training.');
