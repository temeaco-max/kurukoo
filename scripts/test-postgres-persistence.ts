import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const connectionString = process.env.KURUKOO_TEST_POSTGRES_URL;
const childMode = process.argv[2];
const testTable = process.env.KURUKOO_TEST_POSTGRES_TABLE || `kurukoo_pg_cutover_${crypto.randomBytes(6).toString('hex')}`;

function loadPostgres(): any {
  try {
    const module = require('postgres');
    return typeof module === 'function' ? module : module.default;
  } catch {
    return null;
  }
}

function runPreflight(integrated: 'true' | 'false') {
  return spawnSync(process.execPath, ['scripts/production-preflight.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      KURUKOO_DATABASE_MODE: 'postgres',
      KURUKOO_POSTGRES_APPLICATION_INTEGRATED: integrated,
      KURUKOO_PERSISTENT_STATE_REQUIRED: 'false',
      KURUKOO_PAY_PROVIDER: 'stripe',
      DATABASE_URL: 'postgres://localhost/kurukoo_contract',
    },
  });
}

const blockedPreflight = runPreflight('false');
assert.notEqual(blockedPreflight.status, 0, 'production preflight must block PostgreSQL mode while application integration is disabled');
assert.match(`${blockedPreflight.stdout}${blockedPreflight.stderr}`, /postgres|integration/i);

const readyPreflight = runPreflight('true');
if (loadPostgres()) {
  assert.equal(readyPreflight.status, 0, 'production preflight should permit PostgreSQL only after the repository-wide persistence boundary is satisfied');
  assert.match(`${readyPreflight.stdout}${readyPreflight.stderr}`, /"postgresApplicationIntegrated"\s*:\s*true/);
} else {
  assert.notEqual(readyPreflight.status, 0, 'missing postgres client must still block activation');
  assert.match(`${readyPreflight.stdout}${readyPreflight.stderr}`, /requires the pinned postgres client/);
}

if (childMode) {
  if (!connectionString) throw new Error('KURUKOO_TEST_POSTGRES_URL is required for the PostgreSQL runtime child.');
  const postgres = loadPostgres();
  if (!postgres) throw new Error('Pinned postgres client is not installed.');
  const sql = postgres(connectionString, { max: 2, connect_timeout: 5, ssl: String(process.env.KURUKOO_POSTGRES_SSL || 'true').toLowerCase() !== 'false' ? 'require' : false });
  try {
    if (childMode === 'writer-a') {
      await sql.begin(async tx => {
        await tx.unsafe(`INSERT INTO "${testTable}" (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['shared', 'writer-a']);
        await tx.unsafe(`INSERT INTO "${testTable}" (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['duplicate', 'first']);
        await tx.unsafe(`INSERT INTO "${testTable}" (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['duplicate', 'second']);
      });
      console.log('writer-a: ok');
    } else if (childMode === 'writer-b') {
      await sql`INSERT INTO ${sql(testTable)} (key, value) VALUES ('shared-b', 'writer-b') ON CONFLICT (key) DO NOTHING`;
      console.log('writer-b: ok');
    } else if (childMode === 'reader') {
      const rows = await sql.unsafe(`SELECT key, value FROM "${testTable}" ORDER BY key`);
      assert.equal(rows.length, 3, 'both processes must observe the same committed state and duplicate idempotency must remain unique');
      const duplicate = rows.filter((row: any) => row.key === 'duplicate');
      assert.equal(duplicate.length, 1);
      console.log('reader: shared state verified');
    } else {
      throw new Error(`Unknown child mode: ${childMode}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(0);
}

if (!connectionString) {
  console.log('PostgreSQL runtime: BLOCKED_EXTERNAL — set KURUKOO_TEST_POSTGRES_URL or DATABASE_URL to run the real two-process test. No SQLite substitute is used.');
  process.exit(0);
}

const postgres = loadPostgres();
if (!postgres) {
  console.log('PostgreSQL runtime: BLOCKED_EXTERNAL — pinned postgres client is not installed.');
  process.exit(0);
}

const sql = postgres(connectionString, { max: 4, connect_timeout: 5, ssl: String(process.env.KURUKOO_POSTGRES_SSL || 'true').toLowerCase() !== 'false' ? 'require' : false });
const runChild = (mode: string) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], mode], {
    env: { ...process.env, KURUKOO_TEST_POSTGRES_TABLE: testTable },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${mode} exited ${code}: ${stderr || stdout}`)));
});

try {
  await sql`CREATE TABLE IF NOT EXISTS ${sql(testTable)} (key text PRIMARY KEY, value text NOT NULL)`;
  await sql`TRUNCATE TABLE ${sql(testTable)}`;
  await sql.begin(async tx => {
    await tx`INSERT INTO ${sql(testTable)} (key, value) VALUES ('rollback-check', 'before')`;
    throw new Error('intentional rollback');
  }).catch(() => undefined);
  const rolledBack = await sql`SELECT COUNT(*)::int AS count FROM ${sql(testTable)} WHERE key = 'rollback-check'`;
  assert.equal(Number(rolledBack[0]?.count || 0), 0, 'transaction rollback must leave no row');

  await Promise.all([runChild('writer-a'), runChild('writer-b')]);
  await runChild('reader');

  await sql`DROP TABLE ${sql(testTable)}`;
  console.log('PostgreSQL runtime: VERIFIED — real shared database, two processes, transaction rollback and idempotency/concurrent-write checks passed.');
} finally {
  await sql.end({ timeout: 5 });
}
