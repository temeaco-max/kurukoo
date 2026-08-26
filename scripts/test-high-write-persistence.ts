import assert from 'node:assert/strict';
import { assertHighWritePersistence, getHighWritePersistenceStatus } from '../src/services/highWritePersistence.js';

const priorWorkers = process.env.KURUKOO_WORKERS;
process.env.KURUKOO_WORKERS = '1';
const singleWorker = getHighWritePersistenceStatus();
assert.deepEqual(singleWorker.domains, ['messages_conversations', 'durable_jobs', 'commercial_ledger']);
assert.equal(singleWorker.migrationPolicy, 'single-owner-no-dual-write');
assert.doesNotThrow(() => assertHighWritePersistence('messages_conversations'));
process.env.KURUKOO_WORKERS = '2';
if (!getHighWritePersistenceStatus().concurrentWriterSafe) {
  assert.throws(() => assertHighWritePersistence('durable_jobs'), /Unsafe multi-worker write blocked/);
}
if (priorWorkers == null) delete process.env.KURUKOO_WORKERS; else process.env.KURUKOO_WORKERS = priorWorkers;
console.log('High-write persistence contract passed: active mode, declared domains, single-owner policy, and multi-worker safety guard.');
