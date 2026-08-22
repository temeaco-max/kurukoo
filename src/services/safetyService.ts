import crypto from 'node:crypto';
import { getCanonicalStore } from './canonicalStore.js';
import { persistCoordinatorEvent } from './coordinatorStore.js';

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
  const store = await getCanonicalStore();
  if (process.env.KURUKOO_DATABASE_MODE === 'postgres') {
    await store.run(`CREATE TABLE IF NOT EXISTS user_safety_contacts (
      id TEXT PRIMARY KEY,
      owner_phone TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      relationship TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_phone, phone)
    )`);
    await store.run(`CREATE TABLE IF NOT EXISTS safety_checkins (
      id TEXT PRIMARY KEY,
      owner_phone TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      check_in_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      route_note TEXT
    )`);
  } else {
    await store.run(`CREATE TABLE IF NOT EXISTS user_safety_contacts (
      id TEXT PRIMARY KEY,
      owner_phone TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      relationship TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_phone, phone)
    )`);
    await store.run(`CREATE TABLE IF NOT EXISTS safety_checkins (
      id TEXT PRIMARY KEY,
      owner_phone TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      check_in_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      route_note TEXT
    )`);
  }
  await store.run('CREATE INDEX IF NOT EXISTS idx_safety_contacts_owner ON user_safety_contacts(owner_phone, status)');
  await store.run('CREATE INDEX IF NOT EXISTS idx_safety_checkins_due ON safety_checkins(expires_at, status)');
  return store;
}

async function emitCheckInEvent(checkIn: CheckIn, status: CheckIn['status'], payload: Record<string, unknown> = {}): Promise<void> {
  await persistCoordinatorEvent({
    id: `safety-checkin:${checkIn.id}:state:${status}:${Date.now()}`,
    type: 'safety.checkin.state_changed',
    occurredAt: new Date().toISOString(),
    producer: 'safetyService',
    correlationId: `safety_checkin:${checkIn.id}`,
    ownerPhone: checkIn.owner_phone.startsWith('anon_') ? undefined : checkIn.owner_phone,
    payload: { checkInId: checkIn.id, status, contactId: checkIn.contact_id, expiresAt: checkIn.expires_at, hasRouteNote: Boolean(checkIn.route_note), ...payload },
    sensitivity: checkIn.owner_phone.startsWith('anon_') ? 'public' : 'personal',
    provenance: { source: 'canonical_service', sourceId: checkIn.id, evidenceLevel: 'persisted_state' },
    policy: { autonomousAllowed: false, confirmationRequired: 'none' },
    schemaVersion: 1,
  });
}

export async function addSafetyContact(ownerPhone: string, input: { name: string; phone: string; relationship?: string; activate?: boolean }): Promise<SafetyContact> {
  const store = await ensureSafetySchema();
  if (!input.name.trim() || !input.phone.trim()) throw new Error('Contact name and phone are required');
  const id = crypto.randomUUID();
  await store.run(
    `INSERT INTO user_safety_contacts (id, owner_phone, name, phone, relationship, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_phone, phone) DO UPDATE SET name=excluded.name, relationship=excluded.relationship, status=excluded.status`,
    [id, ownerPhone, input.name.trim(), input.phone.trim(), input.relationship?.trim() || null, input.activate ? 'active' : 'pending'],
  );
  const contact = await store.one<SafetyContact>('SELECT * FROM user_safety_contacts WHERE owner_phone = ? AND phone = ?', [ownerPhone, input.phone.trim()]);
  if (!contact) throw new Error('Unable to save safety contact');
  return contact;
}

export async function listSafetyContacts(ownerPhone: string): Promise<SafetyContact[]> {
  return (await ensureSafetySchema()).all<SafetyContact>(`SELECT * FROM user_safety_contacts WHERE owner_phone = ? AND status != 'revoked' ORDER BY created_at ASC`, [ownerPhone]);
}

export async function revokeSafetyContact(ownerPhone: string, contactId: string): Promise<boolean> {
  return (await ensureSafetySchema()).run(`UPDATE user_safety_contacts SET status='revoked' WHERE id=? AND owner_phone=?`, [contactId, ownerPhone]).then(r => r.rowCount > 0);
}

export async function activateSafetyContact(ownerPhone: string, contactId: string, consentConfirmed: boolean): Promise<SafetyContact | null> {
  if (!consentConfirmed) throw new Error('Explicit owner consent is required to activate a safety contact');
  const store = await ensureSafetySchema();
  await store.run(`UPDATE user_safety_contacts SET status='active' WHERE id=? AND owner_phone=? AND status='pending'`, [contactId, ownerPhone]);
  return store.one<SafetyContact>(`SELECT * FROM user_safety_contacts WHERE id=? AND owner_phone=? AND status='active'`, [contactId, ownerPhone]);
}

export async function startCheckIn(ownerPhone: string, input: { contactId: string; durationMinutes: number; routeNote?: string }): Promise<CheckIn> {
  const store = await ensureSafetySchema();
  const duration = Math.max(5, Math.min(24 * 60, Math.floor(Number(input.durationMinutes))));
  const contact = await store.one('SELECT id FROM user_safety_contacts WHERE id=? AND owner_phone=? AND status=\'active\'', [input.contactId, ownerPhone]);
  if (!contact) throw new Error('Active safety contact not found');
  const id = crypto.randomUUID();
  const start = new Date();
  const expires = new Date(start.getTime() + duration * 60_000);
  const checkIn: CheckIn = {
    id,
    owner_phone: ownerPhone,
    contact_id: input.contactId,
    check_in_at: start.toISOString(),
    expires_at: expires.toISOString(),
    status: 'active',
    route_note: input.routeNote?.trim() || null,
  };
  await store.run(
    `INSERT INTO safety_checkins (id, owner_phone, contact_id, check_in_at, expires_at, status, route_note)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [id, ownerPhone, input.contactId, start.toISOString(), expires.toISOString(), checkIn.route_note],
  );
  await emitCheckInEvent(checkIn, 'active', { action: 'started' });
  return checkIn;
}

export async function completeCheckIn(ownerPhone: string, id: string): Promise<boolean> {
  const store = await ensureSafetySchema();
  const result = await store.run(`UPDATE safety_checkins SET status='completed' WHERE id=? AND owner_phone=? AND status='active'`, [id, ownerPhone]);
  if (result.rowCount === 0) return false;
  const checkIn = await store.one<CheckIn>('SELECT * FROM safety_checkins WHERE id=? AND owner_phone=?', [id, ownerPhone]);
  if (checkIn) await emitCheckInEvent(checkIn, 'completed', { action: 'completed' });
  return true;
}

export async function listCheckIns(ownerPhone: string): Promise<CheckIn[]> {
  return (await ensureSafetySchema()).all<CheckIn>('SELECT * FROM safety_checkins WHERE owner_phone = ? ORDER BY check_in_at DESC', [ownerPhone]);
}

export async function handleSafetyContactInput(phone: string, text: string): Promise<{ reply: string; cardData?: any; success?: boolean }> {
  const store = await getCanonicalStore();
  const row = await store.one<any>('SELECT preferences FROM memory_profiles WHERE phone = ?', [phone]);
  let preferences: any = {};
  try { preferences = row?.preferences ? JSON.parse(String(row.preferences)) : {}; } catch { preferences = {}; }
  const state = preferences.safety_capture_state || 'none';
  const data = preferences.safety_capture_data || {};
  if (state === 'awaiting_phone') {
    const contactPhone = text.trim().replace(/\D/g, '');
    if (contactPhone.length < 10) return { reply: "That doesn't look like a valid phone number. Please enter the full phone number for your contact." };
    const fullPhone = contactPhone.startsWith('0') ? `+234${contactPhone.slice(1)}` : contactPhone.startsWith('+') ? contactPhone : `+234${contactPhone}`;
    try {
      await addSafetyContact(phone, { name: data.name, phone: fullPhone });
      delete preferences.safety_capture_state;
      delete preferences.safety_capture_data;
      await store.run('UPDATE memory_profiles SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?', [JSON.stringify(preferences), phone]);
      return { reply: `Saved. **${data.name}** (${fullPhone}) has been added as a pending safety contact. They need to confirm consent before you can start check-ins with them.`, success: true, cardData: { type: 'safety_contact_added', name: data.name } };
    } catch (error: any) {
      return { reply: `I couldn't save that contact: ${error.message}. Please try again.` };
    }
  }
  return { reply: "I'm not sure how to help with that safety step." };
}

export async function setSafetyCaptureState(phone: string, state: string, data: any = {}): Promise<void> {
  const store = await getCanonicalStore();
  const row = await store.one<any>('SELECT preferences FROM memory_profiles WHERE phone = ?', [phone]);
  let preferences: any = {};
  try { preferences = row?.preferences ? JSON.parse(String(row.preferences)) : {}; } catch { preferences = {}; }
  preferences.safety_capture_state = state;
  preferences.safety_capture_data = data;
  await store.run('UPDATE memory_profiles SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?', [JSON.stringify(preferences), phone]);
}

export async function processExpiredCheckIns(): Promise<number> {
  const store = await ensureSafetySchema();
  const now = new Date().toISOString();
  const rows = await store.all<CheckIn>(`SELECT * FROM safety_checkins WHERE status='active' AND expires_at <= ?`, [now]);
  for (const row of rows) {
    await store.run(`UPDATE safety_checkins SET status='escalation_pending' WHERE id=?`, [row.id]);
    row.status = 'escalation_pending';
    await emitCheckInEvent(row, 'escalation_pending', { action: 'expired', externalEscalation: 'not_claimed' });
  }
  return rows.length;
}
