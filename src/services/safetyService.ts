import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export interface SafetyContact {
  id: string;
  owner_phone: string;
  name: string;
  phone: string;
  relationship: string | null;
  status: 'active' | 'pending' | 'revoked';
  created_at: string;
}

export interface CheckIn {
  id: string;
  owner_phone: string;
  contact_id: string;
  check_in_at: string;
  expires_at: string;
  status: 'active' | 'completed' | 'escalation_pending' | 'cancelled';
  route_note: string | null;
}

async function ensureSafetySchema() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS user_safety_contacts (
    id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_phone, phone)
  );
  CREATE TABLE IF NOT EXISTS safety_checkins (
    id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    check_in_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    route_note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_safety_contacts_owner ON user_safety_contacts(owner_phone, status);
  CREATE INDEX IF NOT EXISTS idx_safety_checkins_due ON safety_checkins(expires_at, status);
  `);
}

export async function addSafetyContact(ownerPhone: string, input: { name: string; phone: string; relationship?: string; activate?: boolean }): Promise<SafetyContact> {
  await ensureSafetySchema();
  if (!input.name.trim() || !input.phone.trim()) throw new Error('Contact name and phone are required');
  const db = await getDb();
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO user_safety_contacts (id, owner_phone, name, phone, relationship, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_phone, phone) DO UPDATE SET name=excluded.name, relationship=excluded.relationship, status=excluded.status`,
    [id, ownerPhone, input.name.trim(), input.phone.trim(), input.relationship?.trim() || null, input.activate ? 'active' : 'pending']
  );
  saveDb();
  const result = db.exec('SELECT * FROM user_safety_contacts WHERE owner_phone = ? AND phone = ?', [ownerPhone, input.phone.trim()]);
  const row = result[0]?.values?.[0];
  const cols = result[0]?.columns || [];
  if (!row) throw new Error('Unable to save safety contact');
  return Object.fromEntries(cols.map((c: string, i: number) => [c, row[i]])) as SafetyContact;
}

export async function listSafetyContacts(ownerPhone: string): Promise<SafetyContact[]> {
  await ensureSafetySchema();
  const db = await getDb();
  const result = db.exec("SELECT * FROM user_safety_contacts WHERE owner_phone = ? AND status != 'revoked' ORDER BY created_at ASC", [ownerPhone]);
  return (result[0]?.values || []).map((row: any[]) => Object.fromEntries((result[0].columns || []).map((c: string, i: number) => [c, row[i]])) as SafetyContact);
}

export async function revokeSafetyContact(ownerPhone: string, contactId: string): Promise<boolean> {
  await ensureSafetySchema();
  const db = await getDb();
  db.run("UPDATE user_safety_contacts SET status='revoked' WHERE id=? AND owner_phone=?", [contactId, ownerPhone]);
  saveDb();
  const result = db.exec("SELECT id FROM user_safety_contacts WHERE id=? AND owner_phone=? AND status='revoked'", [contactId, ownerPhone]);
  return Boolean(result[0]?.values?.length);
}

export async function activateSafetyContact(ownerPhone: string, contactId: string, consentConfirmed: boolean): Promise<SafetyContact | null> {
  await ensureSafetySchema();
  if (!consentConfirmed) throw new Error('Explicit owner consent is required to activate a safety contact');
  const db = await getDb();
  db.run("UPDATE user_safety_contacts SET status='active' WHERE id=? AND owner_phone=? AND status='pending'", [contactId, ownerPhone]);
  saveDb();
  const result = db.exec("SELECT * FROM user_safety_contacts WHERE id=? AND owner_phone=? AND status='active'", [contactId, ownerPhone]);
  const row = result[0]?.values?.[0];
  if (!row) return null;
  return Object.fromEntries((result[0].columns || []).map((c: string, i: number) => [c, row[i]])) as SafetyContact;
}

export async function startCheckIn(ownerPhone: string, input: { contactId: string; durationMinutes: number; routeNote?: string }): Promise<CheckIn> {
  await ensureSafetySchema();
  const duration = Math.max(5, Math.min(24 * 60, Math.floor(Number(input.durationMinutes))));
  const db = await getDb();
  const contact = db.exec("SELECT id FROM user_safety_contacts WHERE id=? AND owner_phone=? AND status='active'", [input.contactId, ownerPhone]);
  if (!contact[0]?.values?.length) throw new Error('Active safety contact not found');
  const id = crypto.randomUUID();
  const start = new Date();
  const expires = new Date(start.getTime() + duration * 60_000);
  db.run(
    `INSERT INTO safety_checkins (id, owner_phone, contact_id, check_in_at, expires_at, status, route_note)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [id, ownerPhone, input.contactId, start.toISOString(), expires.toISOString(), input.routeNote?.trim() || null]
  );
  saveDb();
  return { id, owner_phone: ownerPhone, contact_id: input.contactId, check_in_at: start.toISOString(), expires_at: expires.toISOString(), status: 'active', route_note: input.routeNote?.trim() || null };
}

export async function completeCheckIn(ownerPhone: string, id: string): Promise<boolean> {
  await ensureSafetySchema();
  const db = await getDb();
  db.run("UPDATE safety_checkins SET status='completed' WHERE id=? AND owner_phone=? AND status='active'", [id, ownerPhone]);
  saveDb();
  const result = db.exec("SELECT id FROM safety_checkins WHERE id=? AND owner_phone=? AND status='completed'", [id, ownerPhone]);
  return Boolean(result[0]?.values?.length);
}

export async function listCheckIns(ownerPhone: string): Promise<CheckIn[]> {
  await ensureSafetySchema();
  const db = await getDb();
  const result = db.exec("SELECT * FROM safety_checkins WHERE owner_phone = ? ORDER BY check_in_at DESC", [ownerPhone]);
  return (result[0]?.values || []).map((row: any[]) => Object.fromEntries((result[0].columns || []).map((c: string, i: number) => [c, row[i]])) as CheckIn);
}

export async function handleSafetyContactInput(phone: string, text: string): Promise<{ reply: string, cardData?: any, success?: boolean }> {
  const db = await getDb();
  const stmt = db.prepare('SELECT preferences FROM memory_profiles WHERE phone = ?');
  stmt.bind([phone]);
  let prefs: any = {};
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    prefs = obj.preferences ? JSON.parse(String(obj.preferences)) : {};
  }
  stmt.free();

  const state = prefs.safety_capture_state || 'none';
  const data = prefs.safety_capture_data || {};

  if (state === 'awaiting_phone') {
    const contactPhone = text.trim().replace(/\D/g, '');
    if (contactPhone.length < 10) return { reply: "That doesn't look like a valid phone number. Please enter the full phone number for your contact." };
    const fullPhone = contactPhone.startsWith('0') ? '+234' + contactPhone.slice(1) : (contactPhone.startsWith('+') ? contactPhone : '+234' + contactPhone);
    try {
      await addSafetyContact(phone, { name: data.name, phone: fullPhone });
      delete prefs.safety_capture_state;
      delete prefs.safety_capture_data;
      db.run('UPDATE memory_profiles SET preferences = ? WHERE phone = ?', [JSON.stringify(prefs), phone]);
      saveDb();
      return {
        reply: `Saved. **${data.name}** (${fullPhone}) has been added as a pending safety contact. They need to confirm consent before you can start check-ins with them.`,
        success: true,
        cardData: { type: 'safety_contact_added', name: data.name }
      };
    } catch (e: any) {
      return { reply: `I couldn't save that contact: ${e.message}. Please try again.` };
    }
  }

  return { reply: "I'm not sure how to help with that safety step." };
}

export async function setSafetyCaptureState(phone: string, state: string, data: any = {}): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare('SELECT preferences FROM memory_profiles WHERE phone = ?');
  stmt.bind([phone]);
  let prefs: any = {};
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    prefs = obj.preferences ? JSON.parse(String(obj.preferences)) : {};
  }
  stmt.free();
  prefs.safety_capture_state = state;
  prefs.safety_capture_data = data;
  db.run('UPDATE memory_profiles SET preferences = ? WHERE phone = ?', [JSON.stringify(prefs), phone]);
  saveDb();
}

/**
 * Escalation is intentionally represented as pending until an authorised
 * notification transport is configured. This prevents the UI from claiming
 * that an emergency contact was reached when no delivery evidence exists.
 */
export async function processExpiredCheckIns(): Promise<number> {
  await ensureSafetySchema();
  const db = await getDb();
  const now = new Date().toISOString();
  const result = db.exec("SELECT id FROM safety_checkins WHERE status='active' AND expires_at <= ?", [now]);
  const rows = result[0]?.values || [];
  for (const row of rows) {
    db.run("UPDATE safety_checkins SET status='escalation_pending' WHERE id=?", [row[0]]);
  }
  if (rows.length) saveDb();
  return rows.length;
}
