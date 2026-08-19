import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface MigrationRecord {
  version: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  current: string | null;
}

function checksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function ensureLedger(db: any): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function readMigrations(directory = path.resolve(process.cwd(), 'migrations')): Array<{ version: string; file: string; content: string; checksum: string }> {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => /^\d+_[A-Za-z0-9_-]+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => {
      const version = file.split('_', 1)[0];
      const content = fs.readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/, '');
      return { version, file, content, checksum: checksum(content) };
    });
}

function appliedMigrations(db: any): Map<string, string> {
  const rows = db.exec('SELECT version, checksum FROM schema_migrations ORDER BY version ASC')[0]?.values || [];
  return new Map(rows.map((row: unknown[]) => [String(row[0]), String(row[1])]));
}

export function migrationReadiness(db: any, directory?: string): { ready: boolean; pending: string[]; checksumDrift: string[]; current: string | null } {
  ensureLedger(db);
  const applied = appliedMigrations(db);
  const migrations = readMigrations(directory);
  const pending: string[] = [];
  const checksumDrift: string[] = [];
  for (const migration of migrations) {
    const recorded = applied.get(migration.version);
    if (!recorded) pending.push(migration.version);
    else if (recorded !== migration.checksum) checksumDrift.push(migration.version);
  }
  return {
    ready: checksumDrift.length === 0,
    pending,
    checksumDrift,
    current: migrations.length ? migrations[migrations.length - 1].version : null,
  };
}

export function runMigrations(db: any, directory?: string): MigrationResult {
  ensureLedger(db);
  const applied = appliedMigrations(db);
  const migrations = readMigrations(directory);
  const result: MigrationResult = { applied: [], skipped: [], current: migrations.length ? migrations[migrations.length - 1].version : null };

  for (const migration of migrations) {
    const recorded = applied.get(migration.version);
    if (recorded) {
      if (recorded !== migration.checksum) {
        throw new Error(`Migration checksum drift detected for ${migration.version} (${migration.file}). Refusing to continue.`);
      }
      result.skipped.push(migration.version);
      continue;
    }

    db.run('BEGIN');
    try {
      if (migration.content.trim()) db.run(migration.content);
      db.run('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [migration.version, migration.checksum]);
      db.run('COMMIT');
      result.applied.push(migration.version);
    } catch (error) {
      try { db.run('ROLLBACK'); } catch {}
      throw error;
    }
  }
  return result;
}
