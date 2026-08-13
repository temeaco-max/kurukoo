import {
  claimProviderCallbackEvent,
  updateDeliveryByProviderReference,
} from '../services/communicationDelivery.js';
import { recordCommunicationConsent } from '../services/communicationOutbox.js';

function normalizePhone(value: unknown): string {
  const phone = String(value || '').trim();
  return phone && !phone.startsWith('+') ? `+${phone}` : phone;
}

function stateForSmsReport(status: unknown): 'submitted' | 'sent' | 'delivered' | 'failed' | 'undeliverable' | undefined {
  switch (String(status || '').trim().toLowerCase()) {
    case 'submitted':
    case 'buffered': return 'submitted';
    case 'sent': return 'sent';
    case 'success': return 'delivered';
    case 'absentsubscriber': return 'undeliverable';
    case 'rejected':
    case 'failed':
    case 'expired':
    case 'donotdisturbrejection': return 'failed';
    default: return undefined;
  }
}

export async function handleSmsDeliveryReport(body: any): Promise<{ status: 'success' | 'ignored' | 'duplicate'; deliveryState?: string }> {
  const providerReference = String(body?.id || body?.messageId || body?.message_id || '').trim();
  const providerStatus = String(body?.status || '').trim();
  const state = stateForSmsReport(providerStatus);
  if (!providerReference || !state) return { status: 'ignored' };
  const callback = await claimProviderCallbackEvent({
    channel: 'sms',
    callbackType: 'delivery_report',
    providerEventId: `${providerReference}:${providerStatus}:${String(body?.retryCount || body?.date || '')}`,
    payload: body,
    verificationState: 'not_supported',
  });
  if (callback.duplicate) return { status: 'duplicate' };
  const delivery = await updateDeliveryByProviderReference({
    channel: 'sms',
    providerReference,
    state,
    errorCode: ['failed', 'undeliverable'].includes(state) ? String(body?.failureReason || providerStatus || 'sms_delivery_failed').slice(0, 160) : undefined,
    metadata: {
      provider_status: providerStatus,
      network_code: body?.networkCode || null,
      retry_count: body?.retryCount ?? null,
      provider_reported_phone: normalizePhone(body?.phoneNumber),
    },
  });
  return { status: delivery ? 'success' : 'ignored', deliveryState: delivery?.state };
}

export async function handleSmsOptOut(body: any): Promise<{ status: 'success' | 'ignored' | 'duplicate' }> {
  const phone = normalizePhone(body?.phoneNumber || body?.phone || body?.from);
  if (!phone) return { status: 'ignored' };
  const senderId = String(body?.senderId || body?.sender_id || '').trim();
  const callback = await claimProviderCallbackEvent({
    channel: 'sms',
    callbackType: 'opt_out',
    providerEventId: `${phone}:${senderId || 'default'}`,
    payload: body,
    verificationState: 'not_supported',
  });
  if (callback.duplicate) return { status: 'duplicate' };
  await recordCommunicationConsent({ phone, channel: 'sms', purpose: 'all', state: 'denied', source: 'africas_talking_opt_out' });
  return { status: 'success' };
}
