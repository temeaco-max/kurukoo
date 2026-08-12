import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { sendFcmPush } from './pushNotifications.js';

export type ReminderStatus = 'scheduled' | 'sent' | 'completed' | 'cancelled' | 'failed';

export interface Reminder {
  id: string;
  phone: string;
  title: string;
  note: string;
  due_at: string;
  recurrence: string | null;
  status: ReminderStatus;
  created_at: string;
  sent_at: string | null;
}

async function ensureReminderSchema() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    due_at TEXT NOT NULL,
    recurrence TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
  );`);
  db.run('CREATE INDEX IF NOT EXISTS idx_reminders_phone_due ON reminders(phone, due_at, status)');
  db.run("CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at, status)");
}

function rowToReminder(row: any): Reminder {
  return {
    id: String(row.id),
    phone: String(row.phone),
    title: String(row.title),
    note: String(row.note || ''),
    due_at: String(row.due_at),
    recurrence: row.recurrence ? String(row.recurrence) : null,
    status: String(row.status) as ReminderStatus,
    created_at: String(row.created_at),
    sent_at: row.sent_at ? String(row.sent_at) : null,
  };
}

export async function createReminder(phone: string, input: {
  title: string;
  note?: string;
  dueAt: string;
  recurrence?: string | null;
}): Promise<Reminder> {
  await ensureReminderSchema();
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) throw new Error('Invalid reminder time');
  if (due.getTime() <= Date.now()) throw new Error('Reminder time must be in the future');
  if (!input.title.trim()) throw new Error('Reminder title is required');

  const db = await getDb();
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO reminders (id, phone, title, note, due_at, recurrence, status)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
    [id, phone, input.title.trim(), String(input.note || '').trim(), due.toISOString(), input.recurrence || null]
  );
  try {
    const pStmt = db.prepare(`SELECT behavior_patterns FROM memory_profiles WHERE phone = ?`);
    pStmt.bind([phone]);
    if (pStmt.step()) {
      const res = pStmt.getAsObject();
      let patterns: any = {};
      try { patterns = JSON.parse(String(res.behavior_patterns || '{}')); } catch {}
      patterns.last_reminder_created = new Date().toISOString();
      patterns.reminder_count = (Number(patterns.reminder_count) || 0) + 1;
      db.run(`UPDATE memory_profiles SET behavior_patterns = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`, [JSON.stringify(patterns), phone]);
    }
    pStmt.free();
  } catch {}
  saveDb();

  const stmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) throw new Error('Reminder could not be created');
  return rowToReminder(row);
}

export async function listReminders(phone: string, includeCompleted = false): Promise<Reminder[]> {
  await ensureReminderSchema();
  const db = await getDb();
  const sql = includeCompleted
    ? 'SELECT * FROM reminders WHERE phone = ? ORDER BY due_at ASC'
    : "SELECT * FROM reminders WHERE phone = ? AND status NOT IN ('completed','cancelled') ORDER BY due_at ASC";
  const result = db.exec(sql, [phone]);
  return (result[0]?.values || []).map((values: any[]) => rowToReminder(Object.fromEntries((result[0].columns || []).map((c: string, i: number) => [c, values[i]]))));
}

export async function cancelReminder(phone: string, id: string): Promise<boolean> {
  await ensureReminderSchema();
  const db = await getDb();
  db.run("UPDATE reminders SET status = 'cancelled' WHERE id = ? AND phone = ? AND status = 'scheduled'", [id, phone]);
  saveDb();
  const check = db.exec('SELECT id FROM reminders WHERE id = ? AND phone = ? AND status = \'cancelled\'', [id, phone]);
  return Boolean(check[0]?.values?.length);
}

function nextOccurrence(dueAt: string, recurrence: string): string | null {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else return null;
  return d.toISOString();
}

/**
 * Delivers due reminders through the shared conversation and, when configured,
 * the shared push layer. A push adapter returning false never counts as delivery.
 */
export async function processDueReminders(limit = 100): Promise<{ checked: number; delivered: number; queued: number; failed: number }> {
  await ensureReminderSchema();
  const db = await getDb();
  const now = new Date().toISOString();
  const result = db.exec(
    `SELECT * FROM reminders WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at ASC LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}`,
    [now]
  );
  const rows = result[0]?.values || [];
  const columns = result[0]?.columns || [];
  let delivered = 0;
  let queued = 0;
  let failed = 0;

  for (const values of rows) {
    const reminder = rowToReminder(Object.fromEntries(columns.map((c: string, i: number) => [c, values[i]])));
    const body = reminder.note ? `${reminder.title} — ${reminder.note}` : reminder.title;
    let pushSent = false;
    try {
      pushSent = await sendFcmPush(reminder.phone, 'Kurukoo reminder', body, '/chat/');
    } catch (error) {
      console.warn('[Reminder] push failed:', error);
    }

    // The conversation is the source of truth even when a transport is unavailable.
    db.run(
      `INSERT INTO messages (phone, sender, content, channel, card_data, status)
       VALUES (?, 'kurukoo', ?, 'pwa', ?, ?)`,
      [reminder.phone, `Reminder: ${body}`, JSON.stringify({ type: 'reminder', reminder_id: reminder.id }), pushSent ? 'sent' : 'queued']
    );

    if (pushSent) delivered += 1;
    else queued += 1;

    if (reminder.recurrence) {
      const next = nextOccurrence(reminder.due_at, reminder.recurrence);
      if (next) {
        db.run('UPDATE reminders SET due_at = ?, status = \'scheduled\', sent_at = ? WHERE id = ?', [next, new Date().toISOString(), reminder.id]);
      } else {
        db.run('UPDATE reminders SET status = \'sent\', sent_at = ? WHERE id = ?', [new Date().toISOString(), reminder.id]);
      }
    } else {
      db.run('UPDATE reminders SET status = \'sent\', sent_at = ? WHERE id = ?', [new Date().toISOString(), reminder.id]);
    }
  }

  if (rows.length) saveDb();
  return { checked: rows.length, delivered, queued, failed };
}
