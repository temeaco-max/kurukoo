import { getDb, saveDb } from '../database.js';
import { createReminder, type Reminder } from './reminderService.js';

export interface BinDaySchedule {
  postcode?: string;
  address?: string;
  council?: string;
  wasteType?: string;
  nextCollectionAt: string;
  recurrence?: string;
  sourceUrl?: string;
  sourceName: string;
  sourceCheckedAt: string;
  sourceExpiresAt?: string;
  evidence: 'authoritative_source';
}

export interface BinDayResolutionInput {
  postcode?: string;
  address?: string;
  council?: string;
  wasteType?: string;
}

function clean(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, 200) : undefined;
}

async function ensureBinDaySchema() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS authoritative_bin_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postcode TEXT,
    address TEXT,
    council TEXT,
    waste_type TEXT,
    next_collection_at TEXT NOT NULL,
    recurrence TEXT,
    source_url TEXT,
    source_name TEXT NOT NULL,
    source_checked_at TEXT NOT NULL,
    source_expires_at TEXT,
    evidence TEXT NOT NULL DEFAULT 'authoritative_source'
  );`);
  db.run('CREATE INDEX IF NOT EXISTS idx_bin_schedule_lookup ON authoritative_bin_schedules(postcode,council,waste_type,source_checked_at DESC)');
  return db;
}

/** Resolve a schedule only from a provenance-bearing authoritative source. */
export async function resolveBinDaySchedule(input: BinDayResolutionInput): Promise<BinDaySchedule | null> {
  const postcode = clean(input.postcode)?.toLowerCase();
  const address = clean(input.address)?.toLowerCase();
  const council = clean(input.council)?.toLowerCase();
  const wasteType = clean(input.wasteType)?.toLowerCase();
  if (!postcode && !address && !council) return null;

  const db = await ensureBinDaySchema();
  const clauses: string[] = [];
  const params: string[] = [];
  if (postcode) { clauses.push('lower(COALESCE(postcode,\'\'))=?'); params.push(postcode); }
  if (address) { clauses.push('lower(COALESCE(address,\'\'))=?'); params.push(address); }
  if (council) { clauses.push('lower(COALESCE(council,\'\'))=?'); params.push(council); }
  if (wasteType) { clauses.push('lower(COALESCE(waste_type,\'\'))=?'); params.push(wasteType); }
  const stmt = db.prepare(`SELECT * FROM authoritative_bin_schedules WHERE ${clauses.join(' AND ')} ORDER BY source_checked_at DESC LIMIT 1`);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  if (!row) return null;
  const nextCollectionAt = String(row.next_collection_at || '');
  if (!nextCollectionAt || Number.isNaN(Date.parse(nextCollectionAt))) return null;
  const expiresAt = row.source_expires_at ? String(row.source_expires_at) : undefined;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return null;
  return {
    postcode: row.postcode ? String(row.postcode) : undefined,
    address: row.address ? String(row.address) : undefined,
    council: row.council ? String(row.council) : undefined,
    wasteType: row.waste_type ? String(row.waste_type) : undefined,
    nextCollectionAt,
    recurrence: row.recurrence ? String(row.recurrence) : undefined,
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    sourceName: String(row.source_name || 'Authoritative council source'),
    sourceCheckedAt: String(row.source_checked_at),
    sourceExpiresAt: expiresAt,
    evidence: 'authoritative_source',
  };
}

export async function upsertAuthoritativeBinDaySchedule(schedule: Omit<BinDaySchedule, 'evidence'>): Promise<void> {
  if (!schedule.nextCollectionAt || Number.isNaN(Date.parse(schedule.nextCollectionAt))) throw new Error('A valid next collection date is required');
  const db = await ensureBinDaySchema();
  db.run(`INSERT INTO authoritative_bin_schedules
    (postcode,address,council,waste_type,next_collection_at,recurrence,source_url,source_name,source_checked_at,source_expires_at,evidence)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
      clean(schedule.postcode), clean(schedule.address), clean(schedule.council), clean(schedule.wasteType),
      schedule.nextCollectionAt, clean(schedule.recurrence), clean(schedule.sourceUrl), clean(schedule.sourceName) || 'Authoritative council source',
      schedule.sourceCheckedAt || new Date().toISOString(), clean(schedule.sourceExpiresAt), 'authoritative_source',
    ]);
  saveDb();
}

/** Create the user-facing reminder only after schedule evidence exists. */
export async function createBinDayReminder(phone: string, schedule: BinDaySchedule, leadMinutes = 120): Promise<Reminder> {
  if (schedule.evidence !== 'authoritative_source') throw new Error('A verified authoritative schedule is required before creating a bin reminder');
  const collection = new Date(schedule.nextCollectionAt);
  if (Number.isNaN(collection.getTime())) throw new Error('Invalid authoritative collection date');
  const safeLeadMinutes = Math.max(0, Math.min(7 * 24 * 60, Math.floor(leadMinutes)));
  const due = new Date(collection.getTime() - safeLeadMinutes * 60_000);
  if (due.getTime() <= Date.now()) throw new Error('The authoritative collection date is too soon for the requested reminder lead time');
  return createReminder(phone, {
    title: `${schedule.wasteType ? `${schedule.wasteType} ` : ''}bin collection`,
    note: `Source: ${schedule.sourceName}${schedule.sourceUrl ? ` — ${schedule.sourceUrl}` : ''}`,
    dueAt: due.toISOString(),
    recurrence: schedule.recurrence || null,
  });
}
