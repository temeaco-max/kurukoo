import { getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';
import { lockEscrowForEconomicRequest } from './tradeEngine.js';
import { persistCoordinatorEvent } from './coordinatorStore.js';

export interface VerifiedEconomicPaymentInput {
  requestId: string;
  provider: string;
  paymentReference: string;
  evidenceId: string;
  amountMinor: number;
  currency: string;
  evidenceSource: 'provider_webhook' | 'provider_verify';
  metadata?: Record<string, unknown>;
}

export interface VerifiedEconomicPaymentResult {
  success: boolean;
  idempotent: boolean;
  requestId: string;
  escrowId?: number;
  message: string;
}

function text(value: unknown, field: string, max = 180): string {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${field} is required.`);
  if (result.length > max) throw new Error(`${field} is too long.`);
  return result;
}

export async function moveEconomicPaymentToPending(requestId: string): Promise<void> {
  let current = await getEconomicRequest(requestId);
  if (!current) throw new Error('Economic Request not found.');
  if (['paid', 'in_fulfillment', 'fulfilled', 'completed'].includes(current.status)) return;
  if (current.status === 'quoted') {
    await transitionEconomicRequest(requestId, 'awaiting_confirmation');
    current = await getEconomicRequest(requestId);
  }
  if (current?.status === 'awaiting_confirmation') {
    await transitionEconomicRequest(requestId, 'reserved');
    current = await getEconomicRequest(requestId);
  }
  if (current?.status === 'reserved') {
    await transitionEconomicRequest(requestId, 'payment_pending');
    current = await getEconomicRequest(requestId);
  }
  if (current?.status !== 'payment_pending') throw new Error(`Payment settlement is not valid from request state ${current?.status || 'unknown'}.`);
}

/**
 * Record a payment only after a provider-side webhook or verification response
 * has confirmed its reference, amount, and currency. The helper intentionally
 * does not release funds or complete fulfilment; those remain governed by the
 * existing evidence, dispute, and completion boundaries.
 */
export async function recordVerifiedEconomicPayment(input: VerifiedEconomicPaymentInput): Promise<VerifiedEconomicPaymentResult> {
  const requestId = text(input.requestId, 'Economic Request id');
  const provider = text(input.provider, 'Payment provider', 80).toLowerCase();
  const paymentReference = text(input.paymentReference, 'Payment reference');
  const evidenceId = text(input.evidenceId, 'Payment evidence id');
  const amountMinor = Number(input.amountMinor);
  const currency = text(input.currency, 'Currency', 8).toUpperCase();
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('A positive payment amount in minor units is required.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('A three-letter payment currency is required.');

  const request = await getEconomicRequest(requestId);
  if (!request) throw new Error('Economic Request not found.');
  const quote = request.quote && typeof request.quote === 'object' ? request.quote as Record<string, unknown> : {};
  if (Number(quote.amount_minor) !== amountMinor || String(quote.currency || '').toUpperCase() !== currency) {
    throw new Error('Verified payment amount or currency does not match the current canonical quote.');
  }

  const priorFulfilment = request.fulfillment && typeof request.fulfillment === 'object' ? request.fulfillment as Record<string, unknown> : {};
  if (priorFulfilment.payment_verified === true) {
    if (priorFulfilment.payment_reference !== paymentReference || String(priorFulfilment.payment_provider || '').toLowerCase() !== provider) {
      throw new Error('This Economic Request already has a different verified payment reference.');
    }
    return { success: true, idempotent: true, requestId, message: 'The verified payment was already recorded.' };
  }

  await moveEconomicPaymentToPending(requestId);
  const current = await getEconomicRequest(requestId);
  if (!current) throw new Error('Economic Request not found after payment preparation.');
  await transitionEconomicRequest(requestId, 'paid', {
    fulfillment: {
      ...(current.fulfillment || {}),
      payment_verified: true,
      payment_provider: provider,
      payment_reference: paymentReference,
      payment_evidence_id: evidenceId,
      payment_evidence_source: input.evidenceSource,
      payment_verified_at: new Date().toISOString(),
      payment_amount_minor: amountMinor,
      payment_currency: currency,
      ...(input.metadata || {}),
    },
  });
  const escrow = await lockEscrowForEconomicRequest(requestId, amountMinor);
  if (!escrow.success) throw new Error('Verified payment was recorded but escrow could not be locked safely.');

  await persistCoordinatorEvent({
    id: `payment:${provider}:${evidenceId}:verified`,
    type: 'payment.webhook.verified',
    occurredAt: new Date().toISOString(),
    producer: 'economicPaymentEvidence',
    correlationId: `economic_request:${requestId}`,
    ownerPhone: request.phone.startsWith('anon_') ? undefined : request.phone,
    economicRequestId: requestId,
    payload: { provider, evidenceId, paymentReference, amountMinor, currency, escrowLocked: true, evidenceSource: input.evidenceSource },
    sensitivity: request.phone.startsWith('anon_') ? 'public' : 'personal',
    provenance: { source: 'provider', sourceId: evidenceId, evidenceLevel: 'verified_external' },
    policy: { autonomousAllowed: false, confirmationRequired: 'external_evidence' },
    schemaVersion: 1,
  });
  return { success: true, idempotent: false, requestId, escrowId: escrow.escrowId, message: 'Verified payment was recorded and the existing escrow policy is active.' };
}
