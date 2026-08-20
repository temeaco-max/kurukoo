import { strict as assert } from 'node:assert';
import { getDb } from '../src/database.js';
import { recordUnknownIntentCandidate, listUnknownIntentFeedback, reviewUnknownIntentCandidate } from '../src/services/unknownIntentFeedbackService.js';

const query = `synthetic review candidate ${Date.now()} secret=should-not-persist`;
await recordUnknownIntentCandidate(query, { category: 'general', skill: 'find_worker', provenance: 'ci_review' });
const rows = await listUnknownIntentFeedback(250);
const candidate = rows.find(row => String(row.normalized_query).includes('synthetic review candidate'));
assert.ok(candidate, 'unknown-intent candidate was not queued');
assert.equal(candidate.status, 'pending');
assert.doesNotMatch(String(candidate.query), /should-not-persist/, 'candidate text must be privacy-redacted');

const accepted = await reviewUnknownIntentCandidate(Number(candidate.id), 'ci-reviewer', 'accepted', { label: 'find_worker', text: query });
assert.equal(accepted.automaticTraining, false);
assert.ok(accepted.trainingLineageId, 'accepted review must record training lineage');
const acceptedRows = await listUnknownIntentFeedback(250);
const acceptedCandidate = acceptedRows.find(row => row.id === candidate.id);
assert.ok(acceptedCandidate, 'accepted review candidate was not persisted');
assert.equal(acceptedCandidate.reviewer, 'ci-reviewer');

const db = await getDb();
const check = db.prepare('SELECT status, training_lineage_id FROM unknown_intents WHERE id=? LIMIT 1');
check.bind([candidate.id]);
assert.equal(check.step(), true);
const row = check.getAsObject() as any;
check.free();
assert.equal(row.status, 'accepted');
assert.ok(row.training_lineage_id);

console.log(JSON.stringify({ passed: true, candidateId: candidate.id }, null, 2));
