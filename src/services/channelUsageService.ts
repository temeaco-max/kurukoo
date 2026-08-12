import { getDb, saveDb } from '../database.js';

export type ChannelUsageDirection = 'inbound' | 'outbound';

export interface ChannelUsageEvent {
  phone?: string;
  channel: string;
  direction: ChannelUsageDirection;
  units?: number;
  estimatedCostMinor?: number;
  currency?: string;
  providerReference?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

/**
 * Records transport usage without assigning monetary value to Points.
 * Provider adapters can report an external charge estimate/reference when known;
 * otherwise the event is explicitly unpriced and remains useful for later billing
 * and connector-cost reconciliation.
 */
export async function recordChannelUsage(event: ChannelUsageEvent): Promise<number> {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS channel_usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT,
      channel TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
      units INTEGER NOT NULL DEFAULT 1,
      estimated_cost_minor INTEGER,
      currency TEXT,
      provider_reference TEXT,
      conversation_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_channel_usage_channel_created ON channel_usage_events(channel, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_channel_usage_phone_created ON channel_usage_events(phone, created_at)`);

  const units = Number.isInteger(event.units) && Number(event.units) > 0 ? Number(event.units) : 1;
  const estimatedCostMinor = Number.isInteger(event.estimatedCostMinor) && Number(event.estimatedCostMinor) >= 0
    ? Number(event.estimatedCostMinor)
    : null;
  const currency = typeof event.currency === 'string' && event.currency.trim()
    ? event.currency.trim().toUpperCase()
    : null;
  const providerReference = typeof event.providerReference === 'string' && event.providerReference.trim()
    ? event.providerReference.trim()
    : null;

  const stmt = db.prepare(`
    INSERT INTO channel_usage_events
      (phone, channel, direction, units, estimated_cost_minor, currency, provider_reference, conversation_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    event.phone ?? null,
    event.channel,
    event.direction,
    units,
    estimatedCostMinor,
    currency,
    providerReference,
    event.conversationId ?? null,
    safeJson(event.metadata)
  ]);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  saveDb();
  return Number(row.id);
}

export async function getChannelUsageSummary(phone?: string): Promise<{
  events: number;
  units: number;
  estimatedCostMinor: number;
  pricedEvents: number;
  unpricedEvents: number;
}> {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS channel_usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT,
      channel TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
      units INTEGER NOT NULL DEFAULT 1,
      estimated_cost_minor INTEGER,
      currency TEXT,
      provider_reference TEXT,
      conversation_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const stmt = db.prepare(`
    SELECT
      COUNT(*) AS events,
      COALESCE(SUM(units), 0) AS units,
      COALESCE(SUM(CASE WHEN estimated_cost_minor IS NULL THEN 0 ELSE estimated_cost_minor END), 0) AS estimated_cost_minor,
      COALESCE(SUM(CASE WHEN estimated_cost_minor IS NULL THEN 0 ELSE 1 END), 0) AS priced_events,
      COALESCE(SUM(CASE WHEN estimated_cost_minor IS NULL THEN 1 ELSE 0 END), 0) AS unpriced_events
    FROM channel_usage_events
    ${phone ? 'WHERE phone = ?' : ''}
  `);
  if (phone) stmt.bind([phone]);
  stmt.step();
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return {
    events: Number(row.events || 0),
    units: Number(row.units || 0),
    estimatedCostMinor: Number(row.estimated_cost_minor || 0),
    pricedEvents: Number(row.priced_events || 0),
    unpricedEvents: Number(row.unpriced_events || 0)
  };
}
