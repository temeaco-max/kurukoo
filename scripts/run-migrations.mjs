import { getDb, saveDb } from '../dist/database.js';
import { migrationReadiness, runMigrations } from '../dist/services/migrationRunner.js';

const db = await getDb();
const before = migrationReadiness(db);
if (!before.ready) {
  throw new Error(`Migration checksum drift detected: ${before.checksumDrift.join(', ')}`);
}
const result = runMigrations(db);
saveDb(true);
console.log(JSON.stringify({ ok: true, ...result, readiness: migrationReadiness(db) }, null, 2));
