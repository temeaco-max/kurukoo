/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-curation-workflow-${process.pid}-${Date.now()}.sqlite`;
const { getDb, saveDb } = await import('../src/database.js');
const { ensureCurationSchema, getCurationCandidate, reviewCurationCandidate, rewriteCurationCandidate, getCurationAudit, getAcceptedCorpusGate, acceptedCorpusHash } = await import('../src/services/curationService.js');

async function main() {
  const routeSource = fs.readFileSync(new URL('../src/routes/adminRoutes.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /router\.get\('\/curation\/queue', authenticateAdmin/);
  assert.match(routeSource, /router\.post\('\/curation\/candidates\/:exampleId\/decision', authenticateAdmin/);
  assert.match(routeSource, /router\.post\('\/curation\/candidates\/:exampleId\/rewrite', authenticateAdmin/);
  assert.match(routeSource, /router\.get\('\/curation\/coverage', authenticateAdmin/);

  await ensureCurationSchema();
  const db = await getDb();
  const id = `curation-test-${Date.now()}`;
  db.run(`INSERT OR REPLACE INTO training_curation_candidates(example_id,trajectory_json,skill,family,actor,market,locale,channel,lifecycle,scenario_variant,teacher_provider,teacher_model,candidate_score,failure_dimensions_json,provenance_json,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, JSON.stringify([{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'Hello. How can I help?' }]), 'reminders', 'assistance', 'buyer', 'NG', 'en-NG', 'web', 'conversation', 'natural', 'test', 'test-model', 0.91, JSON.stringify(['contextRetention']), JSON.stringify({ provider: 'test', reviewed: false }), 'test-hash']);
  saveDb();
  const pending = await getCurationCandidate(id);
  assert.equal(pending?.reviewed, false);
  assert.equal(pending?.accepted, false);

  const rejected = await reviewCurationCandidate({ exampleId: id, decision: 'reject', reviewerId: 'admin-test', notes: 'Does not retain context', reason: 'context_loss', datasetVersion: 'test-v1' });
  assert.equal(rejected.ok, true);
  assert.equal((await getCurationCandidate(id))?.reviewStatus, 'rejected');

  const rewritten = await rewriteCurationCandidate({ exampleId: id, reviewerId: 'admin-test', trajectory: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'Welcome to Kurukoo. What would you like to get done?' }], notes: 'Rewrite to preserve natural opening', reason: 'context_loss' });
  assert.equal(rewritten.ok, true);
  assert.equal((await getCurationCandidate(id))?.reviewStatus, 'needs_rewrite');
  assert.equal((await getCurationCandidate(rewritten.rewriteId))?.rewriteOf, id);
  assert.equal((await getCurationCandidate(rewritten.rewriteId))?.reviewed, false);

  const accepted = await reviewCurationCandidate({ exampleId: rewritten.rewriteId, decision: 'accept', reviewerId: 'admin-test', notes: 'Reviewed and accepted', datasetVersion: 'test-v1' });
  assert.equal(accepted.ok, true);
  assert.equal((await getCurationCandidate(rewritten.rewriteId))?.accepted, true);
  assert.ok((await getCurationAudit(id)).length >= 2);

  const gate = await getAcceptedCorpusGate({ skill: 99, actor: 1, market: 1, locale: 1 });
  assert.equal(gate.permitted, false);
  assert.ok(gate.failures.skill);
  assert.equal(gate.failures.skill.required, 99);
  assert.equal(acceptedCorpusHash([await getCurationCandidate(rewritten.rewriteId)]), acceptedCorpusHash([await getCurationCandidate(rewritten.rewriteId)]));

  db.run('DELETE FROM training_curation_audit WHERE example_id LIKE ?', ['curation-test-%']);
  db.run('DELETE FROM training_curation_candidates WHERE example_id LIKE ?', ['curation-test-%']);
  saveDb();
  console.log('test-curation-workflow: PASS');
}
main().catch(error => { console.error(error); process.exit(1); });
