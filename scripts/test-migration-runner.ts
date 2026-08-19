import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrationReadiness, runMigrations } from '../src/services/migrationRunner.js';

const SQL = await initSqlJs();
const db = new SQL.Database();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-migrations-'));
fs.writeFileSync(path.join(dir, '0001_first.sql'), 'CREATE TABLE IF NOT EXISTS migration_probe (id INTEGER PRIMARY KEY, value TEXT);\n');
fs.writeFileSync(path.join(dir, '0002_second.sql'), "INSERT INTO migration_probe (id, value) VALUES (1, 'ok');\n");

const first = runMigrations(db, dir);
assert.deepEqual(first.applied, ['0001', '0002']);
assert.equal(db.exec("SELECT value FROM migration_probe WHERE id=1")[0].values[0][0], 'ok');

const second = runMigrations(db, dir);
assert.deepEqual(second.applied, []);
assert.deepEqual(second.skipped, ['0001', '0002']);

const ready = migrationReadiness(db, dir);
assert.equal(ready.ready, true);
assert.deepEqual(ready.pending, []);
assert.deepEqual(ready.checksumDrift, []);

fs.writeFileSync(path.join(dir, '0002_second.sql'), "INSERT INTO migration_probe (id, value) VALUES (1, 'changed');\n");
const drift = migrationReadiness(db, dir);
assert.equal(drift.ready, false);
assert.deepEqual(drift.checksumDrift, ['0002']);
assert.throws(() => runMigrations(db, dir), /checksum drift detected/i);

fs.rmSync(dir, { recursive: true, force: true });
console.log('Migration runner contract passed: ordered application, durable ledger, idempotent replay, readiness projection, and checksum-drift fail-closed behaviour.');
