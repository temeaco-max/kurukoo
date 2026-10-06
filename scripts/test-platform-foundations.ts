/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

import { inspectAttachmentSecurity } from '../src/services/attachmentSecurityBoundary.js';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-platform-foundations-${process.pid}-${Date.now()}.sqlite`;
const { getDb, saveDb } = await import('../src/database.js');
const { enqueueDurableJob, claimDurableJob, completeDurableJob, getDurableJob } = await import('../src/services/durableJobQueue.js');
const { ensureProviderVerification, submitProviderVerification, getProviderVerification } = await import('../src/services/providerVerificationLifecycle.js');

const worker = `foundation-test-${process.pid}`;
const jobId = `foundation-test:${process.pid}:${Date.now()}`;
const providerPhone = `foundation-test:+${process.pid}${Date.now()}`;

try {
  await enqueueDurableJob({ id: jobId, kind: 'foundation_test', payload: { hello: 'world' }, maxAttempts: 3 });
  const claimed = await claimDurableJob(worker, ['foundation_test']);
  assert.ok(claimed, 'durable job should be claimable');
  assert.equal(claimed.id, jobId);
  assert.equal(claimed.kind, 'foundation_test');
  assert.equal(claimed.payload.hello, 'world');
  assert.equal(claimed.status, 'running');
  assert.equal(await completeDurableJob(jobId, worker), true, 'claimed job should complete');
  const completed = await getDurableJob(jobId);
  assert.equal(completed?.status, 'completed');

  const initial = await ensureProviderVerification(providerPhone, 'human');
  assert.equal(initial.state, 'draft');
  const submitted = await submitProviderVerification({ providerPhone, entityType: 'business', evidence: ['synthetic-evidence-reference'] });
  assert.equal(submitted.state, 'submitted');
  assert.equal(submitted.entityType, 'business');
  assert.deepEqual(submitted.evidence, ['synthetic-evidence-reference']);
  const loaded = await getProviderVerification(providerPhone);
  assert.equal(loaded?.state, 'submitted');

  const accepted = inspectAttachmentSecurity({ data: Buffer.from('synthetic-safe'), mimeType: 'text/plain', filename: 'foundation.txt' });
  assert.equal(accepted.state, 'accepted');
  const rejected = inspectAttachmentSecurity({ data: Buffer.from('<script>synthetic</script>'), mimeType: 'text/plain', filename: 'foundation.txt' });
  assert.equal(rejected.state, 'rejected');

  console.log('Platform foundation contract passed: durable queue lease/claim/completion, provider verification submission, and attachment security.');
} finally {
  const db = await getDb();
  try { db.run('DELETE FROM durable_jobs WHERE id=?', [jobId]); } catch {}
  try { db.run('DELETE FROM provider_verification WHERE provider_phone=?', [providerPhone]); } catch {}
  saveDb();
}
