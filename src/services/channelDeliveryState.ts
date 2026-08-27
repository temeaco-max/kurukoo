import { getCanonicalStore } from './canonicalStore.js';

export type ChannelDeliveryStatus =
  | 'planned'
  | 'attempted'
  | 'accepted'
  | 'submitted'
  | 'buffered'
  | 'delivered'
  | 'failed'
  | 'rejected'
  | 'unknown';

export interface ChannelDeliveryState {
  channel: string;
  provider: string;
  providerMessageId: string;
  phone?: string;
  status: ChannelDeliveryStatus;
  failureReason?: string;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function normalizeProviderStatus(value: unknown): ChannelDeliveryStatus {
  const status = String(value || '').trim().toLowerCase();
  if (['success', 'delivered'].includes(status)) return 'delivered';
  if (['sent', 'submitted'].includes(status)) return 'submitted';
  if (status === 'buffered') return 'buffered';
  if (['failed', 'absentsubscriber', 'expired'].includes(status)) return 'failed';
  if (status === 'rejected') return 'rejected';
  if (['accepted', 'queued'].includes(status)) return 'accepted';
  if (status === 'attempted') return 'attempted';
  if (status === 'planned') return 'planned';
  return 'unknown';
}

function parseRaw(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function ensureChannelDeliverySchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS channel_delivery_states (
    channel TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL,
    failure_reason TEXT,
    raw_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(channel, provider, provider_message_id)
  )`);
}

export async function recordChannelDispatch(input: {
  channel: string;
  provider: string;
  providerMessageId?: string;
  phone?: string;
  status?: string;
  raw?: Record<string, unknown>;
}): Promise<ChannelDeliveryState | null> {
  const providerMessageId = String(input.providerMessageId || '').trim();
  if (!providerMessageId) return null;
  await ensureChannelDeliverySchema();
  const store = await getCanonicalStore();
  const status = normalizeProviderStatus(input.status || 'accepted');
  await store.run(`INSERT INTO channel_delivery_states(channel,provider,provider_message_id,phone,status,raw_json)
    VALUES(?,?,?,?,?,?) ON CONFLICT(channel,provider,provider_message_id) DO UPDATE SET
      phone=COALESCE(excluded.phone,channel_delivery_states.phone),
      status=excluded.status,
      raw_json=excluded.raw_json,
      updated_at=CURRENT_TIMESTAMP`, [input.channel, input.provider, providerMessageId, input.phone || null, status, JSON.stringify(input.raw || {})]);
  return getChannelDeliveryState(input.channel, input.provider, providerMessageId);
}

export async function recordChannelDeliveryReport(input: {
  channel: string;
  provider: string;
  providerMessageId: string;
  phone?: string;
  status?: string;
  failureReason?: string;
  raw?: Record<string, unknown>;
}): Promise<ChannelDeliveryState | null> {
  const providerMessageId = String(input.providerMessageId || '').trim();
  if (!providerMessageId) return null;
  await ensureChannelDeliverySchema();
  const store = await getCanonicalStore();
  const status = normalizeProviderStatus(input.status);
  await store.run(`INSERT INTO channel_delivery_states(channel,provider,provider_message_id,phone,status,failure_reason,raw_json)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(channel,provider,provider_message_id) DO UPDATE SET
      phone=COALESCE(excluded.phone,channel_delivery_states.phone),
      status=excluded.status,
      failure_reason=excluded.failure_reason,
      raw_json=excluded.raw_json,
      updated_at=CURRENT_TIMESTAMP`, [input.channel, input.provider, providerMessageId, input.phone || null, status, input.failureReason || null, JSON.stringify(input.raw || {})]);
  return getChannelDeliveryState(input.channel, input.provider, providerMessageId);
}

export async function getChannelDeliveryState(channel: string, provider: string, providerMessageId: string): Promise<ChannelDeliveryState | null> {
  await ensureChannelDeliverySchema();
  const row = await (await getCanonicalStore()).one<any>('SELECT * FROM channel_delivery_states WHERE channel=? AND provider=? AND provider_message_id=? LIMIT 1', [channel, provider, providerMessageId]);
  if (!row) return null;
  return {
    channel: String(row.channel),
    provider: String(row.provider),
    providerMessageId: String(row.provider_message_id),
    phone: row.phone ? String(row.phone) : undefined,
    status: normalizeProviderStatus(row.status),
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    raw: parseRaw(row.raw_json),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function normalizeChannelDeliveryStatus(status: unknown): ChannelDeliveryStatus {
  return normalizeProviderStatus(status);
}
