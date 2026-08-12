import crypto from 'node:crypto';

export interface StripePaymentIntent {
  id: string;
  clientSecret: string;
  status: string;
  amountMinor: number;
  currency: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object?: { id?: string; status?: string; metadata?: Record<string, string>; amount?: number; currency?: string } };
}

function configured(): boolean {
  return process.env.KURUKOO_PAY_PROVIDER === 'stripe' && Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripeStatus(): { configured: boolean; provider: 'stripe'; required: string[] } {
  return { configured: configured(), provider: 'stripe', required: ['KURUKOO_PAY_PROVIDER=stripe', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] };
}

function asPositiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('A positive minor-unit amount is required.');
  return value;
}

export async function createStripePaymentIntent(input: { amountMinor: number; currency: string; economicRequestId: string; idempotencyKey: string }): Promise<StripePaymentIntent> {
  if (!configured()) throw new Error('Stripe payment integration is not configured.');
  const amountMinor = asPositiveInteger(input.amountMinor);
  const currency = input.currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error('A three-letter currency code is required.');
  if (!input.economicRequestId || !input.idempotencyKey) throw new Error('Canonical request and idempotency references are required.');
  const body = new URLSearchParams({
    amount: String(amountMinor), currency, 'metadata[economic_request_id]': input.economicRequestId,
    'metadata[origin]': 'kurukoo', 'automatic_payment_methods[enabled]': 'true',
  });
  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST', headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': input.idempotencyKey.slice(0, 255),
    }, body,
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof payload.id !== 'string' || typeof payload.client_secret !== 'string') throw new Error(typeof payload.error === 'object' && payload.error && 'message' in payload.error ? String((payload.error as any).message) : 'Stripe did not create a payment intent.');
  return { id: payload.id, clientSecret: payload.client_secret, status: String(payload.status || 'requires_payment_method'), amountMinor, currency };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8'); const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verifies Stripe's timestamped v1 signature over the raw request bytes before JSON parsing. */
export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined): StripeWebhookEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!configured() || !secret || !signatureHeader || !rawBody?.length) return null;
  const parts = signatureHeader.split(',').map(part => part.trim().split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean) as string[];
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return null;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
  if (!signatures.some(signature => safeEqual(signature, expected))) return null;
  try {
    const parsed = JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
    return typeof parsed.id === 'string' && typeof parsed.type === 'string' ? parsed : null;
  } catch { return null; }
}
