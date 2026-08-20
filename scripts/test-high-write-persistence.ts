import assert from 'node:assert/strict';
import { assertHighWritePersistence, getHighWritePersistenceStatus } from '../src/services/highWritePersistence.js';

const priorWorkers = process.env.KURUKOO_WORKERS;
const status = getHighWritePersistenceStatus();
assert.equal(status.activeMode, 'sqljs_single_worker');
assert.deepEqual(status.domains, ['messages_conversations', 'durable_jobs', 'commercial_ledger']);
assert.equal(status.concurrentWriterSafe, false);
assert.equal(status.migrationPolicy, 'single-owner-no-dual-write');

process.env.KURUKOO_WORKERS = '1';
for (const domain of status.domains) assert.doesNotThrow(() => assertHighWritePersistence(domain), `${domain} must remain available in the intentional single-writer mode`);
process.env.KURUKOO_WORKERS = '2';
for (const domain of status.domains) assert.throws(() => assertHighWritePersistence(domain), /Unsafe multi-worker write blocked/, `${domain} must reject unsafe SQL.js multi-worker writes`);
if (priorWorkers === undefined) delete process.env.KURUKOO_WORKERS; else process.env.KURUKOO_WORKERS = priorWorkers;
console.log('High-write persistence regression passed: one SQL.js owner, explicit migration seam, and unsafe multi-worker write block verified.');
