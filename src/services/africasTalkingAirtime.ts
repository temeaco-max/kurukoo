import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';
import { sendFcmPush } from './pushNotifications.js';

export interface AirtimeActivation {
  requestId: string;
  providerRequestId?: string;
  recipientPhone: string;
  amountMinor: number;
  currency: string;
  status: 'submitted' | 'accepted' | 'delivered' | 'failed';
  message: string;
}

interface AirtimeRow {
  provider_request_id: string;
  economic_request_id: string;
  owner_phone: string;
  recipient_phone: string;
  amount_minor: number;
  currency: string;
  status: string;
  raw_json: string;
}

function configuredValue(value: unknown): string {
  const result = String(value || '').trim();
  if (!result || ['stub', 'placeholder', '<secret>'].includes(result.toLowerCase())) return '';
  return result;
}

function baseUrl(username: string): string {
  const configured = String(process.env.AFRICASTALKING_API_BASE || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return username.toLowerCase() === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
}

function normalizedPhone(value: unknown): string {
  const phone = String(value || '').trim().replace(/[\s()-]/g, '');
  if (!/^\+?\d{8,16}$/.test(phone)) throw new Error('An international-format recipient phone is required.');
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function amountText(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 5_000 || amountMinor > 2_000_000) {
    throw new Error('Nigeria airtime must be between NGN 50 and NGN 20,000.');
  }
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

function amountFromProvider(value: unknown): { amountMinor: number; currency: string } | null {
  const match = String(value || '').trim().match(/^([A-Z]{3})\s+(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const amountMinor = Math.round(Number(match[2]) * 100);
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? { currency: match[1].toUpperCase(), amountMinor } : null;
}

function callbackTokenMatches(value: unknown): boolean {
  const expected = configuredValue(process.env.AFRICASTALKING_AIRTIME_CALLBACK_TOKEN);
  const supplied = String(value || '').trim();
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ensureAirtimeTable() {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS airtime_activations (
    provider_request_id TEXT PRIMARY KEY,
    economic_request_id TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    raw_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}

function toRow(record: Record<string, unknown>): AirtimeRow {
  return {
    provider_request_id: String(record.provider_request_id || ''),
    economic_request_id: String(record.economic_request_id || ''),
    owner_phone: String(record.owner_phone || ''),
    recipient_phone: String(record.recipient_phone || ''),
    amount_minor: Number(record.amount_minor || 0),
    currency: String(record.currency || ''),
    status: String(record.status || ''),
    raw_json: String(record.raw_json || '{}'),
  };
}

async function activationByProviderId(providerRequestId: string): Promise<AirtimeRow | null> {
  const db = await ensureAirtimeTable();
  const statement = db.prepare('SELECT provider_request_id,economic_request_id,owner_phone,recipient_phone,amount_minor,currency,status,raw_json FROM airtime_activations WHERE provider_request_id=?');
  statement.bind([providerRequestId]);
  const row = statement.step() ? toRow(statement.getAsObject() as Record<string, unknown>) : null;
  statement.free();
  return row;
}

async function activationForRequest(requestId: string): Promise<AirtimeRow | null> {
  const db = await ensureAirtimeTable();
  const statement = db.prepare('SELECT provider_request_id,economic_request_id,owner_phone,recipient_phone,amount_minor,currency,status,raw_json FROM airtime_activations WHERE economic_request_id=? ORDER BY created_at DESC LIMIT 1');
  statement.bind([requestId]);
  const row = statement.step() ? toRow(statement.getAsObject() as Record<string, unknown>) : null;
  statement.free();
  return row;
}

function statusFromProvider(value: unknown): 'accepted' | 'failed' {
  return /^sent$/i.test(String(value || '').trim()) ? 'accepted' : 'failed';
}

export function airtimeAvailability(): { available: boolean; reason?: string; provider: 'africastalking'; callbackProtected: boolean } {
  if (process.env.FF_AIRTIME !== 'true') return { available: false, reason: 'airtime_feature_disabled', provider: 'africastalking', callbackProtected: false };
  if (!configuredValue(process.env.AFRICASTALKING_API_KEY) || !configuredValue(process.env.AFRICASTALKING_USERNAME)) return { available: false, reason: 'airtime_provider_not_configured', provider: 'africastalking', callbackProtected: false };
  return { available: true, provider: 'africastalking', callbackProtected: Boolean(configuredValue(process.env.AFRICASTALKING_AIRTIME_CALLBACK_TOKEN)) };
}

/**
 * Submit a paid canonical airtime request. A provider response of `Sent` only
 * means Africa's Talking accepted the instruction; a matching protected status
 * callback is still required before the request is marked fulfilled.
 */
export async function submitAirtimeActivation(input: { ownerPhone: string; requestId: string; recipientPhone: string; amountMinor: number; currency?: string; idempotencyKey: string }): Promise<AirtimeActivation> {
  const availability = airtimeAvailability();
  if (!availability.available) throw new Error(availability.reason || 'Airtime activation is unavailable.');
  const ownerPhone = normalizedPhone(input.ownerPhone);
  const requestId = String(input.requestId || '').trim();
  const recipientPhone = normalizedPhone(input.recipientPhone);
  const currency = String(input.currency || 'NGN').trim().toUpperCase();
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!requestId || !idempotencyKey) throw new Error('An Economic Request and idempotency key are required.');
  if (currency !== 'NGN') throw new Error('Nigeria airtime is currently available in NGN only.');
  const request = await getEconomicRequest(requestId);
  if (!request || request.phone !== ownerPhone || request.skill !== 'buy_airtime') throw new Error('A matching owner-owned airtime Economic Request is required.');
  const fulfillment = request.fulfillment && typeof request.fulfillment === 'object' ? request.fulfillment as Record<string, unknown> : {};
  if (fulfillment.payment_verified !== true || !['paid', 'in_fulfillment'].includes(request.status)) throw new Error('Verified payment is required before airtime can be submitted.');
  const existing = await activationForRequest(requestId);
  if (existing) return { requestId, providerRequestId: existing.provider_request_id, recipientPhone: existing.recipient_phone, amountMinor: existing.amount_minor, currency: existing.currency, status: existing.status as AirtimeActivation['status'], message: 'This airtime activation was already submitted. Delivery remains subject to provider status evidence.' };

  const apiKey = configuredValue(process.env.AFRICASTALKING_API_KEY);
  const username = configuredValue(process.env.AFRICASTALKING_USERNAME);
  const body = { username, recipients: [{ phoneNumber: recipientPhone, amount: amountText(input.amountMinor, currency) }], maxNumRetry: 0, requestMetadata: { economicRequestId: requestId, owner: ownerPhone.slice(-6) } };
  const response = await fetch(`${baseUrl(username)}/version1/airtime/send`, { method: 'POST', headers: { apiKey, 'Idempotency-Key': idempotencyKey.slice(0, 180), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  const item = Array.isArray(payload.responses) ? payload.responses[0] : undefined;
  const providerStatus = statusFromProvider(item?.status);
  const providerRequestId = String(item?.requestId || '').trim();
  if (!response.ok || !providerRequestId || providerStatus === 'failed') {
    await transitionEconomicRequest(requestId, request.status, { fulfillment: { ...fulfillment, airtime_status: 'submission_failed', airtime_failure_reason: String(item?.errorMessage || payload.errorMessage || `provider_http_${response.status}`).slice(0, 240), airtime_submission_at: new Date().toISOString() } });
    return { requestId, recipientPhone, amountMinor: input.amountMinor, currency, status: 'failed', message: 'The airtime provider did not accept this activation. No delivery has been recorded.' };
  }
  const db = await ensureAirtimeTable();
  db.run('INSERT INTO airtime_activations(provider_request_id,economic_request_id,owner_phone,recipient_phone,amount_minor,currency,status,raw_json) VALUES(?,?,?,?,?,?,?,?)', [providerRequestId, requestId, ownerPhone, recipientPhone, input.amountMinor, currency, 'accepted', JSON.stringify({ submitted: payload })]);
  saveDb();
  await transitionEconomicRequest(requestId, request.status === 'paid' ? 'in_fulfillment' : request.status, { fulfillment: { ...fulfillment, airtime_provider: 'africastalking', airtime_provider_request_id: providerRequestId, airtime_recipient_phone: recipientPhone, airtime_amount_minor: input.amountMinor, airtime_currency: currency, airtime_status: 'accepted_awaiting_delivery_evidence', airtime_submitted_at: new Date().toISOString() } });
  return { requestId, providerRequestId, recipientPhone, amountMinor: input.amountMinor, currency, status: 'accepted', message: 'Airtime instruction was accepted by the provider. Delivery is not yet confirmed.' };
}

/** Records a protected, correlated provider delivery report and then updates the existing Economic Request. */
export async function recordAirtimeDeliveryReport(input: { callbackToken: string; providerRequestId: string; recipientPhone: string; status: string; value: string; description?: string; discount?: string }): Promise<{ accepted: boolean; status: 'delivered' | 'failed' | 'ignored'; requestId?: string; message: string }> {
  if (!callbackTokenMatches(input.callbackToken)) return { accepted: false, status: 'ignored', message: 'Airtime callback authentication is not configured or did not match.' };
  const providerRequestId = String(input.providerRequestId || '').trim();
  const activation = providerRequestId ? await activationByProviderId(providerRequestId) : null;
  if (!activation) return { accepted: false, status: 'ignored', message: 'Airtime callback did not match a submitted activation.' };
  const recipientPhone = normalizedPhone(input.recipientPhone);
  const value = amountFromProvider(input.value);
  if (recipientPhone !== activation.recipient_phone || !value || value.currency !== activation.currency || value.amountMinor !== activation.amount_minor) return { accepted: false, status: 'ignored', message: 'Airtime callback did not match the canonical recipient and value.' };
  const normalized = String(input.status || '').trim().toLowerCase();
  if (!['success', 'failed'].includes(normalized)) return { accepted: false, status: 'ignored', message: 'Airtime callback status is not final.' };
  if (activation.status === 'delivered' || activation.status === 'failed') return { accepted: true, status: activation.status as 'delivered' | 'failed', requestId: activation.economic_request_id, message: 'This final airtime status was already recorded.' };

  const request = await getEconomicRequest(activation.economic_request_id);
  if (!request || request.phone !== activation.owner_phone) return { accepted: false, status: 'ignored', message: 'The linked Economic Request is unavailable.' };
  const fulfillment = request.fulfillment && typeof request.fulfillment === 'object' ? request.fulfillment as Record<string, unknown> : {};
  const finalStatus = normalized === 'success' ? 'delivered' : 'failed';
  const db = await ensureAirtimeTable();
  db.run('UPDATE airtime_activations SET status=?,raw_json=?,updated_at=CURRENT_TIMESTAMP WHERE provider_request_id=?', [finalStatus, JSON.stringify({ deliveryReport: { status: input.status, value: input.value, description: input.description || null, discount: input.discount || null, receivedAt: new Date().toISOString() } }), providerRequestId]);
  saveDb();
  if (finalStatus === 'delivered') {
    await transitionEconomicRequest(request.id, request.status === 'in_fulfillment' ? 'fulfilled' : request.status, { fulfillment: { ...fulfillment, airtime_status: 'delivery_confirmed', airtime_delivery_evidence: { provider: 'africastalking', providerRequestId, recipientPhone, value: input.value, description: input.description || null, discount: input.discount || null, reportedAt: new Date().toISOString() } } });
    await sendFcmPush(activation.owner_phone, 'Airtime delivery confirmed', 'Africa’s Talking reported successful airtime delivery. Kurukoo has recorded the provider evidence on your request.', `/app/requests?request=${encodeURIComponent(request.id)}`, { canonicalAction: 'airtime.delivery_confirmed', objectType: 'economic_request', objectId: request.id, ownerScope: activation.owner_phone, idempotencyKey: `airtime-delivered:${providerRequestId}`, surface: 'requests' }).catch(() => false);
    return { accepted: true, status: 'delivered', requestId: request.id, message: 'Airtime delivery evidence was recorded.' };
  }
  await transitionEconomicRequest(request.id, request.status, { fulfillment: { ...fulfillment, airtime_status: 'delivery_failed', airtime_failure_evidence: { provider: 'africastalking', providerRequestId, recipientPhone, value: input.value, description: input.description || null, reportedAt: new Date().toISOString() } } });
  await sendFcmPush(activation.owner_phone, 'Airtime delivery was not confirmed', 'The airtime provider reported a failed delivery. Your payment and request evidence remain available for the existing refund or dispute process.', `/app/requests?request=${encodeURIComponent(request.id)}`, { canonicalAction: 'airtime.delivery_failed', objectType: 'economic_request', objectId: request.id, ownerScope: activation.owner_phone, idempotencyKey: `airtime-failed:${providerRequestId}`, surface: 'requests' }).catch(() => false);
  return { accepted: true, status: 'failed', requestId: request.id, message: 'Airtime delivery failure was recorded; the request has not been marked fulfilled.' };
}
