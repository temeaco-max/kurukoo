import crypto from 'crypto';
import { getCanonicalStore } from './canonicalStore.js';

export type AirtimeOperationStatus = 'draft' | 'ready_for_confirmation' | 'pending_provider' | 'completed' | 'failed' | 'blocked';

export interface AirtimeOperation {
  id: string;
  ownerPhone: string;
  economicRequestId?: string;
  recipient: string;
  network?: string;
  amountMinor: number;
  currency: string;
  status: AirtimeOperationStatus;
  provider: 'africastalking';
  providerRequestId?: string;
  failureReason?: string;
  evidence?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function now(): string { return new Date().toISOString(); }
function normalizeRecipient(phone: string): string {
  const raw = String(phone || '').trim().replace(/[\s-]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('0') && raw.length === 11) return `+234${raw.slice(1)}`;
  return `+${raw}`;
}
function apiBase(username: string): string {
  const override = String(process.env.AFRICASTALKING_API_BASE || '').trim().replace(/\/$/, '');
  return override || (username.toLowerCase() === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com');
}
function parseJson(value: unknown): Record<string, unknown> {
  try { const parsed = JSON.parse(String(value || '{}')); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}
function rowToOperation(row: any): AirtimeOperation {
  return {
    id: String(row.id), ownerPhone: String(row.owner_phone), economicRequestId: row.economic_request_id ? String(row.economic_request_id) : undefined,
    recipient: String(row.recipient), network: row.network ? String(row.network) : undefined,
    amountMinor: Number(row.amount_minor), currency: String(row.currency), status: String(row.status) as AirtimeOperationStatus,
    provider: 'africastalking', providerRequestId: row.provider_request_id ? String(row.provider_request_id) : undefined,
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined, evidence: parseJson(row.evidence_json),
    createdAt: String(row.created_at || ''), updatedAt: String(row.updated_at || ''),
  };
}

export async function ensureAirtimeSchema(): Promise<void> {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS airtime_operations (
    id TEXT PRIMARY KEY, owner_phone TEXT NOT NULL, economic_request_id TEXT, recipient TEXT NOT NULL,
    network TEXT, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
    provider TEXT NOT NULL, provider_request_id TEXT, idempotency_key TEXT NOT NULL UNIQUE,
    failure_reason TEXT, evidence_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await store.run('CREATE INDEX IF NOT EXISTS idx_airtime_operations_owner ON airtime_operations(owner_phone, updated_at DESC)');
  await store.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_airtime_provider_request ON airtime_operations(provider, provider_request_id) WHERE provider_request_id IS NOT NULL');
  await store.run(`CREATE TABLE IF NOT EXISTS airtime_callback_events (
    provider TEXT NOT NULL, callback_key TEXT NOT NULL, operation_id TEXT, raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(provider, callback_key)
  )`);
}

export async function getAirtimeOperation(ownerPhone: string, id: string): Promise<AirtimeOperation | null> {
  await ensureAirtimeSchema();
  const row = await (await getCanonicalStore()).one<any>('SELECT * FROM airtime_operations WHERE id=? AND owner_phone=? LIMIT 1', [id, ownerPhone]);
  return row ? rowToOperation(row) : null;
}

export async function prepareAirtimeOperation(input: { ownerPhone: string; recipient: string; amountMinor: number; currency?: string; network?: string; economicRequestId?: string; idempotencyKey?: string }): Promise<AirtimeOperation> {
  const recipient = normalizeRecipient(input.recipient);
  const amountMinor = Math.round(Number(input.amountMinor));
  const currency = String(input.currency || 'NGN').toUpperCase();
  if (!recipient || recipient.length < 8) throw new Error('A valid recipient phone number is required');
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('A positive airtime amount is required');
  const maxMinor = Math.round(Number(process.env.AIRTIME_MAX_TRANSACTION_MINOR || 1000000));
  if (amountMinor > maxMinor) throw new Error('The airtime amount exceeds the configured per-transaction limit');
  await ensureAirtimeSchema();
  const key = String(input.idempotencyKey || `airtime:prepare:${input.ownerPhone}:${recipient}:${amountMinor}:${currency}`).trim();
  const store = await getCanonicalStore();
  const existing = await store.one<any>('SELECT * FROM airtime_operations WHERE idempotency_key=? LIMIT 1', [key]);
  if (existing) return rowToOperation(existing);
  const id = crypto.randomUUID();
  await store.run(`INSERT INTO airtime_operations(id,owner_phone,economic_request_id,recipient,network,amount_minor,currency,status,provider,idempotency_key)
    VALUES(?,?,?,?,?,?,?,?,?,?)`, [id, input.ownerPhone, input.economicRequestId || null, recipient, input.network || null, amountMinor, currency, 'ready_for_confirmation', 'africastalking', key]);
  return (await getAirtimeOperation(input.ownerPhone, id))!;
}

export async function purchaseAirtime(input: { ownerPhone: string; operationId: string; idempotencyKey?: string }): Promise<AirtimeOperation> {
  const operation = await getAirtimeOperation(input.ownerPhone, input.operationId);
  if (!operation) throw new Error('Airtime operation not found');
  if (['completed', 'pending_provider'].includes(operation.status)) return operation;
  if (operation.status !== 'ready_for_confirmation') throw new Error('Airtime operation is not ready for confirmed purchase');
  if (process.env.FF_AIRTIME !== 'true') return updateAirtimeOperation(operation, 'blocked', { failureReason: 'airtime_feature_disabled' });
  const apiKey = String(process.env.AFRICASTALKING_API_KEY || '').trim();
  const username = String(process.env.AFRICASTALKING_USERNAME || '').trim();
  if (!apiKey || !username || ['stub', 'placeholder'].includes(apiKey.toLowerCase()) || ['stub', 'placeholder'].includes(username.toLowerCase())) return updateAirtimeOperation(operation, 'blocked', { failureReason: 'airtime_provider_not_configured' });

  const recipient = { phoneNumber: operation.recipient, amount: operation.amountMinor / 100, currencyCode: operation.currency };
  try {
    const response = await fetch(`${apiBase(username)}/version1/airtime/send`, {
      method: 'POST', headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ username, recipients: JSON.stringify([recipient]) }),
    });
    const rawText = await response.text().catch(() => '');
    let payload: any = {}; try { payload = rawText ? JSON.parse(rawText) : {}; } catch { /* provider may return non-JSON errors */ }
    const providerResponse = Array.isArray(payload?.responses) ? payload.responses[0] : undefined;
    const providerRequestId = String(providerResponse?.requestId || providerResponse?.transactionId || '').trim() || undefined;
    const status = String(providerResponse?.status || '').toLowerCase();
    if (!response.ok || status === 'failed') return updateAirtimeOperation(operation, 'failed', { providerRequestId, failureReason: `airtime_provider_http_${response.status}`, evidence: { providerStatus: providerResponse?.status, requestId: providerRequestId } });
    return updateAirtimeOperation(operation, 'pending_provider', { providerRequestId, evidence: { providerStatus: providerResponse?.status || 'sent', requestId: providerRequestId, submittedAt: now() } });
  } catch (error) {
    return updateAirtimeOperation(operation, 'failed', { failureReason: error instanceof Error ? error.message.slice(0, 240) : 'airtime_provider_request_failed' });
  }
}

async function updateAirtimeOperation(operation: AirtimeOperation, status: AirtimeOperationStatus, patch: { providerRequestId?: string; failureReason?: string; evidence?: Record<string, unknown> }): Promise<AirtimeOperation> {
  await ensureAirtimeSchema();
  const store = await getCanonicalStore();
  await store.run('UPDATE airtime_operations SET status=?,provider_request_id=COALESCE(?,provider_request_id),failure_reason=?,evidence_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_phone=?', [status, patch.providerRequestId || null, patch.failureReason || null, JSON.stringify({ ...(operation.evidence || {}), ...(patch.evidence || {}) }), operation.id, operation.ownerPhone]);
  return (await getAirtimeOperation(operation.ownerPhone, operation.id))!;
}

export async function recordAirtimeCallback(body: Record<string, unknown>): Promise<{ operation?: AirtimeOperation; duplicate: boolean }> {
  await ensureAirtimeSchema();
  const providerRequestId = String(body.requestId || body.transactionId || '').trim();
  const callbackKey = String(body.transactionId || body.requestId || body.id || '').trim() || crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const store = await getCanonicalStore();
  const prior = await store.one<any>('SELECT callback_key FROM airtime_callback_events WHERE provider=? AND callback_key=? LIMIT 1', ['africastalking', callbackKey]);
  if (prior) return { duplicate: true };
  const row = providerRequestId ? await store.one<any>('SELECT * FROM airtime_operations WHERE provider=? AND provider_request_id=? LIMIT 1', ['africastalking', providerRequestId]) : null;
  await store.run('INSERT INTO airtime_callback_events(provider,callback_key,operation_id,raw_json) VALUES(?,?,?,?)', ['africastalking', callbackKey, row?.id || null, JSON.stringify(body)]);
  if (!row) return { duplicate: false };
  const operation = rowToOperation(row);
  const providerStatus = String(body.status || '').toLowerCase();
  const next = providerStatus === 'success' ? 'completed' : providerStatus === 'failed' ? 'failed' : 'pending_provider';
  return { duplicate: false, operation: await updateAirtimeOperation(operation, next, { providerRequestId, failureReason: next === 'failed' ? String(body.description || body.errorMessage || 'airtime_provider_failed') : undefined, evidence: { providerStatus: body.status, providerRequestId, recipient: body.phoneNumber, amount: body.value || body.amount, callbackAt: now() } }) };
}
