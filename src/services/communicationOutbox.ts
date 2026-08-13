import { dispatchOutboundTransport } from '../channels/outboundTransports.js';
import { getDb, saveDb } from '../database.js';
import {
  CommunicationDelivery,
  getCommunicationDelivery,
  updateCommunicationDelivery,
} from './communicationDelivery.js';
import { recordChannelUsage } from './channelUsageService.js';

export type CommunicationConsentState = 'granted' | 'denied';
export type OutboxDispatchState = 'queued' | 'leased' | 'retry_scheduled' | 'completed' | 'failed' | 'suppressed' | 'not_configured';

interface OutboxPayload {
  text: string;
  metadata?: Record<string, unknown>;
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value ?? {}); } catch { return '{}'; }
}

function parseJson(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function dueAfterAttempts(attempts: number): string {
  const delaySeconds = Math.min(15 * 60, 15 * (2 ** Math.max(0, attempts - 1)));
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function isExternalChannel(channel: string): boolean {
  return ['sms', 'whatsapp', 'telegram'].includes(String(channel || '').toLowerCase());
}

function normalisePurpose(value: string | undefined): string {
  return String(value || 'conversation_reply').trim().toLowerCase() || 'conversation_reply';
}

export async function recordCommunicationConsent(input: {
  phone: string;
  channel: string;
  purpose?: string;
  state: CommunicationConsentState;
  source: string;
  expiresAt?: string;
}): Promise<void> {
  const phone = String(input.phone || '').trim();
  const channel = String(input.channel || '').trim().toLowerCase();
  const purpose = normalisePurpose(input.purpose);
  if (!phone || !channel) throw new Error('Communication consent requires a phone and channel');
  const db = await getDb();
  db.run(`INSERT INTO communication_preferences (phone, channel, purpose, consent_state, source, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(phone, channel, purpose) DO UPDATE SET
      consent_state = excluded.consent_state,
      source = excluded.source,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP`, [phone, channel, purpose, input.state, String(input.source || 'account_setting').slice(0, 120), input.expiresAt || null]);
  saveDb();
}

export async function listCommunicationConsents(phone: string): Promise<Array<{ channel: string; purpose: string; state: CommunicationConsentState; source: string; expiresAt?: string }>> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT channel, purpose, consent_state, source, expires_at FROM communication_preferences WHERE phone = ? ORDER BY channel, purpose`);
  stmt.bind([phone]);
  const entries: Array<{ channel: string; purpose: string; state: CommunicationConsentState; source: string; expiresAt?: string }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    entries.push({ channel: String(row.channel), purpose: String(row.purpose), state: String(row.consent_state) as CommunicationConsentState, source: String(row.source), expiresAt: row.expires_at ? String(row.expires_at) : undefined });
  }
  stmt.free();
  return entries;
}

async function effectiveConsent(delivery: CommunicationDelivery): Promise<{ allowed: boolean; reason?: string }> {
  if (!isExternalChannel(delivery.channel)) return { allowed: true };
  const metadata = delivery.metadata || {};
  const purpose = normalisePurpose(delivery.purpose);
  const db = await getDb();
  const stmt = db.prepare(`SELECT purpose, consent_state, expires_at FROM communication_preferences
    WHERE phone = ? AND channel = ? AND purpose IN (?, 'all')
    ORDER BY CASE purpose WHEN ? THEN 0 ELSE 1 END LIMIT 1`);
  stmt.bind([delivery.phone, delivery.channel, purpose, purpose]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, unknown> : undefined;
  stmt.free();
  if (row) {
    const expiresAt = row.expires_at ? Date.parse(String(row.expires_at)) : NaN;
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return { allowed: false, reason: 'consent_expired' };
    return row.consent_state === 'granted' ? { allowed: true } : { allowed: false, reason: 'consent_denied' };
  }
  if (purpose === 'conversation_reply' && metadata.reply_to_inbound === true) return { allowed: true };
  return { allowed: false, reason: 'consent_required' };
}

export async function enqueueCommunicationOutbox(input: {
  deliveryId: string;
  text: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<OutboxDispatchState> {
  const delivery = await getCommunicationDelivery(input.deliveryId);
  if (!delivery) throw new Error('Communication delivery not found');
  if (delivery.direction !== 'outbound') throw new Error('Only outbound communication deliveries can enter the outbox');
  const consent = await effectiveConsent({ ...delivery, metadata: { ...(delivery.metadata || {}), ...(input.metadata || {}) } });
  const db = await getDb();
  if (!consent.allowed) {
    await updateCommunicationDelivery({ id: delivery.id, state: 'suppressed', errorCode: consent.reason, metadata: { consent: consent.reason } });
    db.run(`INSERT INTO communication_outbox (delivery_id, payload_json, dispatch_state, attempts, max_attempts, last_error)
      VALUES (?, ?, 'suppressed', 0, ?, ?)
      ON CONFLICT(delivery_id) DO UPDATE SET dispatch_state='suppressed', last_error=excluded.last_error, updated_at=CURRENT_TIMESTAMP`, [delivery.id, safeJson({ text: input.text, metadata: input.metadata }), Math.max(1, Math.min(8, Number(input.maxAttempts || 3))), consent.reason || 'consent_denied']);
    saveDb();
    return 'suppressed';
  }
  db.run(`INSERT INTO communication_outbox (delivery_id, payload_json, dispatch_state, attempts, max_attempts, next_attempt_at)
    VALUES (?, ?, 'queued', 0, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(delivery_id) DO NOTHING`, [delivery.id, safeJson({ text: input.text, metadata: input.metadata }), Math.max(1, Math.min(8, Number(input.maxAttempts || 3)))]);
  saveDb();
  return 'queued';
}

async function claimDueOutboxRows(limit: number): Promise<Array<{ deliveryId: string; attempts: number; maxAttempts: number; payload: OutboxPayload }>> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT delivery_id, attempts, max_attempts, payload_json FROM communication_outbox
    WHERE (dispatch_state IN ('queued', 'retry_scheduled') AND datetime(next_attempt_at) <= datetime('now'))
       OR (dispatch_state = 'leased' AND datetime(lease_expires_at) <= datetime('now'))
    ORDER BY created_at ASC LIMIT ?`);
  stmt.bind([Math.max(1, Math.min(50, limit))]);
  const candidates: Array<{ deliveryId: string; attempts: number; maxAttempts: number; payload: OutboxPayload }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const parsedPayload = parseJson(row.payload_json);
    const payload: OutboxPayload = {
      text: typeof parsedPayload.text === 'string' ? parsedPayload.text : '',
      metadata: parsedPayload.metadata && typeof parsedPayload.metadata === 'object' && !Array.isArray(parsedPayload.metadata) ? parsedPayload.metadata as Record<string, unknown> : undefined,
    };
    if (!payload.text.trim()) continue;
    candidates.push({ deliveryId: String(row.delivery_id), attempts: Number(row.attempts || 0), maxAttempts: Number(row.max_attempts || 3), payload });
  }
  stmt.free();
  const claimed: typeof candidates = [];
  for (const candidate of candidates) {
    const leaseExpiresAt = new Date(Date.now() + 60_000).toISOString();
    db.run(`UPDATE communication_outbox SET dispatch_state='leased', lease_expires_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE delivery_id=? AND (dispatch_state IN ('queued', 'retry_scheduled') OR (dispatch_state='leased' AND datetime(lease_expires_at) <= datetime('now')))`, [leaseExpiresAt, candidate.deliveryId]);
    if (db.getRowsModified() === 1) claimed.push(candidate);
  }
  if (claimed.length) saveDb();
  return claimed;
}

async function completeOutboxAttempt(item: { deliveryId: string; attempts: number; maxAttempts: number; payload: OutboxPayload }): Promise<OutboxDispatchState> {
  const delivery = await getCommunicationDelivery(item.deliveryId);
  if (!delivery) return 'failed';
  const db = await getDb();
  const consent = await effectiveConsent(delivery);
  if (!consent.allowed) {
    await updateCommunicationDelivery({ id: delivery.id, state: 'suppressed', errorCode: consent.reason, metadata: { consent: consent.reason } });
    db.run(`UPDATE communication_outbox SET dispatch_state='suppressed', lease_expires_at=NULL, last_error=?, updated_at=CURRENT_TIMESTAMP WHERE delivery_id=?`, [consent.reason || 'consent_denied', delivery.id]);
    saveDb();
    return 'suppressed';
  }
  const result = await dispatchOutboundTransport(delivery.channel, delivery.phone, item.payload.text, item.payload.metadata || {});
  const attempt = item.attempts + 1;
  if (result.state === 'accepted') {
    await updateCommunicationDelivery({ id: delivery.id, state: 'accepted', providerReference: result.providerReference, errorCode: undefined, metadata: { ...(result.metadata || {}), outbox_attempts: attempt } });
    db.run(`UPDATE communication_outbox SET dispatch_state='completed', attempts=?, lease_expires_at=NULL, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE delivery_id=?`, [attempt, delivery.id]);
    await recordChannelUsage({ phone: delivery.phone, channel: delivery.channel, direction: 'outbound', providerReference: result.providerReference, conversationId: typeof item.payload.metadata?.conversationId === 'string' ? item.payload.metadata.conversationId : undefined, metadata: { source: 'communication_outbox', delivery: 'accepted', external_delivery_confirmed: false } });
    saveDb();
    return 'completed';
  }
  if (result.state === 'not_configured') {
    await updateCommunicationDelivery({ id: delivery.id, state: 'not_configured', errorCode: result.errorCode, metadata: { ...(result.metadata || {}), outbox_attempts: attempt } });
    db.run(`UPDATE communication_outbox SET dispatch_state='not_configured', attempts=?, lease_expires_at=NULL, last_error=?, updated_at=CURRENT_TIMESTAMP WHERE delivery_id=?`, [attempt, result.errorCode || 'not_configured', delivery.id]);
    saveDb();
    return 'not_configured';
  }
  if (attempt >= item.maxAttempts) {
    await updateCommunicationDelivery({ id: delivery.id, state: 'failed', providerReference: result.providerReference, errorCode: result.errorCode, metadata: { ...(result.metadata || {}), outbox_attempts: attempt } });
    db.run(`UPDATE communication_outbox SET dispatch_state='failed', attempts=?, lease_expires_at=NULL, last_error=?, updated_at=CURRENT_TIMESTAMP WHERE delivery_id=?`, [attempt, result.errorCode || 'dispatch_failed', delivery.id]);
    saveDb();
    return 'failed';
  }
  await updateCommunicationDelivery({ id: delivery.id, state: 'queued', providerReference: result.providerReference, errorCode: result.errorCode, metadata: { ...(result.metadata || {}), outbox_attempts: attempt, last_attempt_state: 'failed', retry_scheduled: true } });
  db.run(`UPDATE communication_outbox SET dispatch_state='retry_scheduled', attempts=?, next_attempt_at=?, lease_expires_at=NULL, last_error=?, updated_at=CURRENT_TIMESTAMP WHERE delivery_id=?`, [attempt, dueAfterAttempts(attempt), result.errorCode || 'dispatch_failed', delivery.id]);
  saveDb();
  return 'retry_scheduled';
}

export async function dispatchDueCommunicationOutbox(limit = 20): Promise<Record<OutboxDispatchState, number>> {
  const totals: Record<OutboxDispatchState, number> = { queued: 0, leased: 0, retry_scheduled: 0, completed: 0, failed: 0, suppressed: 0, not_configured: 0 };
  if (process.env.KURUKOO_COMMUNICATION_OUTBOX_ENABLED === 'false') return totals;
  const rows = await claimDueOutboxRows(limit);
  for (const row of rows) totals[await completeOutboxAttempt(row)] += 1;
  return totals;
}

export function startCommunicationOutboxWorker(): void {
  if (process.env.KURUKOO_COMMUNICATION_OUTBOX_ENABLED === 'false') return;
  const intervalMs = Math.max(10_000, Math.min(5 * 60_000, Number(process.env.KURUKOO_COMMUNICATION_OUTBOX_INTERVAL_MS || 30_000)));
  const run = () => dispatchDueCommunicationOutbox().catch((error) => console.error('[Communication Outbox] Dispatch pass failed:', error));
  void run();
  setInterval(run, intervalMs);
}
