/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import crypto from 'node:crypto';
import { sendFcmPush } from './pushNotifications.js';
import { persistCoordinatorEvent } from './coordinatorStore.js';
import { getCanonicalPersistenceMode } from './canonicalPersistence.js';
import { getCanonicalStore } from './canonicalStore.js';

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
  source_conversation_id: string | null;
  resume_context_id: string | null;
}

async function ensureReminderSchema() {
  const store = await getCanonicalStore();
  if (getCanonicalPersistenceMode() === 'postgres') {
    await store.run(`CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      due_at TEXT NOT NULL,
      recurrence TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMPTZ,
      source_conversation_id TEXT,
      resume_context_id TEXT
    )`);
    await store.run('CREATE INDEX IF NOT EXISTS idx_reminders_phone_due ON reminders(phone, due_at, status)');
    await store.run('CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at, status)');
  } else {
    const db = await import('../database.js').then(module => module.getDb());
    db.run(`CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      due_at TEXT NOT NULL,
      recurrence TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT,
      source_conversation_id TEXT,
      resume_context_id TEXT
    );`);
    const cols = db.exec('PRAGMA table_info(reminders)')[0]?.values || [];
    const names = new Set(cols.map((row: any[]) => String(row[1])));
    if (!names.has('source_conversation_id')) db.run('ALTER TABLE reminders ADD COLUMN source_conversation_id TEXT');
    if (!names.has('resume_context_id')) db.run('ALTER TABLE reminders ADD COLUMN resume_context_id TEXT');
    db.run('CREATE INDEX IF NOT EXISTS idx_reminders_phone_due ON reminders(phone, due_at, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at, status)');
  }
}

async function emitReminderEvent(reminder: Reminder, status: ReminderStatus, payload: Record<string, unknown> = {}): Promise<void> {
  await persistCoordinatorEvent({
    id: `reminder:${reminder.id}:state:${status}:${Date.now()}`,
    type: 'reminder.state_changed',
    occurredAt: new Date().toISOString(),
    producer: 'reminderService',
    correlationId: `reminder:${reminder.id}`,
    ownerPhone: reminder.phone.startsWith('anon_') ? undefined : reminder.phone,
    payload: { reminderId: reminder.id, status, dueAt: reminder.due_at, recurrence: reminder.recurrence, sourceConversationId: reminder.source_conversation_id, resumeContextId: reminder.resume_context_id, titleLength: reminder.title.length, notePresent: Boolean(reminder.note), ...payload },
    sensitivity: reminder.phone.startsWith('anon_') ? 'public' : 'personal',
    provenance: { source: 'canonical_service', sourceId: reminder.id, evidenceLevel: 'persisted_state' },
    policy: { autonomousAllowed: false, confirmationRequired: 'none' },
    schemaVersion: 1,
  });
}

function rowToReminder(row: any): Reminder {
  return {
    id: String(row.id), phone: String(row.phone), title: String(row.title), note: String(row.note || ''), due_at: String(row.due_at), recurrence: row.recurrence ? String(row.recurrence) : null, status: String(row.status) as ReminderStatus, created_at: String(row.created_at), sent_at: row.sent_at ? String(row.sent_at) : null,
    source_conversation_id: row.source_conversation_id ? String(row.source_conversation_id) : null,
    resume_context_id: row.resume_context_id ? String(row.resume_context_id) : null,
  };
}

export async function createReminder(phone: string, input: { title: string; note?: string; dueAt: string; recurrence?: string | null; sourceConversationId?: string | null; resumeContextId?: string | null }): Promise<Reminder> {
  await ensureReminderSchema();
  const due = new Date(input.dueAt); if (Number.isNaN(due.getTime())) throw new Error('Invalid reminder time'); if (due.getTime() <= Date.now()) throw new Error('Reminder time must be in the future'); if (!input.title.trim()) throw new Error('Reminder title is required');
  const id = crypto.randomUUID();
  const store = await getCanonicalStore();
  const phoneValue = phone;
  await store.run(`INSERT INTO reminders (id, phone, title, note, due_at, recurrence, status, source_conversation_id, resume_context_id) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`, [id, phoneValue, input.title.trim(), String(input.note || '').trim(), due.toISOString(), input.recurrence || null, input.sourceConversationId || null, input.resumeContextId || null]);
  try {
    const profile = await store.one<any>('SELECT behavior_patterns FROM memory_profiles WHERE phone = ?', [phoneValue]);
    if (profile) {
      let patterns: any = {};
      try { patterns = JSON.parse(String(profile.behavior_patterns || '{}')); } catch {}
      patterns.last_reminder_created = new Date().toISOString();
      patterns.reminder_count = (Number(patterns.reminder_count) || 0) + 1;
      await store.run('UPDATE memory_profiles SET behavior_patterns = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?', [JSON.stringify(patterns), phoneValue]);
    }
  } catch {}
  const row = await store.one<any>('SELECT * FROM reminders WHERE id = ?', [id]);
  if (!row) throw new Error('Reminder could not be created');
  const reminder = rowToReminder(row); await emitReminderEvent(reminder, reminder.status, { action: 'created' }); return reminder;
}

export async function listReminders(phone: string, includeCompleted = false): Promise<Reminder[]> {
  await ensureReminderSchema(); const store = await getCanonicalStore();
  const sql = includeCompleted ? 'SELECT * FROM reminders WHERE phone = ? ORDER BY due_at ASC' : "SELECT * FROM reminders WHERE phone = ? AND status NOT IN ('completed','cancelled') ORDER BY due_at ASC";
  return (await store.all<any>(sql, [phone])).map(rowToReminder);
}

/** Read-only owner-scoped reminder lookup for canonical conversation continuation. */
export async function getReminderForPhone(phone: string, id: string): Promise<Reminder | null> {
  await ensureReminderSchema(); const store = await getCanonicalStore();
  const row = await store.one<any>('SELECT * FROM reminders WHERE id = ? AND phone = ? LIMIT 1', [id, phone]);
  return row ? rowToReminder(row) : null;
}

export async function cancelReminder(phone: string, id: string): Promise<boolean> {
  await ensureReminderSchema(); const store = await getCanonicalStore();
  await store.run("UPDATE reminders SET status = 'cancelled' WHERE id = ? AND phone = ? AND status = 'scheduled'", [id, phone]);
  const row = await store.one<any>("SELECT * FROM reminders WHERE id = ? AND phone = ? AND status = 'cancelled'", [id, phone]);
  if (!row) return false;
  const reminder = rowToReminder(row); await emitReminderEvent(reminder, 'cancelled', { action: 'cancelled' }); return true;
}

function nextOccurrence(dueAt: string, recurrence: string): string | null { const d = new Date(dueAt); if (Number.isNaN(d.getTime())) return null; if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1); else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7); else if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1); else return null; return d.toISOString(); }

export async function processDueReminders(limit = 100): Promise<{ checked: number; delivered: number; queued: number; failed: number }> {
  await ensureReminderSchema(); const store = await getCanonicalStore(); const now = new Date().toISOString();
  const rows = await store.all<any>(`SELECT * FROM reminders WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at ASC LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}`, [now]);
  let delivered = 0, queued = 0, failed = 0;
  for (const values of rows) {
    const reminder = rowToReminder(values); const body = reminder.note ? `${reminder.title} — ${reminder.note}` : reminder.title; let pushSent = false;
    try {
      // The due reminder is a Work item. The notification must return the user to
      // that exact reminder with its conversation context preserved, not to a
      // generic Chat page, so the click destination is canonical and specific.
      pushSent = await sendFcmPush(reminder.phone, 'Kurukoo reminder', body, '/reminders', {
        canonicalAction: 'reminder.due.open',
        objectType: 'reminder',
        objectId: reminder.id,
        conversationId: reminder.source_conversation_id || undefined,
        contextId: reminder.resume_context_id || undefined,
        ownerScope: reminder.phone,
        surface: 'reminders',
      });
    } catch (error) { console.warn('[Reminder] push failed:', error); }
    const reminderCard = { type: 'reminder', reminder_id: reminder.id, interruptive: true, priority: 'high', triggerState: 'due', sourceConversationId: reminder.source_conversation_id, resumeContextId: reminder.resume_context_id, preservePriorConversation: true, actions: [{ id: 'open', label: 'Open reminder' }, { id: 'dismiss', label: 'Dismiss' }, { id: 'snooze', label: 'Snooze' }] };
    try { const db = await import('../database.js').then(module => module.getDb()); db.run(`INSERT INTO messages (phone, sender, content, channel, card_data, status) VALUES (?, 'kurukoo', ?, 'pwa', ?, ?)`, [reminder.phone, `Reminder: ${body}`, JSON.stringify(reminderCard), pushSent ? 'sent' : 'queued']); } catch {}
    if (pushSent) delivered += 1; else queued += 1;
    if (reminder.recurrence) { const next = nextOccurrence(reminder.due_at, reminder.recurrence); if (next) { await store.run("UPDATE reminders SET due_at = ?, status = 'scheduled', sent_at = ? WHERE id = ?", [next, new Date().toISOString(), reminder.id]); reminder.due_at = next; reminder.status = 'scheduled'; reminder.sent_at = new Date().toISOString(); } else { await store.run("UPDATE reminders SET status = 'sent', sent_at = ? WHERE id = ?", [new Date().toISOString(), reminder.id]); reminder.status = 'sent'; reminder.sent_at = new Date().toISOString(); } } else { await store.run("UPDATE reminders SET status = 'sent', sent_at = ? WHERE id = ?", [new Date().toISOString(), reminder.id]); reminder.status = 'sent'; reminder.sent_at = new Date().toISOString(); }
    await emitReminderEvent(reminder, reminder.status, { action: 'due_processed', internalMessageStatus: pushSent ? 'sent' : 'queued', transportEvidence: pushSent ? 'adapter_reported_success' : 'not_configured_or_unsuccessful', interruptive: true });
  }
  return { checked: rows.length, delivered, queued, failed };
}
