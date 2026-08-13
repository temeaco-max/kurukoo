import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { find_worker } from './find-worker.js';
import { addEconomicParticipant, getEconomicParticipants, updateEconomicParticipant } from './economicParticipants.js';
import { getEconomicRequest, transitionEconomicRequest, type EconomicRequest } from './skillFlows.js';
import { enqueueInternalNotification } from './pushNotifications.js';
import { providerMayBeDiscovered } from './providerVerification.js';

export const PROVIDER_INVITATION_STATUSES = ['invited', 'accepted', 'declined', 'expired', 'withdrawn'] as const;
export type ProviderInvitationStatus = typeof PROVIDER_INVITATION_STATUSES[number];
export const HANDOFF_STATUSES = ['requested', 'claimed', 'resolved', 'cancelled'] as const;
export type HandoffStatus = typeof HANDOFF_STATUSES[number];

export interface ProviderInvitation {
  id: string;
  requestId: string;
  providerPhone: string;
  capability: string;
  status: ProviderInvitationStatus;
  quoteMinor: number | null;
  currency: string | null;
  note: string | null;
  expiresAt: string | null;
  responseIdempotencyKey: string | null;
  createdAt: string | null;
  respondedAt: string | null;
}

export interface CoordinationHandoff {
  id: string;
  requestId: string;
  status: HandoffStatus;
  reason: string;
  operatorHash: string | null;
  createdAt: string | null;
  claimedAt: string | null;
  resolvedAt: string | null;
}

const invitationStatusSet = new Set<string>(PROVIDER_INVITATION_STATUSES);
const handoffStatusSet = new Set<string>(HANDOFF_STATUSES);
const PILOT_ROLES = new Set(['customer', 'provider']);
const PILOT_ACCOUNT_STATES = new Set(['active', 'suspended', 'revoked']);
const AVAILABILITY_STATES = new Set(['available', 'unavailable', 'temporarily_unavailable']);

export function isControlledPilotEnabled(): boolean { return process.env.KURUKOO_CONTROLLED_PILOT === 'true'; }

function currentIso(): string { return new Date().toISOString(); }

function normalizeServiceArea(value: unknown): string {
  return String(value || '')
    .toLocaleLowerCase('en-NG')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isMatchingServiceArea(serviceArea: unknown, requestedLocation: unknown): boolean {
  const area = normalizeServiceArea(serviceArea);
  const location = normalizeServiceArea(requestedLocation);
  if (!area || !location) return !area;
  const areaTokens = area.split(' ');
  const locationTokens = location.split(' ');
  return area === location || areaTokens.every((token) => locationTokens.includes(token));
}

function providerRequestProjection(request: EconomicRequest): Pick<EconomicRequest, 'id' | 'skill' | 'category' | 'requirements' | 'status'> {
  const allowed = new Set(['location', 'origin', 'destination', 'service', 'device', 'device_or_asset', 'issue', 'items', 'quantity', 'time', 'date_time', 'deadline', 'event_date', 'venue', 'budget', 'urgency', 'duration']);
  const requirements: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request.requirements || {})) if (allowed.has(key)) requirements[key] = value;
  return { id: request.id, skill: request.skill, category: request.category, requirements, status: request.status };
}

function actorHash(value: string): string {
  const salt = process.env.KURUKOO_COORDINATION_SALT || process.env.KURUKOO_PILOT_EVENT_SALT || process.env.JWT_SECRET || 'development-coordination-salt';
  return crypto.createHash('sha256').update(`${salt}:${value.slice(0, 256)}`).digest('hex').slice(0, 32);
}

function cleanText(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${field} is too long`);
  return text;
}

function cleanOptionalNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return cleanText(value, 'Note', 500)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted-phone]')
    .replace(/\b(?:otp|code|pin)\s*[:=-]?\s*\d{4,8}\b/gi, '[redacted-code]')
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted-token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]');
}

function invitationFromRow(row: any): ProviderInvitation {
  return {
    id: String(row.id), requestId: String(row.request_id), providerPhone: String(row.provider_phone), capability: String(row.capability),
    status: String(row.status) as ProviderInvitationStatus,
    quoteMinor: row.quote_minor === null || row.quote_minor === undefined ? null : Number(row.quote_minor),
    currency: row.currency ? String(row.currency) : null, note: row.note ? String(row.note) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null, responseIdempotencyKey: row.response_idempotency_key ? String(row.response_idempotency_key) : null,
    createdAt: row.created_at ? String(row.created_at) : null, respondedAt: row.responded_at ? String(row.responded_at) : null,
  };
}

function handoffFromRow(row: any): CoordinationHandoff {
  return {
    id: String(row.id), requestId: String(row.request_id), status: String(row.status) as HandoffStatus,
    reason: String(row.reason), operatorHash: row.operator_hash ? String(row.operator_hash) : null,
    createdAt: row.created_at ? String(row.created_at) : null, claimedAt: row.claimed_at ? String(row.claimed_at) : null, resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  };
}

async function ensureCoordinationSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS provider_coordination_invitations (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    provider_phone TEXT NOT NULL,
    capability TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited',
    quote_minor INTEGER,
    currency TEXT,
    note TEXT,
    expires_at TEXT,
    response_idempotency_key TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, provider_phone)
  );
  CREATE INDEX IF NOT EXISTS idx_provider_coordination_provider_status ON provider_coordination_invitations(provider_phone, status, created_at);
  CREATE INDEX IF NOT EXISTS idx_provider_coordination_request ON provider_coordination_invitations(request_id, created_at);
  CREATE TABLE IF NOT EXISTS coordination_handoffs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    reason TEXT NOT NULL,
    operator_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    claimed_at TEXT,
    resolved_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_coordination_handoffs_status ON coordination_handoffs(status, created_at);
  CREATE TABLE IF NOT EXISTS coordination_events (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    invitation_id TEXT,
    handoff_id TEXT,
    event_name TEXT NOT NULL,
    authority TEXT NOT NULL,
    actor_hash TEXT NOT NULL,
    idempotency_key TEXT,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_coordination_events_idempotency ON coordination_events(request_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE TABLE IF NOT EXISTS controlled_pilot_accounts (
    phone TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('customer','provider')),
    state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','suspended','revoked')),
    enrolled_by_hash TEXT NOT NULL,
    enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS provider_coordination_availability (
    phone TEXT NOT NULL,
    skill TEXT NOT NULL,
    service_area TEXT,
    timezone TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('available','unavailable','temporarily_unavailable')),
    available_until TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(phone, skill, service_area)
  );
  CREATE INDEX IF NOT EXISTS idx_provider_coordination_availability_current ON provider_coordination_availability(phone,skill,state,available_until);`);
}

async function recordEvent(input: { requestId: string; invitationId?: string; handoffId?: string; event: string; authority: 'customer' | 'provider' | 'operator' | 'system'; actorId: string; idempotencyKey?: string; evidence?: Record<string, unknown> }): Promise<void> {
  await ensureCoordinationSchema();
  const db = await getDb();
  db.run(`INSERT OR IGNORE INTO coordination_events(id,request_id,invitation_id,handoff_id,event_name,authority,actor_hash,idempotency_key,evidence_json)
    VALUES (?,?,?,?,?,?,?,?,?)`, [
    crypto.randomUUID(), input.requestId, input.invitationId || null, input.handoffId || null, input.event, input.authority,
    actorHash(input.actorId), input.idempotencyKey || null, JSON.stringify(input.evidence || {}).slice(0, 1600),
  ]);
  saveDb();
}

export async function assertControlledPilotAccount(phone: string, role: 'customer' | 'provider'): Promise<void> {
  if (!isControlledPilotEnabled()) return;
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT role,state FROM controlled_pilot_accounts WHERE phone=? LIMIT 1');
  stmt.bind([cleanText(phone, 'Authenticated identity', 128)]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : null;
  stmt.free();
  if (!row || row.role !== role || row.state !== 'active') throw new Error('This account is not enrolled for the controlled pilot');
}

export async function setControlledPilotAccount(input: { phone: unknown; role: unknown; state?: unknown; operatorId: string }): Promise<void> {
  const phone = cleanText(input.phone, 'Pilot account phone', 128);
  const role = cleanText(input.role, 'Pilot account role', 32);
  const state = cleanText(input.state || 'active', 'Pilot account state', 32);
  if (!PILOT_ROLES.has(role) || !PILOT_ACCOUNT_STATES.has(state)) throw new Error('Unsupported pilot account role or state');
  await ensureCoordinationSchema();
  const db = await getDb();
  db.run(`INSERT INTO controlled_pilot_accounts(phone,role,state,enrolled_by_hash,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(phone) DO UPDATE SET role=excluded.role,state=excluded.state,enrolled_by_hash=excluded.enrolled_by_hash,updated_at=CURRENT_TIMESTAMP`, [phone, role, state, actorHash(cleanText(input.operatorId, 'Operator identity', 128))]);
  saveDb();
}

export async function setProviderCoordinationAvailability(input: { phone: string; skill: unknown; serviceArea?: unknown; timezone?: unknown; state: unknown; availableForMinutes?: unknown }): Promise<void> {
  const phone = cleanText(input.phone, 'Provider identity', 128);
  await assertControlledPilotAccount(phone, 'provider');
  const skill = cleanText(input.skill, 'Skill', 128).toLowerCase();
  const serviceArea = input.serviceArea === undefined || input.serviceArea === null || input.serviceArea === '' ? null : cleanText(input.serviceArea, 'Service area', 160);
  const state = cleanText(input.state, 'Availability state', 64);
  if (!AVAILABILITY_STATES.has(state)) throw new Error('Unsupported availability state');
  const timezone = cleanText(input.timezone || 'Africa/Lagos', 'Timezone', 64);
  try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); } catch { throw new Error('Timezone is invalid'); }
  const minutes = input.availableForMinutes === undefined ? 60 : Number(input.availableForMinutes);
  if (state === 'available' && (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440)) throw new Error('Available duration must be between 5 minutes and 24 hours');
  await ensureCoordinationSchema();
  const db = await getDb();
  const availableUntil = state === 'available' ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
  db.run(`INSERT INTO provider_coordination_availability(phone,skill,service_area,timezone,state,available_until,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(phone,skill,service_area) DO UPDATE SET timezone=excluded.timezone,state=excluded.state,available_until=excluded.available_until,updated_at=CURRENT_TIMESTAMP`, [phone, skill, serviceArea, timezone, state, availableUntil]);
  saveDb();
}

export async function isCurrentProviderAvailability(phone: string, skill: string, location?: string): Promise<boolean> {
  if (!isControlledPilotEnabled()) return true;
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare("SELECT service_area FROM provider_coordination_availability WHERE phone=? AND lower(skill)=lower(?) AND state='available' AND available_until>? ORDER BY updated_at DESC");
  stmt.bind([cleanText(phone, 'Provider identity', 128), cleanText(skill, 'Skill', 128), currentIso()]);
  let eligible = false;
  while (stmt.step()) {
    const area = (stmt.getAsObject() as Record<string, unknown>).service_area;
    if (isMatchingServiceArea(area, location)) { eligible = true; break; }
  }
  stmt.free();
  return eligible;
}

async function requireOwner(requestId: string, ownerPhone: string): Promise<EconomicRequest> {
  await assertControlledPilotAccount(ownerPhone, 'customer');
  const request = await getEconomicRequest(cleanText(requestId, 'Request id', 128));
  if (!request || request.phone !== cleanText(ownerPhone, 'Authenticated owner', 128)) throw new Error('Economic request ownership is required');
  return request;
}

async function requireVerifiedProvider(providerPhone: string): Promise<void> {
  await assertControlledPilotAccount(providerPhone, 'provider');
  if (!await providerMayBeDiscovered(providerPhone)) throw new Error('An evidence-verified provider account is required');
}

function isTerminal(status: string): boolean {
  return ['completed', 'cancelled', 'disputed', 'failed', 'abandoned'].includes(status);
}

export async function inviteEligibleProviders(input: { requestId: string; ownerPhone: string; max?: number }): Promise<{ invitations: ProviderInvitation[]; internalQueueOnly: boolean }> {
  const request = await requireOwner(input.requestId, input.ownerPhone);
  if (isTerminal(request.status)) throw new Error('Closed requests cannot invite providers');
  await ensureCoordinationSchema();
  const location = typeof request.requirements.location === 'string' ? request.requirements.location : typeof request.requirements.origin === 'string' ? request.requirements.origin : undefined;
  const matches = await find_worker({ skill: request.skill, location, max: Math.min(Math.max(Number(input.max) || 3, 1), 5) });
  const db = await getDb();
  const invitations: ProviderInvitation[] = [];
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  for (const provider of matches.providers) {
    if (!await isCurrentProviderAvailability(provider.phone, request.skill, typeof location === 'string' ? location : undefined)) continue;
    const id = crypto.randomUUID();
    db.run(`INSERT OR IGNORE INTO provider_coordination_invitations(id,request_id,provider_phone,capability,status,expires_at)
      VALUES (?,?,?,?, 'invited', ?)`, [id, request.id, provider.phone, request.skill, expiresAt]);
    const existing = db.prepare('SELECT * FROM provider_coordination_invitations WHERE request_id=? AND provider_phone=? LIMIT 1');
    existing.bind([request.id, provider.phone]);
    const row = existing.step() ? existing.getAsObject() : null;
    existing.free();
    if (!row) continue;
    const invitation = invitationFromRow(row);
    invitations.push(invitation);
    await addEconomicParticipant({ requestId: request.id, ownerPhone: request.phone, role: 'service_provider', providerPhone: provider.phone, capability: request.skill, status: 'invited', evidence: { invitation_id: invitation.id, matching_source: 'verified_capability_match', external_delivery: 'not_claimed' } });
    await recordEvent({ requestId: request.id, invitationId: invitation.id, event: 'provider_invited', authority: 'customer', actorId: request.phone, idempotencyKey: `invite:${request.id}:${provider.phone}`, evidence: { capability: request.skill, delivery: 'internal_queue_only' } });
    await enqueueInternalNotification(
      provider.phone,
      'New Kurukoo request available',
      'A request matching your verified capability is available in your provider queue.',
      `/provider/coordination?invitation=${encodeURIComponent(invitation.id)}`,
      {
        purpose: 'provider_invitation',
        aggregateType: 'provider_invitation',
        aggregateId: invitation.id,
        idempotencyKey: `notification:provider-invitation:${invitation.id}`,
        metadata: { request_id: request.id, external_delivery: 'not_claimed' },
      },
    );
  }
  saveDb();
  return { invitations, internalQueueOnly: true };
}

export async function listProviderInvitations(providerPhone: string, limit = 30): Promise<Array<ProviderInvitation & { request: Pick<EconomicRequest, 'id' | 'skill' | 'category' | 'requirements' | 'status'> }>> {
  await requireVerifiedProvider(cleanText(providerPhone, 'Provider identity', 128));
  await ensureCoordinationSchema();
  const db = await getDb();
  db.run(`UPDATE provider_coordination_invitations SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE provider_phone=? AND status IN ('invited','accepted') AND expires_at IS NOT NULL AND datetime(expires_at) < CURRENT_TIMESTAMP`, [providerPhone]);
  const stmt = db.prepare(`SELECT * FROM provider_coordination_invitations WHERE provider_phone=? AND status IN ('invited','accepted','declined','expired') ORDER BY created_at DESC LIMIT ?`);
  stmt.bind([providerPhone, Math.min(Math.max(Number(limit) || 30, 1), 100)]);
  const rows: ProviderInvitation[] = [];
  while (stmt.step()) rows.push(invitationFromRow(stmt.getAsObject()));
  stmt.free();
  const output: Array<ProviderInvitation & { request: Pick<EconomicRequest, 'id' | 'skill' | 'category' | 'requirements' | 'status'> }> = [];
  for (const invitation of rows) {
    const request = await getEconomicRequest(invitation.requestId);
    if (request) output.push({ ...invitation, request: providerRequestProjection(request) });
  }
  saveDb();
  return output;
}

export async function respondToProviderInvitation(input: { invitationId: string; providerPhone: string; response: 'accepted' | 'declined'; quoteMinor?: unknown; currency?: unknown; note?: unknown; idempotencyKey: string }): Promise<ProviderInvitation> {
  const providerPhone = cleanText(input.providerPhone, 'Provider identity', 128);
  await requireVerifiedProvider(providerPhone);
  const invitationId = cleanText(input.invitationId, 'Invitation id', 128);
  const response = cleanText(input.response, 'Response', 32) as ProviderInvitationStatus;
  if (!['accepted', 'declined'].includes(response)) throw new Error('Response must be accepted or declined');
  const idempotencyKey = cleanText(input.idempotencyKey, 'Idempotency key', 128);
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM provider_coordination_invitations WHERE id=? AND provider_phone=? LIMIT 1');
  stmt.bind([invitationId, providerPhone]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) throw new Error('Provider invitation not found');
  const invitation = invitationFromRow(row);
  if (invitation.status !== 'invited') {
    if (invitation.responseIdempotencyKey === idempotencyKey) return invitation;
    throw new Error('This provider invitation has already been answered');
  }
  if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now()) throw new Error('This provider invitation has expired');
  const request = await getEconomicRequest(invitation.requestId);
  if (!request || isTerminal(request.status)) throw new Error('The related request is no longer active');
  const requestLocation = typeof request.requirements.location === 'string' ? request.requirements.location : typeof request.requirements.origin === 'string' ? request.requirements.origin : undefined;
  if (!await isCurrentProviderAvailability(providerPhone, request.skill, requestLocation)) throw new Error('Provider availability is unknown or stale');
  const submittedQuote = response === 'accepted' ? Number(input.quoteMinor) : null;
  if (response === 'accepted' && (submittedQuote === null || !Number.isSafeInteger(submittedQuote) || submittedQuote <= 0)) throw new Error('An accepted response requires a positive whole-number quote in minor units');
  const quoteMinor = response === 'accepted' ? submittedQuote as number : null;
  const currency = response === 'accepted' ? cleanText(typeof input.currency === 'string' ? input.currency : 'NGN', 'Currency', 8).toUpperCase() : null;
  if (isControlledPilotEnabled() && currency && currency !== 'NGN') throw new Error('Controlled pilot quotes must use NGN');
  const note = cleanOptionalNote(input.note);
  db.run(`UPDATE provider_coordination_invitations SET status=?, quote_minor=?, currency=?, note=?, response_idempotency_key=?, responded_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [response, quoteMinor, currency, note, idempotencyKey, invitation.id]);
  await updateEconomicParticipant({ requestId: request.id, actorPhone: providerPhone, role: 'service_provider', providerPhone, status: response === 'accepted' ? 'accepted' : 'declined', evidence: { invitation_id: invitation.id, response, quote_minor: quoteMinor, currency, provider_note: note, response_idempotency_key: idempotencyKey, external_delivery: 'not_claimed' } });
  await recordEvent({ requestId: request.id, invitationId: invitation.id, event: `provider_${response}`, authority: 'provider', actorId: providerPhone, idempotencyKey: `response:${invitation.id}:${idempotencyKey}`, evidence: { quote_submitted: response === 'accepted', currency: currency || undefined } });
  await enqueueInternalNotification(
    request.phone,
    'Provider response received',
    response === 'accepted' ? 'A provider submitted a quote for your request. Review it in Kurukoo before confirming.' : 'A provider declined this request. Kurukoo can continue with other available responses.',
    `/chat?request=${encodeURIComponent(request.id)}`,
    {
      purpose: 'provider_response',
      aggregateType: 'provider_invitation',
      aggregateId: invitation.id,
      idempotencyKey: `notification:provider-response:${invitation.id}:${idempotencyKey}`,
      metadata: { request_id: request.id, provider_response: response, external_delivery: 'not_claimed' },
    },
  );
  saveDb();
  return (await getProviderInvitation(invitation.id))!;
}

export async function getProviderInvitation(id: string): Promise<ProviderInvitation | null> {
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM provider_coordination_invitations WHERE id=? LIMIT 1');
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? invitationFromRow(row) : null;
}

export async function listOwnerProviderResponses(input: { requestId: string; ownerPhone: string }): Promise<Array<ProviderInvitation & { providerName: string }>> {
  await requireOwner(input.requestId, input.ownerPhone);
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT i.*, COALESCE(m.name,'Verified provider') AS provider_name FROM provider_coordination_invitations i LEFT JOIN memory_profiles m ON m.phone=i.provider_phone WHERE i.request_id=? ORDER BY CASE i.status WHEN 'accepted' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END, i.created_at ASC`);
  stmt.bind([input.requestId]);
  const output: Array<ProviderInvitation & { providerName: string }> = [];
  while (stmt.step()) { const row = stmt.getAsObject(); output.push({ ...invitationFromRow(row), providerName: String(row.provider_name || 'Verified provider') }); }
  stmt.free();
  return output;
}

export async function selectProviderResponse(input: { requestId: string; ownerPhone: string; invitationId: string }): Promise<EconomicRequest> {
  const request = await requireOwner(input.requestId, input.ownerPhone);
  const invitation = await getProviderInvitation(cleanText(input.invitationId, 'Invitation id', 128));
  if (!invitation || invitation.requestId !== request.id || invitation.status !== 'accepted' || !Number.isSafeInteger(invitation.quoteMinor) || !invitation.currency) throw new Error('An accepted provider quote is required');
  await requireVerifiedProvider(invitation.providerPhone);
  if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now()) throw new Error('Provider quote has expired');
  const requestLocation = typeof request.requirements.location === 'string' ? request.requirements.location : typeof request.requirements.origin === 'string' ? request.requirements.origin : undefined;
  if (!await isCurrentProviderAvailability(invitation.providerPhone, request.skill, requestLocation)) throw new Error('Provider availability is unknown or stale');
  await updateEconomicParticipant({ requestId: request.id, actorPhone: request.phone, role: 'service_provider', providerPhone: invitation.providerPhone, status: 'selected', evidence: { invitation_id: invitation.id, selected_by: 'customer', selected_at: new Date().toISOString() } });
  let current = await getEconomicRequest(request.id);
  if (!current) throw new Error('Economic request not found');
  if (current.status === 'requested') current = await transitionEconomicRequest(current.id, 'awaiting_match');
  if (current.status === 'awaiting_match' || current.status === 'partially_matched') current = await transitionEconomicRequest(current.id, 'matched', { providerPhone: invitation.providerPhone });
  if (current.status === 'matched') current = await transitionEconomicRequest(current.id, 'quoting', { providerPhone: invitation.providerPhone });
  if (current.status === 'quoting' || current.status === 'quoted') current = await transitionEconomicRequest(current.id, 'quoted', { providerPhone: invitation.providerPhone, quote: { amount_minor: invitation.quoteMinor, currency: invitation.currency, source: 'provider_submitted', provider_response_id: invitation.id, confirmed_by_provider: true, quoted_at: invitation.respondedAt || new Date().toISOString() } });
  await recordEvent({ requestId: request.id, invitationId: invitation.id, event: 'provider_response_selected', authority: 'customer', actorId: request.phone, idempotencyKey: `select:${request.id}:${invitation.id}`, evidence: { quote_source: 'provider_submitted' } });
  return current;
}

export async function acceptSelectedProviderQuote(input: { requestId: string; ownerPhone: string }): Promise<EconomicRequest> {
  const request = await requireOwner(input.requestId, input.ownerPhone);
  if (request.status === 'awaiting_confirmation' && request.quote?.source === 'provider_submitted') return request;
  if (request.status !== 'quoted' || request.quote?.source !== 'provider_submitted') throw new Error('A selected provider-submitted quote is required');
  const participants = await getEconomicParticipants(request.id);
  const selected = participants.find((participant) => participant.role === 'service_provider' && participant.status === 'selected' && participant.providerPhone === request.providerPhone);
  if (!selected) throw new Error('A selected provider participant is required');
  await requireVerifiedProvider(selected.providerPhone);
  const requestLocation = typeof request.requirements.location === 'string' ? request.requirements.location : typeof request.requirements.origin === 'string' ? request.requirements.origin : undefined;
  if (!await isCurrentProviderAvailability(selected.providerPhone, request.skill, requestLocation)) throw new Error('Provider availability is unknown or stale');
  await updateEconomicParticipant({ requestId: request.id, actorPhone: request.phone, role: 'service_provider', providerPhone: selected.providerPhone, status: 'confirmed', evidence: { customer_quote_acceptance: true, accepted_at: new Date().toISOString(), accepted_not_paid: true } });
  const updated = await transitionEconomicRequest(request.id, 'awaiting_confirmation');
  await recordEvent({ requestId: request.id, event: 'provider_quote_accepted', authority: 'customer', actorId: request.phone, idempotencyKey: `quote-accept:${request.id}:${String(request.quote.provider_response_id || '')}`, evidence: { payment_not_claimed: true } });
  return updated;
}

export async function requestOperatorHandoff(input: { requestId: string; ownerPhone: string; reason?: unknown }): Promise<CoordinationHandoff> {
  const request = await requireOwner(input.requestId, input.ownerPhone);
  if (isTerminal(request.status)) throw new Error('Closed requests cannot be handed off');
  await ensureCoordinationSchema();
  const db = await getDb();
  const open = db.prepare(`SELECT * FROM coordination_handoffs WHERE request_id=? AND status IN ('requested','claimed') ORDER BY created_at DESC LIMIT 1`);
  open.bind([request.id]);
  const existing = open.step() ? open.getAsObject() : null;
  open.free();
  if (existing) return handoffFromRow(existing);
  const handoff: CoordinationHandoff = { id: crypto.randomUUID(), requestId: request.id, status: 'requested', reason: cleanOptionalNote(input.reason) || 'Customer requested coordinator assistance', operatorHash: null, createdAt: new Date().toISOString(), claimedAt: null, resolvedAt: null };
  db.run(`INSERT INTO coordination_handoffs(id,request_id,status,reason) VALUES (?,?,?,?)`, [handoff.id, handoff.requestId, handoff.status, handoff.reason]);
  await recordEvent({ requestId: request.id, handoffId: handoff.id, event: 'operator_handoff_requested', authority: 'customer', actorId: request.phone, idempotencyKey: `handoff:${request.id}`, evidence: { reason_present: Boolean(input.reason) } });
  saveDb();
  return handoff;
}

export async function getOwnerHandoff(input: { requestId: string; ownerPhone: string }): Promise<CoordinationHandoff | null> {
  await requireOwner(input.requestId, input.ownerPhone);
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM coordination_handoffs WHERE request_id=? ORDER BY created_at DESC LIMIT 1');
  stmt.bind([input.requestId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? handoffFromRow(row) : null;
}

export async function listOperatorHandoffs(limit = 50): Promise<CoordinationHandoff[]> {
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM coordination_handoffs WHERE status IN ('requested','claimed') ORDER BY CASE status WHEN 'requested' THEN 0 ELSE 1 END, created_at ASC LIMIT ?`);
  stmt.bind([Math.min(Math.max(Number(limit) || 50, 1), 100)]);
  const output: CoordinationHandoff[] = [];
  while (stmt.step()) output.push(handoffFromRow(stmt.getAsObject()));
  stmt.free();
  return output;
}

export async function updateOperatorHandoff(input: { handoffId: string; operatorId: string; status: 'claimed' | 'resolved' | 'cancelled' }): Promise<CoordinationHandoff> {
  const status = cleanText(input.status, 'Handoff status', 32) as HandoffStatus;
  if (!['claimed', 'resolved', 'cancelled'].includes(status)) throw new Error('Unsupported handoff status');
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM coordination_handoffs WHERE id=? LIMIT 1');
  stmt.bind([cleanText(input.handoffId, 'Handoff id', 128)]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) throw new Error('Coordination handoff not found');
  const handoff = handoffFromRow(row);
  if (handoff.status === 'resolved' || handoff.status === 'cancelled') throw new Error('Coordination handoff is already closed');
  if (status === 'claimed' && handoff.status !== 'requested') throw new Error('Only requested handoffs can be claimed');
  if (status === 'resolved' && handoff.status !== 'claimed') throw new Error('Only claimed handoffs can be resolved');
  db.run(`UPDATE coordination_handoffs SET status=?, operator_hash=?, claimed_at=CASE WHEN ?='claimed' THEN CURRENT_TIMESTAMP ELSE claimed_at END, resolved_at=CASE WHEN ? IN ('resolved','cancelled') THEN CURRENT_TIMESTAMP ELSE resolved_at END, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [status, actorHash(cleanText(input.operatorId, 'Operator identity', 128)), status, status, handoff.id]);
  await recordEvent({ requestId: handoff.requestId, handoffId: handoff.id, event: `operator_handoff_${status}`, authority: 'operator', actorId: input.operatorId, idempotencyKey: `handoff:${handoff.id}:${status}`, evidence: {} });
  saveDb();
  const updated = db.prepare('SELECT * FROM coordination_handoffs WHERE id=? LIMIT 1'); updated.bind([handoff.id]); const updatedRow = updated.step() ? updated.getAsObject() : null; updated.free();
  return handoffFromRow(updatedRow);
}

export async function getCoordinationEvents(requestId: string, ownerPhone: string): Promise<Array<{ event: string; authority: string; evidence: Record<string, unknown>; createdAt: string | null }>> {
  await requireOwner(requestId, ownerPhone);
  await ensureCoordinationSchema();
  const db = await getDb();
  const stmt = db.prepare('SELECT event_name,authority,evidence_json,created_at FROM coordination_events WHERE request_id=? ORDER BY created_at ASC LIMIT 100');
  stmt.bind([requestId]);
  const output: Array<{ event: string; authority: string; evidence: Record<string, unknown>; createdAt: string | null }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject(); let evidence: Record<string, unknown> = {};
    try { evidence = JSON.parse(String(row.evidence_json || '{}')); } catch {}
    output.push({ event: String(row.event_name), authority: String(row.authority), evidence, createdAt: row.created_at ? String(row.created_at) : null });
  }
  stmt.free();
  return output;
}
