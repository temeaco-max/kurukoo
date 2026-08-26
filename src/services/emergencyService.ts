import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export type EmergencyServiceType = 'ambulance' | 'police' | 'fire';
export type EmergencyDialState = 'dial_requested' | 'dialing' | 'ringing' | 'connected' | 'ended' | 'failed' | 'unavailable';

export interface EmergencyDirectoryRecord {
  country: string;
  jurisdiction: string;
  area: string;
  serviceType: EmergencyServiceType;
  organisation: string;
  officialNumber: string;
  emergencyNumber: string;
  source: string;
  sourceAuthority: string;
  lastVerified: string;
  verificationState: 'authoritative_public_source';
  geographicApplicability: string;
  dialCapability: 'browser_tel_link' | 'provider_required';
  fallback: string;
}

export interface EmergencySession {
  id: string;
  phone: string;
  serviceType: EmergencyServiceType;
  location?: { value: string; approximate: boolean; source: 'user' | 'trusted_profile' | 'device' | 'manual' };
  dialState: EmergencyDialState;
  startedAt: string;
  endedAt?: string;
}

const NIGERIA_SOURCE = 'https://ncc.gov.ng/media-centre/press-releases/news-release-nccs-112-emergency-number-central-successful';
const DIRECTORY: EmergencyDirectoryRecord[] = (['ambulance', 'police', 'fire'] as EmergencyServiceType[]).map(serviceType => ({
  country: 'NG', jurisdiction: 'national', area: 'all Nigeria', serviceType,
  organisation: 'Nigeria national emergency route', officialNumber: '112', emergencyNumber: '112',
  source: NIGERIA_SOURCE, sourceAuthority: 'Nigerian Communications Commission', lastVerified: '2026-08-17',
  verificationState: 'authoritative_public_source', geographicApplicability: 'Nigeria nationwide; local routing may vary',
  dialCapability: 'browser_tel_link', fallback: 'If 112 cannot be reached, use the local emergency service number shown by an authoritative local authority; Kurukoo does not invent one.'
}));
const sessions = new Map<string, EmergencySession>();

async function ensureEmergencySchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS emergency_sessions (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    service_type TEXT NOT NULL,
    location_value TEXT,
    location_approximate INTEGER NOT NULL DEFAULT 1,
    location_source TEXT,
    dial_state TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS idx_emergency_sessions_owner ON emergency_sessions(phone, updated_at);`);
}

function sessionFromRow(row: Record<string, unknown>): EmergencySession {
  const locationValue = row.location_value ? String(row.location_value) : '';
  return {
    id: String(row.id), phone: String(row.phone), serviceType: String(row.service_type) as EmergencyServiceType,
    ...(locationValue ? { location: { value: locationValue, approximate: Number(row.location_approximate) !== 0, source: String(row.location_source || 'user') as NonNullable<EmergencySession['location']>['source'] } } : {}),
    dialState: String(row.dial_state) as EmergencyDialState,
    startedAt: String(row.started_at),
    ...(row.ended_at ? { endedAt: String(row.ended_at) } : {}),
  };
}

async function loadCurrentSession(phone: string): Promise<EmergencySession | null> {
  const cached = sessions.get(phone);
  if (cached && cached.dialState !== 'ended') return cached;
  await ensureEmergencySchema();
  const db = await getDb();
  const result = db.exec("SELECT * FROM emergency_sessions WHERE phone=? AND dial_state <> 'ended' ORDER BY updated_at DESC LIMIT 1", [phone]);
  const row = result[0]?.values?.[0];
  if (!row) return null;
  const session = sessionFromRow(Object.fromEntries((result[0].columns || []).map((column: string, index: number) => [column, row[index]])));
  sessions.set(phone, session);
  return session;
}

async function persistSession(session: EmergencySession): Promise<void> {
  await ensureEmergencySchema();
  const db = await getDb();
  db.run(`INSERT INTO emergency_sessions (id, phone, service_type, location_value, location_approximate, location_source, dial_state, started_at, ended_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET service_type=excluded.service_type, location_value=excluded.location_value,
      location_approximate=excluded.location_approximate, location_source=excluded.location_source,
      dial_state=excluded.dial_state, ended_at=excluded.ended_at, updated_at=CURRENT_TIMESTAMP`,
  [session.id, session.phone, session.serviceType, session.location?.value || null, session.location?.approximate === false ? 0 : 1, session.location?.source || null, session.dialState, session.startedAt, session.endedAt || null]);
  saveDb(true);
  sessions.set(session.phone, session);
}

export function detectEmergencyIntent(message: string): boolean {
  return /\b(?:emergency|ambulance|police|fire|fire service|unconscious|attacking me|someone is attacking|immediate danger|in danger|not safe|unsafe|life[- ]threatening|distress|need help now|don['’]?t know exactly where i am|do not know exactly where i am)\b/i.test(message)
    && !/\b(?:emergency|safety)\s+contact\b/i.test(message);
}

export function isEmergencyCancellation(message: string): boolean {
  return /\b(?:not an emergency|no longer an emergency|cancel the emergency|false alarm|emergency is over)\b/i.test(message);
}

function requestedService(message: string, current?: EmergencyServiceType): EmergencyServiceType {
  if (/\bambulance|medical|unconscious|paramedic|hospital\b/i.test(message)) return 'ambulance';
  if (/\bpolice|attacking|assault|threat|robbery\b/i.test(message)) return 'police';
  if (/\bfire|smoke|burning\b/i.test(message)) return 'fire';
  return current || 'ambulance';
}

function locationFromMessage(message: string): EmergencySession['location'] {
  const match = message.match(/\b(?:at|in|near|around)\s+([^.!?]{2,80})/i);
  if (!match || /^(?:danger|distress|trouble|immediate danger|a panic|an emergency)\b/i.test(match[1].trim())) return undefined;
  return { value: match[1].trim(), approximate: true, source: 'user' };
}

export function getEmergencyDirectory(serviceType?: EmergencyServiceType): EmergencyDirectoryRecord[] {
  return DIRECTORY.filter(record => !serviceType || record.serviceType === serviceType).map(record => ({ ...record }));
}

export async function getEmergencySession(phone: string): Promise<EmergencySession | null> {
  return loadCurrentSession(phone);
}

export async function handleEmergencyTurn(phone: string, message: string): Promise<{ session: EmergencySession | null; reply: string; cardData: any; canonicalAction: string } | null> {
  const current = await loadCurrentSession(phone);
  if (current && isEmergencyCancellation(message)) {
    const ended = { ...current, dialState: 'ended' as const, endedAt: new Date().toISOString() };
    await persistSession(ended);
    return { session: ended, reply: 'Understood. I have ended the Kurukoo emergency mode. I did not claim that responders were contacted or dispatched. You can return to your earlier conversation whenever you are ready.', cardData: { type: 'emergency', session: { serviceType: ended.serviceType, dialState: ended.dialState, location: ended.location }, status: 'ended', truthful: true }, canonicalAction: 'emergency.end' };
  }
  if (!detectEmergencyIntent(message)) return null;
  const serviceType = requestedService(message, current?.serviceType);
  const location = locationFromMessage(message) || current?.location;
  const asksToCall = /\b(?:call|dial|ring|connect me to|contact)\b/i.test(message);
  const session: EmergencySession = current
    ? { ...current, serviceType, location, dialState: asksToCall ? 'dial_requested' : current.dialState }
    : { id: `emergency:${crypto.randomUUID()}`, phone, serviceType, location, dialState: asksToCall ? 'dial_requested' : 'unavailable', startedAt: new Date().toISOString() };
  await persistSession(session);
  const directory = DIRECTORY.find(record => record.serviceType === serviceType)!;
  const locationText = location ? `I have the location as ${location.value} (approximate).` : 'I do not have your location yet. You can share an approximate location or tell me where you are; do not wait to call if you are in immediate danger.';
  const dialText = asksToCall ? `I can present the verified ${directory.emergencyNumber} dial option, but I cannot claim a call connected until a real telephony boundary provides evidence.` : `If you need to speak to emergency services now, use the verified ${directory.emergencyNumber} route.`;
  return { session, reply: `Emergency mode is active for ${serviceType}. ${locationText} ${dialText} Kurukoo is a coordination interface, not an emergency responder; I will not claim dispatch, availability, diagnosis, or connection without evidence.`, cardData: { type: 'emergency', session: { serviceType: session.serviceType, dialState: session.dialState, location: session.location }, service: directory, status: session.dialState, actions: [{ id: 'dial', label: `Call ${directory.emergencyNumber}`, href: `tel:${directory.emergencyNumber}`, canonicalAction: 'emergency.dial' }, { id: 'share_location', label: 'Share approximate location', canonicalAction: 'emergency.location' }, { id: 'end', label: 'End emergency mode', canonicalAction: 'emergency.end' }], locationStatus: location ? 'approximate' : 'unknown', truthful: true }, canonicalAction: asksToCall ? 'emergency.dial' : 'emergency.assess' };
}
