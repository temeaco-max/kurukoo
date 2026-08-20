import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { assertHighWritePersistence } from './highWritePersistence.js';

export type DurableJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';

export interface DurableJob {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: DurableJobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  lockedUntil?: string;
  lockedBy?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

let schemaPromise: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  assertHighWritePersistence('durable_jobs');
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = await getDb();
    db.run(`CREATE TABLE IF NOT EXISTS durable_jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      available_at TEXT NOT NULL,
      locked_until TEXT,
      locked_by TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_durable_jobs_claim ON durable_jobs(status, available_at, locked_until)');
    db.run('CREATE INDEX IF NOT EXISTS idx_durable_jobs_kind ON durable_jobs(kind, created_at DESC)');
    saveDb();
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function json(value: unknown): string {
  const raw = JSON.stringify(value ?? {});
  return raw.length > 32_000 ? `${raw.slice(0, 32_000)}...` : raw;
}

function isoAfterMs(ms: number): string { return new Date(Date.now() + Math.max(0, ms)).toISOString(); }
function parseJson(value: unknown): Record<string, unknown> {
  try { const parsed = JSON.parse(String(value || '{}')); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}

export async function enqueueDurableJob(input: { kind: string; payload?: Record<string, unknown>; delayMs?: number; maxAttempts?: number; id?: string }): Promise<string> {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  const kind = String(input.kind || '').trim().slice(0, 120);
  if (!kind) throw new Error('durable job kind is required');
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO durable_jobs (id, kind, payload_json, status, attempts, max_attempts, available_at) VALUES (?, ?, ?, 'queued', 0, ?, ?)`, [id, kind, json(input.payload), Math.max(1, Math.min(50, Math.floor(Number(input.maxAttempts) || 5))), isoAfterMs(Number(input.delayMs) || 0)]);
  saveDb();
  return id;
}

export async function claimDurableJob(workerId: string, kinds?: string[], leaseMs = 120_000): Promise<DurableJob | null> {
  await ensureSchema();
  const db = await getDb();
  const now = new Date().toISOString();
  const safeLease = Math.max(5_000, Math.min(15 * 60_000, Math.floor(Number(leaseMs) || 120_000)));
  const kindList = (kinds || []).map(String).map(value => value.trim()).filter(Boolean).slice(0, 20);
  const whereKinds = kindList.length ? ` AND kind IN (${kindList.map(() => '?').join(',')})` : '';
  const params: unknown[] = [now, now, ...kindList];
  const row = db.exec(`SELECT id FROM durable_jobs WHERE status='queued' AND available_at <= ? AND (locked_until IS NULL OR locked_until <= ?)${whereKinds} ORDER BY available_at ASC, created_at ASC LIMIT 1`, params)[0]?.values?.[0]?.[0];
  if (!row) return null;
  const id = String(row);
  db.run(`UPDATE durable_jobs SET status='running', attempts=attempts+1, locked_until=?, locked_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='queued' AND (locked_until IS NULL OR locked_until <= ?)`, [isoAfterMs(safeLease), String(workerId).slice(0, 160), id, now]);
  if (db.getRowsModified() !== 1) return null;
  saveDb();
  const record = db.exec('SELECT * FROM durable_jobs WHERE id=? LIMIT 1', [id])[0]?.values?.[0];
  if (!record) return null;
  return mapRow(record, db.exec('PRAGMA table_info(durable_jobs)')[0]?.values || []);
}

function mapRow(row: unknown[], info: unknown[][]): DurableJob {
  const names = new Map<string, number>();
  for (let index = 0; index < info.length; index += 1) names.set(String(info[index][1]), index);
  const get = (name: string) => row[names.get(name) ?? -1];
  return {
    id: String(get('id')),
    kind: String(get('kind')),
    payload: parseJson(get('payload_json')),
    status: String(get('status')) as DurableJobStatus,
    attempts: Number(get('attempts') || 0),
    maxAttempts: Number(get('max_attempts') || 5),
    availableAt: String(get('available_at')),
    lockedUntil: get('locked_until') ? String(get('locked_until')) : undefined,
    lockedBy: get('locked_by') ? String(get('locked_by')) : undefined,
    lastError: get('last_error') ? String(get('last_error')) : undefined,
    createdAt: String(get('created_at')),
    updatedAt: String(get('updated_at')),
    completedAt: get('completed_at') ? String(get('completed_at')) : undefined,
  };
}

async function mutateLocked(jobId: string, workerId: string, sql: string, params: unknown[]): Promise<boolean> {
  await ensureSchema();
  const db = await getDb();
  db.run(sql, [...params, jobId, workerId]);
  const updated = db.getRowsModified() === 1;
  if (updated) saveDb();
  return updated;
}

export async function completeDurableJob(jobId: string, workerId: string): Promise<boolean> {
  return mutateLocked(jobId, workerId, `UPDATE durable_jobs SET status='completed', locked_until=NULL, locked_by=NULL, completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND locked_by=? AND status='running'`, []);
}

export async function failDurableJob(job: Pick<DurableJob, 'id' | 'attempts' | 'maxAttempts'>, workerId: string, error: unknown, retryDelayMs?: number): Promise<DurableJobStatus> {
  await ensureSchema();
  const db = await getDb();
  const message = String(error instanceof Error ? error.message : error).slice(0, 1000) || 'job failed';
  const terminal = job.attempts >= job.maxAttempts;
  const status: DurableJobStatus = terminal ? 'dead_letter' : 'queued';
  db.run(`UPDATE durable_jobs SET status=?, available_at=?, locked_until=NULL, locked_by=NULL, last_error=?, updated_at=CURRENT_TIMESTAMP, completed_at=CASE WHEN ?='dead_letter' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END WHERE id=? AND locked_by=? AND status='running'`, [status, terminal ? new Date().toISOString() : isoAfterMs(retryDelayMs ?? Math.min(60 * 60_000, 5_000 * (2 ** Math.min(Math.max(job.attempts - 1, 0), 7)))), message, status, job.id, workerId]);
  if (db.getRowsModified() !== 1) return 'failed';
  saveDb();
  return status;
}

export async function cancelDurableJob(jobId: string): Promise<boolean> {
  await ensureSchema();
  const db = await getDb();
  db.run(`UPDATE durable_jobs SET status='cancelled', locked_until=NULL, locked_by=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued','running')`, [jobId]);
  const updated = db.getRowsModified() === 1;
  if (updated) saveDb();
  return updated;
}

export async function releaseExpiredDurableJobLeases(): Promise<number> {
  await ensureSchema();
  const db = await getDb();
  db.run(`UPDATE durable_jobs SET status='queued', locked_until=NULL, locked_by=NULL, available_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE status='running' AND locked_until IS NOT NULL AND julianday(locked_until) <= julianday('now')`);
  const updated = db.getRowsModified();
  if (updated) saveDb();
  return updated;
}

export async function getDurableJobStats(): Promise<Record<DurableJobStatus, number>> {
  await ensureSchema();
  const db = await getDb();
  const stats: Record<DurableJobStatus, number> = { queued: 0, running: 0, completed: 0, failed: 0, dead_letter: 0, cancelled: 0 };
  for (const row of db.exec('SELECT status, COUNT(*) FROM durable_jobs GROUP BY status')[0]?.values || []) {
    const status = String(row[0] || 'queued') as DurableJobStatus;
    if (status in stats) stats[status] = Number(row[1] || 0);
  }
  return stats;
}

export async function getDurableJob(jobId: string): Promise<DurableJob | null> {
  await ensureSchema();
  const db = await getDb();
  const row = db.exec('SELECT * FROM durable_jobs WHERE id=? LIMIT 1')[0]?.values?.[0];
  const info = db.exec('PRAGMA table_info(durable_jobs)')[0]?.values || [];
  return row ? mapRow(row, info) : null;
}
