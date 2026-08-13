import { createHash, randomUUID } from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export const DELIVERY_STATES = [
  'queued',
  'accepted',
  'submitted',
  'sent',
  'delivered',
  'read',
  'failed',
  'undeliverable',
  'not_configured',
  'suppressed',
] as const;

export type DeliveryState = typeof DELIVERY_STATES[number];
export type DeliveryDirection = 'inbound' | 'outbound';

export interface CommunicationDelivery {
  id: string;
  phone: string;
  channel: string;
  direction: DeliveryDirection;
  purpose: string;
  aggregateType?: string;
  aggregateId?: string;
  messageId?: number;
  idempotencyKey?: string;
  providerReference?: string;
  state: DeliveryState;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  acceptedAt?: string;
  deliveredAt?: string;
  readAt?: string;
  updatedAt?: string;
}

export interface CreateDeliveryInput {
  phone: string;
  channel: string;
  direction: DeliveryDirection;
  purpose?: string;
  aggregateType?: string;
  aggregateId?: string;
  messageId?: number;
  idempotencyKey?: string;
  providerReference?: string;
  state?: DeliveryState;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value ?? {}); } catch { return '{}'; }
}

function parseMetadata(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function normalizeState(value: string): DeliveryState {
  if ((DELIVERY_STATES as readonly string[]).includes(value)) return value as DeliveryState;
  throw new Error(`Unsupported communication delivery state: ${value}`);
}

const STATE_ORDER: Record<DeliveryState, number> = {
  queued: 0,
  accepted: 1,
  submitted: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  failed: 6,
  undeliverable: 6,
  not_configured: 6,
  suppressed: 6,
};

function canAdvanceDeliveryState(current: DeliveryState, next: DeliveryState): boolean {
  if (current === next) return true;
  if (['failed', 'undeliverable', 'not_configured', 'suppressed', 'read'].includes(current)) return false;
  if (next === 'failed' || next === 'undeliverable' || next === 'not_configured' || next === 'suppressed') return true;
  return STATE_ORDER[next] >= STATE_ORDER[current];
}

function rowToDelivery(row: Record<string, unknown>): CommunicationDelivery {
  return {
    id: String(row.id),
    phone: String(row.phone),
    channel: String(row.channel),
    direction: String(row.direction) as DeliveryDirection,
    purpose: String(row.purpose || 'conversation_reply'),
    aggregateType: row.aggregate_type ? String(row.aggregate_type) : undefined,
    aggregateId: row.aggregate_id ? String(row.aggregate_id) : undefined,
    messageId: row.message_id == null ? undefined : Number(row.message_id),
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : undefined,
    providerReference: row.provider_reference ? String(row.provider_reference) : undefined,
    state: String(row.state) as DeliveryState,
    errorCode: row.error_code ? String(row.error_code) : undefined,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined,
    readAt: row.read_at ? String(row.read_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

async function ensureSchema(): Promise<any> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS communication_deliveries (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    channel TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
    purpose TEXT NOT NULL DEFAULT 'conversation_reply',
    aggregate_type TEXT,
    aggregate_id TEXT,
    message_id INTEGER,
    idempotency_key TEXT UNIQUE,
    provider_reference TEXT,
    state TEXT NOT NULL,
    error_code TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS channel_inbound_events (
    channel TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    verification_state TEXT NOT NULL DEFAULT 'not_verified',
    communication_delivery_id TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    PRIMARY KEY(channel, provider_event_id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_communication_deliveries_phone_created ON communication_deliveries(phone, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_communication_deliveries_state_created ON communication_deliveries(state, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_communication_deliveries_provider_reference ON communication_deliveries(channel, provider_reference)`);
  return db;
}

export async function createCommunicationDelivery(input: CreateDeliveryInput): Promise<CommunicationDelivery> {
  const phone = String(input.phone || '').trim();
  const channel = String(input.channel || '').trim().toLowerCase();
  if (!phone || !channel) throw new Error('A communication delivery requires a phone and channel');
  const db = await ensureSchema();
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;
  if (idempotencyKey) {
    const existing = db.prepare(`SELECT * FROM communication_deliveries WHERE idempotency_key = ? LIMIT 1`);
    existing.bind([idempotencyKey]);
    if (existing.step()) {
      const row = rowToDelivery(existing.getAsObject() as Record<string, unknown>);
      existing.free();
      return row;
    }
    existing.free();
  }

  const id = randomUUID();
  const state = normalizeState(input.state || (input.direction === 'inbound' ? 'accepted' : 'queued'));
  db.run(`INSERT INTO communication_deliveries
    (id, phone, channel, direction, purpose, aggregate_type, aggregate_id, message_id, idempotency_key, provider_reference, state, error_code, metadata_json, accepted_at, delivered_at, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN ('accepted', 'submitted', 'sent', 'delivered', 'read') THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN ? IN ('delivered', 'read') THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN ? = 'read' THEN CURRENT_TIMESTAMP ELSE NULL END)`, [
    id,
    phone,
    channel,
    input.direction,
    input.purpose?.trim() || 'conversation_reply',
    input.aggregateType?.trim() || null,
    input.aggregateId?.trim() || null,
    Number.isInteger(input.messageId) ? input.messageId : null,
    idempotencyKey || null,
    input.providerReference?.trim() || null,
    state,
    input.errorCode?.trim() || null,
    safeJson(input.metadata),
    state,
    state,
    state,
  ]);
  saveDb();
  return (await getCommunicationDelivery(id))!;
}

export async function getCommunicationDelivery(id: string): Promise<CommunicationDelivery | undefined> {
  const db = await ensureSchema();
  const stmt = db.prepare(`SELECT * FROM communication_deliveries WHERE id = ? LIMIT 1`);
  stmt.bind([id]);
  const result = stmt.step() ? rowToDelivery(stmt.getAsObject() as Record<string, unknown>) : undefined;
  stmt.free();
  return result;
}

export async function updateCommunicationDelivery(input: {
  id: string;
  state: DeliveryState;
  providerReference?: string;
  messageId?: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<CommunicationDelivery | undefined> {
  const db = await ensureSchema();
  const existing = await getCommunicationDelivery(input.id);
  if (!existing) return undefined;
  const state = normalizeState(input.state);
  if (!canAdvanceDeliveryState(existing.state, state)) return existing;
  const metadata = { ...(existing.metadata || {}), ...(input.metadata || {}) };
  db.run(`UPDATE communication_deliveries
    SET state = ?, provider_reference = COALESCE(?, provider_reference), message_id = COALESCE(?, message_id), error_code = ?, metadata_json = ?,
        accepted_at = CASE WHEN ? IN ('accepted', 'submitted', 'sent', 'delivered', 'read') AND accepted_at IS NULL THEN CURRENT_TIMESTAMP ELSE accepted_at END,
        delivered_at = CASE WHEN ? IN ('delivered', 'read') AND delivered_at IS NULL THEN CURRENT_TIMESTAMP ELSE delivered_at END,
        read_at = CASE WHEN ? = 'read' AND read_at IS NULL THEN CURRENT_TIMESTAMP ELSE read_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`, [
    state,
    input.providerReference?.trim() || null,
    Number.isInteger(input.messageId) ? input.messageId : null,
    input.errorCode?.trim() || null,
    safeJson(metadata),
    state,
    state,
    state,
    input.id,
  ]);
  const messageId = Number.isInteger(input.messageId) ? input.messageId : existing.messageId;
  if (Number.isInteger(messageId)) db.run(`UPDATE messages SET status = ? WHERE id = ?`, [state, messageId]);
  saveDb();
  return getCommunicationDelivery(input.id);
}

export async function updateDeliveryByProviderReference(input: {
  channel: string;
  providerReference: string;
  state: DeliveryState;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<CommunicationDelivery | undefined> {
  const db = await ensureSchema();
  const stmt = db.prepare(`SELECT id FROM communication_deliveries WHERE lower(channel) = lower(?) AND provider_reference = ? ORDER BY created_at DESC LIMIT 1`);
  stmt.bind([input.channel, input.providerReference]);
  const id = stmt.step() ? String(stmt.getAsObject().id) : undefined;
  stmt.free();
  if (!id) return undefined;
  return updateCommunicationDelivery({ id, state: input.state, errorCode: input.errorCode, metadata: input.metadata });
}

export async function claimInboundChannelEvent(input: {
  channel: string;
  providerEventId?: string;
  payload: unknown;
  verificationState: 'verified' | 'not_verified' | 'not_supported';
  phone?: string;
  purpose?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ duplicate: boolean; delivery?: CommunicationDelivery }> {
  const providerEventId = String(input.providerEventId || '').trim();
  if (!providerEventId) return { duplicate: false };
  const channel = String(input.channel || '').trim().toLowerCase();
  const db = await ensureSchema();
  const found = db.prepare(`SELECT communication_delivery_id FROM channel_inbound_events WHERE channel = ? AND provider_event_id = ? LIMIT 1`);
  found.bind([channel, providerEventId]);
  const existing = found.step() ? found.getAsObject() as Record<string, unknown> : undefined;
  found.free();
  if (existing) {
    const deliveryId = existing.communication_delivery_id ? String(existing.communication_delivery_id) : undefined;
    return { duplicate: true, delivery: deliveryId ? await getCommunicationDelivery(deliveryId) : undefined };
  }

  const delivery = input.phone ? await createCommunicationDelivery({
    phone: input.phone,
    channel,
    direction: 'inbound',
    purpose: input.purpose || 'conversation_inbound',
    providerReference: providerEventId,
    state: 'accepted',
    metadata: input.metadata,
  }) : undefined;
  const payloadDigest = createHash('sha256').update(JSON.stringify(input.payload ?? {})).digest('hex');
  db.run(`INSERT INTO channel_inbound_events (channel, provider_event_id, payload_digest, verification_state, communication_delivery_id, processed_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [channel, providerEventId, payloadDigest, input.verificationState, delivery?.id || null]);
  saveDb();
  return { duplicate: false, delivery };
}

export async function claimProviderCallbackEvent(input: {
  channel: string;
  callbackType: string;
  providerEventId?: string;
  payload: unknown;
  verificationState: 'verified' | 'not_verified' | 'not_supported';
}): Promise<{ duplicate: boolean }> {
  const providerEventId = String(input.providerEventId || '').trim();
  if (!providerEventId) return { duplicate: false };
  const result = await claimInboundChannelEvent({
    channel: `${String(input.channel || '').trim().toLowerCase()}:${String(input.callbackType || '').trim().toLowerCase()}`,
    providerEventId,
    payload: input.payload,
    verificationState: input.verificationState,
  });
  return { duplicate: result.duplicate };
}

export async function listCommunicationDeliveries(phone: string, limit = 50): Promise<CommunicationDelivery[]> {
  const db = await ensureSchema();
  const stmt = db.prepare(`SELECT * FROM communication_deliveries WHERE phone = ? ORDER BY created_at DESC LIMIT ?`);
  stmt.bind([phone, Math.min(Math.max(limit, 1), 100)]);
  const rows: CommunicationDelivery[] = [];
  while (stmt.step()) rows.push(rowToDelivery(stmt.getAsObject() as Record<string, unknown>));
  stmt.free();
  return rows;
}
