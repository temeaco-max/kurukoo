import { getDb, saveDb, updateProviderPresence } from '../database.js';
import { deductCredits } from './pointsEngine.js';
import { updateTrickPresence } from './trickBridge.js';
import { providerMayBeDiscovered } from './providerVerification.js';

/**
 * Canonical Nearby Pulse lifecycle.
 *
 * A Pulse session is an authenticated, provider-owned, time-bounded declaration
 * of approximate presence. It is not a booking, external broadcast, delivery,
 * fulfilment, or notification-delivery authority.
 */
const PULSE_DURATION_MINUTES = 30;

export interface PulseState {
  active: boolean;
  skill: string | null;
  expiresAt: string | null;
  source: 'mobile' | 'stationary' | null;
}

function validCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function canActivatePulse(phone: string, skill?: string, operationMode: 'mobile' | 'stationary' = 'mobile'): Promise<boolean> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT 1 FROM skills WHERE phone=? AND operation_mode=? AND is_available=1${skill ? ' AND lower(skill)=lower(?)' : ''} LIMIT 1`);
  stmt.bind(skill ? [phone, operationMode, skill] : [phone, operationMode]);
  const eligible = stmt.step();
  stmt.free();
  return eligible;
}

export async function activatePulse(phone: string, skill: string, lat: number, lng: number, operationMode: 'mobile' | 'stationary' = 'mobile'): Promise<{ success: boolean; message: string; expiresAt?: string }> {
  const normalizedSkill = String(skill || '').trim().toLowerCase();
  if (!normalizedSkill || !validCoordinates(lat, lng) || !['mobile', 'stationary'].includes(operationMode)) {
    return { success: false, message: 'Choose one eligible skill and share a valid current location to go live.' };
  }
  if (!await canActivatePulse(phone, normalizedSkill, operationMode)) {
    return { success: false, message: `This skill is not currently eligible for ${operationMode} Go Live.` };
  }

  const db = await getDb();
  const profileStmt = db.prepare(`SELECT subscription_tier FROM memory_profiles WHERE phone=?`);
  profileStmt.bind([phone]);
  let tier = 'Base';
  if (profileStmt.step()) tier = String(profileStmt.getAsObject().subscription_tier || 'Base');
  profileStmt.free();

  if (tier === 'Base') {
    const countStmt = db.prepare(`SELECT COUNT(*) AS cnt FROM pulse_sessions WHERE phone=? AND expires_at > datetime('now', '-30 days')`);
    countStmt.bind([phone]);
    const sessionCount = countStmt.step() ? Number(countStmt.getAsObject().cnt || 0) : 0;
    countStmt.free();
    if (sessionCount >= 10) {
      return { success: false, message: 'Nearby Pulse monthly limit reached. Base tier is limited to 5 hours (10 sessions) per month.' };
    }
  }

  if (!await deductCredits(phone, 5, 'Nearby Pulse Go Live (30 minutes)')) {
    return { success: false, message: 'Insufficient platform credits for Nearby Pulse (requires 5 credits).' };
  }

  const expiresAt = new Date(Date.now() + PULSE_DURATION_MINUTES * 60_000).toISOString();
  db.run(`UPDATE pulse_sessions SET active=0 WHERE phone=? AND active=1`, [phone]);
  db.run(`INSERT INTO pulse_sessions(phone,skill,lat,lng,expires_at,active) VALUES(?,?,?,?,?,1)`, [phone, normalizedSkill, lat, lng, expiresAt]);
  await updateProviderPresence({ phone, is_live: true, operation_mode: operationMode, last_lat: lat, last_lng: lng, fuzzed_radius_m: 100, live_until: expiresAt });
  await updateTrickPresence(phone, lat, lng, 100, operationMode);
  saveDb();

  return {
    success: true,
    expiresAt,
    message: 'Nearby Pulse is live for 30 minutes. Kurukoo shows approximate presence only; no external broadcast or alert is claimed.',
  };
}

export async function updatePulsePresence(phone: string, lat: number, lng: number, movementMeters = 100): Promise<{ success: boolean; message: string; expiresAt?: string }> {
  if (!validCoordinates(lat, lng)) return { success: false, message: 'A valid current location is required to update Go Live presence.' };
  const state = await getPulseState(phone);
  if (!state.active || !state.expiresAt || !state.skill || !state.source) {
    return { success: false, message: 'No active Go Live session is available to update.' };
  }
  await updateProviderPresence({ phone, is_live: true, operation_mode: state.source, last_lat: lat, last_lng: lng, fuzzed_radius_m: 100, live_until: state.expiresAt });
  await updateTrickPresence(phone, lat, lng, movementMeters, state.source);
  const db = await getDb();
  db.run(`UPDATE pulse_sessions SET lat=?, lng=? WHERE phone=? AND active=1 AND expires_at>?`, [lat, lng, phone, new Date().toISOString()]);
  saveDb();
  return { success: true, expiresAt: state.expiresAt, message: 'Approximate live presence updated. Your Pulse expiry has not changed.' };
}

export async function endPulseSession(phone: string): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE pulse_sessions SET active=0 WHERE phone=? AND active=1`, [phone]);
  await updateProviderPresence({ phone, is_live: false, live_until: new Date().toISOString() });
  saveDb();
}

export async function getPulseState(phone: string): Promise<PulseState> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT p.skill,p.expires_at,pr.operation_mode FROM pulse_sessions p LEFT JOIN provider_presence pr ON pr.phone=p.phone WHERE p.phone=? AND p.active=1 AND datetime(p.expires_at)>CURRENT_TIMESTAMP ORDER BY p.id DESC LIMIT 1`);
  stmt.bind([phone]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  if (row) {
    const source = row.operation_mode === 'stationary' ? 'stationary' : 'mobile';
    return { active: true, skill: String(row.skill || ''), expiresAt: String(row.expires_at || ''), source };
  }
  return { active: false, skill: null, expiresAt: null, source: null };
}

/** Internal aggregate for authenticated status and proximity filtering. Raw coordinates never leave discovery projections. */
export async function getActivePulseProviders(): Promise<any[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT p.phone,p.skill,p.lat,p.lng,pr.fuzzed_lat,pr.fuzzed_lng,m.name,m.location,m.subscription_tier,CASE WHEN pr.operation_mode='stationary' THEN 'stationary' ELSE 'mobile' END AS source,pr.live_until,pr.last_confirmed
    FROM pulse_sessions p
    JOIN provider_presence pr ON pr.phone=p.phone
    JOIN memory_profiles m ON m.phone=p.phone
    WHERE p.active=1 AND datetime(p.expires_at)>CURRENT_TIMESTAMP AND pr.is_live=1 AND datetime(pr.live_until)>CURRENT_TIMESTAMP
    UNION ALL
    SELECT pr.phone,s.skill,pr.last_lat AS lat,pr.last_lng AS lng,pr.fuzzed_lat,pr.fuzzed_lng,m.name,m.location,m.subscription_tier,'stationary' AS source,pr.live_until,pr.last_confirmed
    FROM provider_presence pr
    JOIN memory_profiles m ON m.phone=pr.phone
    JOIN skills s ON s.phone=pr.phone
    WHERE pr.is_live=1 AND pr.operation_mode='stationary' AND datetime(pr.live_until)>CURRENT_TIMESTAMP AND s.is_available=1 AND NOT EXISTS (SELECT 1 FROM pulse_sessions p WHERE p.phone=pr.phone AND p.active=1 AND datetime(p.expires_at)>CURRENT_TIMESTAMP)
  `);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  const eligible: any[] = [];
  for (const provider of results) if (await providerMayBeDiscovered(String(provider.phone || ''))) eligible.push(provider);
  return eligible;
}
