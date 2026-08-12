import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';

const dbPath = path.join(os.tmpdir(), `kurukoo-participant-migration-${process.pid}.sqlite`);
const SQL = await initSqlJs();
const legacy = new SQL.Database();
legacy.run(`
  CREATE TABLE economic_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('seller', 'delivery_provider', 'external_platform', 'agent')),
    provider_phone TEXT NOT NULL,
    capability TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited', 'offered', 'selected', 'confirmed', 'handover_pending', 'handed_over', 'collected', 'in_progress', 'delivered', 'declined', 'withdrawn')),
    evidence_json TEXT NOT NULL DEFAULT '{}',
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, role, provider_phone)
  );
  CREATE INDEX idx_economic_participants_request ON economic_participants(request_id);
  INSERT INTO economic_participants(request_id,role,provider_phone,capability,status,evidence_json,added_at)
    VALUES ('legacy-request-001','seller','legacy-seller','product_sourcing','offered','{"offer_reference":"old-offer"}','2026-08-01T10:00:00.000Z');
`);
fs.writeFileSync(dbPath, Buffer.from(legacy.export()));
legacy.close();

process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
const { getDb, saveDb } = await import('../src/database.js');

try {
  const db = await getDb();
  const preserved = db.exec(`SELECT id,request_id,role,provider_phone,capability,status,evidence_json,added_at FROM economic_participants WHERE request_id='legacy-request-001'`)[0]?.values || [];
  assert.equal(preserved.length, 1, 'one legacy participant must survive the migration');
  assert.deepEqual(preserved[0].slice(1, 6), ['legacy-request-001', 'seller', 'legacy-seller', 'product_sourcing', 'offered'], 'legacy participant identity and status must be preserved');
  assert.equal(String(preserved[0][6]), '{"offer_reference":"old-offer"}', 'legacy participant evidence must be preserved');
  assert.equal(String(preserved[0][7]), '2026-08-01T10:00:00.000Z', 'legacy participant timestamp must be preserved');

  const tableSql = String(db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='economic_participants'`)[0]?.values?.[0]?.[0] || '');
  assert.match(tableSql, /'service_provider'/, 'migrated schema must permit service_provider');
  assert.match(tableSql, /'accepted'/, 'migrated schema must permit accepted provider responses');
  const indexes = (db.exec(`PRAGMA index_list(economic_participants)`)[0]?.values || []).map((row: any[]) => String(row[1]));
  assert.ok(indexes.includes('idx_economic_participants_request'), 'participant request index must be recreated');

  db.run(`INSERT INTO economic_participants(request_id,role,provider_phone,capability,status,evidence_json) VALUES (?,?,?,?,?,?)`, ['migrated-request-002', 'service_provider', 'new-provider', 'phone_repairer', 'accepted', '{"verification":"authoritative"}']);
  saveDb(true);
  const postMigration = db.exec(`SELECT role,status,evidence_json FROM economic_participants WHERE request_id='migrated-request-002'`)[0]?.values || [];
  assert.deepEqual(postMigration[0], ['service_provider', 'accepted', '{"verification":"authoritative"}'], 'new participant role and status must persist after migration');
  console.log('Economic participant migration regression passed: existing record, evidence, timestamp, unique structure, and request index preserved; service_provider/accepted accepted by migrated persistent schema.');
} finally {
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
