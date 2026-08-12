import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';

export const PILOT_EVENT_NAMES = [
  'conversation_started', 'conversation_resumed', 'guest_auth_started', 'guest_auth_completed', 'guest_auth_failed',
  'request_started', 'request_requirement_missing', 'request_requirement_completed', 'request_created', 'request_cancelled',
  'request_abandoned', 'request_recovered', 'provider_search_started', 'provider_search_empty', 'quote_unavailable',
  'payment_unavailable', 'fulfilment_unavailable', 'qr_arrival', 'voice_started', 'voice_failed', 'voice_ended',
  'voice_fallback', 'reminder_created', 'reminder_completed', 'memory_viewed', 'memory_updated', 'notification_created',
  'notification_failed', 'agent_goal_created', 'agent_goal_waiting', 'agent_goal_cancelled', 'agent_goal_failed',
  'error_boundary', 'rate_limit_hit', 'offline_detected', 'offline_recovered', 'session_restored', 'logout', 'account_deleted',
  'feedback_submitted',
] as const;

export type PilotEventName = typeof PILOT_EVENT_NAMES[number];
export type PilotEventStatus = 'ok' | 'failed' | 'blocked' | 'unavailable' | 'started' | 'completed';

const eventSet = new Set<string>(PILOT_EVENT_NAMES);
const allowedContextKeys = new Set([
  'channel', 'source', 'intent', 'reason', 'route', 'error_class', 'capability', 'status', 'rating', 'category',
  'duration_seconds', 'count', 'retryable', 'external_configured', 'http_status', 'surface',
]);

function hashIdentifier(value?: string | null): string | null {
  if (!value) return null;
  const salt = process.env.KURUKOO_PILOT_EVENT_SALT || process.env.JWT_SECRET || 'development-pilot-event-salt';
  return crypto.createHash('sha256').update(`${salt}:${String(value).slice(0, 256)}`).digest('hex').slice(0, 32);
}

function sanitizeFeedbackNote(input?: string | null): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted-phone]')
    .replace(/\b(?:otp|code|pin)\s*[:=-]?\s*\d{4,8}\b/gi, '[redacted-code]')
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted-token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
    .trim().slice(0, 500);
  return cleaned || null;
}

function boundedContext(input?: Record<string, unknown>): string {
  if (!input) return '{}';
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedContextKeys.has(key)) continue;
    if (typeof value === 'string') output[key] = value.slice(0, 120);
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean') output[key] = value;
  }
  return JSON.stringify(output).slice(0, 900);
}

export async function ensurePilotObservabilitySchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS pilot_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    owner_hash TEXT,
    session_hash TEXT,
    conversation_id TEXT,
    request_id TEXT,
    status TEXT NOT NULL DEFAULT 'ok',
    context_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_pilot_events_name_created ON pilot_events(event_name, created_at);
  CREATE INDEX IF NOT EXISTS idx_pilot_events_owner_created ON pilot_events(owner_hash, created_at);
  CREATE TABLE IF NOT EXISTS pilot_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_hash TEXT,
    session_hash TEXT,
    conversation_id TEXT,
    message_id INTEGER,
    request_id TEXT,
    rating TEXT NOT NULL CHECK(rating IN ('helpful', 'not_helpful', 'something_wrong')),
    note TEXT,
    context_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_pilot_feedback_created ON pilot_feedback(created_at);
  `);
}

export async function emitPilotEvent(input: {
  event: string;
  ownerId?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  requestId?: string | null;
  status?: PilotEventStatus;
  context?: Record<string, unknown>;
}): Promise<void> {
  if (!eventSet.has(input.event)) return;
  try {
    await ensurePilotObservabilitySchema();
    const db = await getDb();
    db.run(`INSERT INTO pilot_events(event_name, owner_hash, session_hash, conversation_id, request_id, status, context_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      input.event,
      hashIdentifier(input.ownerId),
      hashIdentifier(input.sessionId),
      input.conversationId ? String(input.conversationId).slice(0, 120) : null,
      input.requestId ? String(input.requestId).slice(0, 120) : null,
      input.status || 'ok',
      boundedContext(input.context),
    ]);
    saveDb();
  } catch (error) {
    console.warn('[PilotObservability] event write unavailable:', error instanceof Error ? error.name : 'unknown');
  }
}

export async function recordPilotFeedback(input: {
  ownerId?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  messageId?: number | null;
  requestId?: string | null;
  rating: 'helpful' | 'not_helpful' | 'something_wrong';
  note?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  await ensurePilotObservabilitySchema();
  const db = await getDb();
  const note = sanitizeFeedbackNote(input.note);
  db.run(`INSERT INTO pilot_feedback(owner_hash, session_hash, conversation_id, message_id, request_id, rating, note, context_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    hashIdentifier(input.ownerId),
    hashIdentifier(input.sessionId),
    input.conversationId ? String(input.conversationId).slice(0, 120) : null,
    Number.isInteger(input.messageId) ? input.messageId : null,
    input.requestId ? String(input.requestId).slice(0, 120) : null,
    input.rating,
    note,
    boundedContext(input.context),
  ]);
  saveDb();
  await emitPilotEvent({
    event: 'feedback_submitted',
    ownerId: input.ownerId,
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    requestId: input.requestId,
    context: { rating: input.rating, surface: 'conversation' },
  });
}

function countByEvent(db: any, eventNames: string[], days: number): Record<string, number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const output: Record<string, number> = {};
  for (const name of eventNames) {
    const rows = db.exec(`SELECT COUNT(*) FROM pilot_events WHERE event_name = ? AND created_at >= ?`, [name, since]);
    output[name] = Number(rows[0]?.values?.[0]?.[0] || 0);
  }
  return output;
}

export async function getPilotFeedbackSummary(days = 30): Promise<Array<Record<string, unknown>>> {
  await ensurePilotObservabilitySchema();
  const db = await getDb();
  const boundedDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare(`SELECT id, conversation_id, request_id, rating, note, context_json, created_at FROM pilot_feedback WHERE created_at >= ? ORDER BY id DESC LIMIT 50`);
  stmt.bind([since]);
  const rows: Array<Record<string, unknown>> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    let context: Record<string, unknown> = {};
    try { context = JSON.parse(String(row.context_json || '{}')); } catch {}
    rows.push({ id: row.id, rating: row.rating, note: row.note, context, created_at: row.created_at });
  }
  stmt.free();
  return rows;
}

export async function getPilotDashboard(days = 30): Promise<Record<string, unknown>> {
  await ensurePilotObservabilitySchema();
  const db = await getDb();
  const boundedDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const eventNames = [...PILOT_EVENT_NAMES];
  const events = countByEvent(db, eventNames, boundedDays);
  const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000).toISOString();
  const feedbackRows = db.exec(`SELECT rating, COUNT(*) FROM pilot_feedback WHERE created_at >= ? GROUP BY rating`, [since]);
  const feedback: Record<string, number> = {};
  for (const row of feedbackRows[0]?.values || []) feedback[String(row[0])] = Number(row[1]);
  const users = db.exec(`SELECT COUNT(DISTINCT owner_hash) FROM pilot_events WHERE owner_hash IS NOT NULL AND created_at >= ?`, [since]);
  const sessions = db.exec(`SELECT COUNT(DISTINCT session_hash) FROM pilot_events WHERE session_hash IS NOT NULL AND created_at >= ?`, [since]);
  const totalEvents = db.exec(`SELECT COUNT(*) FROM pilot_events WHERE created_at >= ?`, [since]);
  const failedEvents = db.exec(`SELECT COUNT(*) FROM pilot_events WHERE created_at >= ? AND status IN ('failed','blocked','unavailable')`, [since]);
  const total = Number(totalEvents[0]?.values?.[0]?.[0] || 0);
  const failed = Number(failedEvents[0]?.values?.[0]?.[0] || 0);
  return {
    window_days: boundedDays,
    days: boundedDays,
    generated_at: new Date().toISOString(),
    aggregate_only: true,
    users: { observed_pseudonymous_users: Number(users[0]?.values?.[0]?.[0] || 0), sessions: Number(sessions[0]?.values?.[0]?.[0] || 0) },
    total_events: total,
    failed_events: failed,
    failure_rate: total ? failed / total : 0,
    events,
    by_event: events,
    feedback,
    cost_counters: {
      voice_sessions: events.voice_started || 0,
      agent_goals: events.agent_goal_created || 0,
      rate_limit_events: events.rate_limit_hit || 0,
      payment_attempts: events.payment_unavailable || 0,
    },
    unavailable_metrics: ['precise monetary cost', 'provider billing', 'real-world fulfilment rate'],
  };
}
