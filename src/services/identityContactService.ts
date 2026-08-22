import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export type ParticipantKind = 'human' | 'provider' | 'contributor' | 'agent';
export type ContactStatus = 'active' | 'blocked' | 'removed';
export type CommunicationAction = 'message' | 'call';

export interface PersonProfile {
  identityId: string;
  phone: string;
  displayName: string;
  avatar: { kind: 'placeholder'; initials: string; background: string; foreground: string; label: string };
  participantKind: ParticipantKind;
  roles: string[];
  capabilities: string[];
  presence: 'available' | 'offline' | 'unknown';
  contributor: boolean;
  provider: { verified: boolean; type: string; available: boolean } | null;
  relationship: { status: ContactStatus | 'self' | 'none'; safetyContact: boolean };
  communication: { message: boolean; call: boolean; callUnavailableReason?: string };
}

function tableReady(db: any) {
  db.run(`CREATE TABLE IF NOT EXISTS person_contacts (
    owner_phone TEXT NOT NULL,
    person_phone TEXT NOT NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TEXT,
    PRIMARY KEY (owner_phone, person_phone),
    CHECK (owner_phone != person_phone)
  );
  CREATE INDEX IF NOT EXISTS idx_person_contacts_owner_status ON person_contacts(owner_phone, status);
  CREATE INDEX IF NOT EXISTS idx_person_contacts_person ON person_contacts(person_phone, status);`);
}

async function ensureContactSchema() { tableReady(await getDb()); }

function stableColor(identityId: string): string {
  const digest = crypto.createHash('sha256').update(identityId).digest('hex');
  return `#${digest.slice(0, 6)}`;
}

export function placeholderAvatar(identityId: string, displayName: string) {
  const initials = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('') || '?';
  return { kind: 'placeholder' as const, initials, background: stableColor(identityId), foreground: '#FFFFFF', label: `Profile image for ${displayName || 'Kurukoo user'}` };
}

function participantKind(row: any): ParticipantKind {
  if (String(row.provider_type || '') === 'software_service') return 'agent';
  if (Number(row.is_contributor) === 1) return 'contributor';
  if (Number(row.verified_provider) === 1 || String(row.provider_type || 'human') !== 'human') return 'provider';
  return 'human';
}

function roles(row: any, kind: ParticipantKind): string[] {
  const result = ['user'];
  if (kind === 'provider') result.push('provider');
  if (kind === 'contributor') result.push('contributor');
  if (kind === 'agent') result.push('agent');
  return result;
}

function rowObject(result: any): any | null {
  const row = result[0]?.values?.[0];
  return row ? Object.fromEntries((result[0].columns || []).map((column: string, index: number) => [column, row[index]])) : null;
}

async function findProfile(phone: string) {
  const db = await getDb();
  return rowObject(db.exec('SELECT phone, name, is_available, is_contributor, verified_provider, provider_type, last_active_at FROM memory_profiles WHERE phone = ? LIMIT 1', [phone]));
}

export async function getPersonProfile(viewerPhone: string, personPhone: string, action?: CommunicationAction): Promise<PersonProfile | null> {
  await ensureContactSchema();
  const person = await findProfile(personPhone);
  if (!person) return null;
  const db = await getDb();
  const self = viewerPhone === personPhone;
  const contact = self ? null : rowObject(db.exec('SELECT status FROM person_contacts WHERE owner_phone = ? AND person_phone = ?', [viewerPhone, personPhone]));
  const visible = self || contact?.status === 'active';
  if (!visible) return null;
  let safety = false;
  if (!self) {
    try { safety = Boolean(db.exec("SELECT id FROM user_safety_contacts WHERE owner_phone = ? AND phone = ? AND status = 'active' LIMIT 1", [viewerPhone, personPhone])[0]?.values?.length); } catch { safety = false; }
  }
  const kind = participantKind(person);
  const messageAllowed = self ? false : contact?.status === 'active';
  const callAllowed = messageAllowed && process.env.KURUKOO_WEBRTC_ENABLED === 'true';
  const profile: PersonProfile = {
    identityId: person.phone,
    phone: person.phone,
    displayName: String(person.name || 'Kurukoo user'),
    avatar: placeholderAvatar(person.phone, String(person.name || 'Kurukoo user')),
    participantKind: kind,
    roles: roles(person, kind),
    capabilities: [messageAllowed ? 'message' : '', callAllowed ? 'call' : ''].filter(Boolean),
    presence: Number(person.is_available) === 1 ? 'available' : person.last_active_at ? 'offline' : 'unknown',
    contributor: Number(person.is_contributor) === 1,
    provider: kind === 'provider' || kind === 'agent' ? { verified: Number(person.verified_provider) === 1, type: String(person.provider_type || 'human'), available: Number(person.is_available) === 1 } : null,
    relationship: { status: self ? 'self' : contact?.status || 'none', safetyContact: safety },
    communication: { message: messageAllowed, call: callAllowed, ...(messageAllowed && !callAllowed ? { callUnavailableReason: 'Realtime call transport is unavailable.' } : {}) },
  };
  if (action === 'message' && !messageAllowed) throw new Error('Message is not authorized for this relationship');
  if (action === 'call' && !messageAllowed) throw new Error('Call is not authorized for this relationship');
  return profile;
}

export async function addContact(ownerPhone: string, personPhone: string, label?: string) {
  await ensureContactSchema();
  if (!ownerPhone || !personPhone || ownerPhone === personPhone) throw new Error('A distinct contact identity is required');
  if (!await findProfile(ownerPhone) || !await findProfile(personPhone)) throw new Error('Both identities must exist in Memory Profile');
  const db = await getDb();
  db.run(`INSERT INTO person_contacts (owner_phone, person_phone, label, status, removed_at) VALUES (?, ?, ?, 'active', NULL)
    ON CONFLICT(owner_phone, person_phone) DO UPDATE SET label=excluded.label, status='active', removed_at=NULL`, [ownerPhone, personPhone, label?.trim() || null]);
  saveDb();
  return getPersonProfile(ownerPhone, personPhone);
}

export async function removeContact(ownerPhone: string, personPhone: string): Promise<boolean> {
  await ensureContactSchema();
  const db = await getDb();
  db.run("UPDATE person_contacts SET status = 'removed', removed_at = CURRENT_TIMESTAMP WHERE owner_phone = ? AND person_phone = ? AND status != 'removed'", [ownerPhone, personPhone]);
  const changed = Number(db.exec('SELECT changes()')[0]?.values?.[0]?.[0] || 0) > 0;
  saveDb();
  return changed;
}

export async function listContacts(ownerPhone: string): Promise<PersonProfile[]> {
  await ensureContactSchema();
  const db = await getDb();
  const rows = db.exec("SELECT person_phone FROM person_contacts WHERE owner_phone = ? AND status = 'active' ORDER BY created_at ASC", [ownerPhone])[0]?.values || [];
  const profiles: PersonProfile[] = [];
  for (const [personPhone] of rows) { const profile = await getPersonProfile(ownerPhone, String(personPhone)); if (profile) profiles.push(profile); }
  return profiles;
}

export async function canCommunicate(ownerPhone: string, personPhone: string, action: CommunicationAction): Promise<{ allowed: boolean; reason?: string }> {
  const profile = await getPersonProfile(ownerPhone, personPhone, undefined);
  if (!profile || !profile.communication[action]) return { allowed: false, reason: profile?.communication.callUnavailableReason || `${action} is not authorized for this relationship` };
  return { allowed: true };
}

export function contactSchemaForTests(db: any) { tableReady(db); }
