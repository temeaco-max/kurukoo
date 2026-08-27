import crypto from 'node:crypto';
import { hasConfiguredSecret } from './providerCapabilities.js';

export interface PaystackTransaction {
  reference: string;
  accessCode?: string;
  authorizationUrl: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface PaystackVerification {
  reference: string;
  status: string;
  amountMinor: number;
  currency: string;
  paidAt?: string;
  channel?: string;
  gatewayResponse?: string;
  providerTransactionId?: string;
}

function secret(): string {
  return String(process.env.PAYSTACK_SECRET_KEY || process.env.KURUKOO_PAYSTACK_SECRET_KEY || '').trim();
}

function configured(): boolean {
  return String(process.env.KURUKOO_PAY_PROVIDER || '').trim().toLowerCase() === 'paystack' && hasConfiguredSecret(secret());
}

function positiveAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('A positive minor-unit amount is required.');
  return value;
}

function currencyCode(value: string): string {
  const currency = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('A three-letter currency code is required.');
  return currency;
}

function callbackUrl(): string | undefined {
  const url = String(process.env.KURUKOO_PAYSTACK_CALLBACK_URL || '').trim();
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function authorizationHeaders(): HeadersInit {
  return { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' };
}

function safeReference(requestId: string, idempotencyKey: string): string {
  const shortHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 18);
  return `KURUKOO-${String(requestId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 36)}-${shortHash}`.slice(0, 96);
}

export function paystackStatus(): { configured: boolean; provider: 'paystack'; required: string[]; callbackReady: boolean; settlementEvidence: string } {
  return {
    configured: configured(),
    provider: 'paystack',
    required: ['KURUKOO_PAY_PROVIDER=paystack', 'PAYSTACK_SECRET_KEY'],
    callbackReady: Boolean(callbackUrl()),
    settlementEvidence: 'A matching successful Paystack verify response or signed charge.success webhook is required before value delivery.',
  };
}

/**
 * Creates a Paystack checkout transaction only. The returned URL is an
 * authorization step, not proof that a customer has paid.
 */
export async function createPaystackTransaction(input: {
  amountMinor: number;
  currency: string;
  email: string;
  economicRequestId: string;
  idempotencyKey: string;
}): Promise<PaystackTransaction> {
  if (!configured()) throw new Error('Paystack payment integration is not configured.');
  const amountMinor = positiveAmount(input.amountMinor);
  const currency = currencyCode(input.currency);
  const email = String(input.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('A customer email is required to prepare a Paystack payment.');
  const requestId = String(input.economicRequestId || '').trim();
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!requestId || !idempotencyKey) throw new Error('Canonical request and idempotency references are required.');
  const reference = safeReference(requestId, idempotencyKey);
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: authorizationHeaders(),
    body: JSON.stringify({
      email,
      amount: String(amountMinor),
      currency,
      reference,
      ...(callbackUrl() ? { callback_url: callbackUrl() } : {}),
      metadata: { economic_request_id: requestId, origin: 'kurukoo', idempotency_key: idempotencyKey.slice(0, 160) },
    }),
  });
  const payload = await response.json().catch(() => ({})) as any;
  const data = payload?.data;
  if (!response.ok || payload?.status !== true || typeof data?.authorization_url !== 'string' || typeof data?.reference !== 'string') {
    throw new Error(String(payload?.message || payload?.data?.message || 'Paystack did not initialize a payment transaction.'));
  }
  return {
    reference: String(data.reference),
    accessCode: typeof data.access_code === 'string' ? data.access_code : undefined,
    authorizationUrl: String(data.authorization_url),
    amountMinor,
    currency,
    status: 'authorization_pending',
  };
}

export function verifyPaystackWebhook(rawBody: Buffer, signatureHeader: string | undefined): Record<string, any> | null {
  if (!configured() || !rawBody?.length || !signatureHeader) return null;
  const expected = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex');
  const supplied = Buffer.from(String(signatureHeader), 'utf8');
  const actual = Buffer.from(expected, 'utf8');
  if (supplied.length !== actual.length || !crypto.timingSafeEqual(supplied, actual)) return null;
  try {
    const event = JSON.parse(rawBody.toString('utf8')) as Record<string, any>;
    return typeof event.event === 'string' && event.data && typeof event.data === 'object' ? event : null;
  } catch {
    return null;
  }
}

/** Fetches Paystack’s server-side transaction record; callers must still match amount and request identity before delivery. */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerification> {
  if (!configured()) throw new Error('Paystack payment integration is not configured.');
  const safe = String(reference || '').trim();
  if (!safe || safe.length > 160) throw new Error('A valid Paystack transaction reference is required.');
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(safe)}`, { headers: { Authorization: `Bearer ${secret()}` } });
  const payload = await response.json().catch(() => ({})) as any;
  const data = payload?.data;
  if (!response.ok || payload?.status !== true || !data || typeof data.reference !== 'string') throw new Error(String(payload?.message || 'Paystack could not verify that transaction.'));
  return {
    reference: String(data.reference),
    status: String(data.status || 'unknown'),
    amountMinor: Number(data.amount || 0),
    currency: String(data.currency || '').toUpperCase(),
    paidAt: data.paid_at || data.paidAt ? String(data.paid_at || data.paidAt) : undefined,
    channel: data.channel ? String(data.channel) : undefined,
    gatewayResponse: data.gateway_response ? String(data.gateway_response) : undefined,
    providerTransactionId: data.id !== undefined ? String(data.id) : undefined,
  };
}
