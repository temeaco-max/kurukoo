import { expireDueProviderInquiries, getFulfilment } from './canonicalFulfilmentService.js';
import { sendFcmPush } from './pushNotifications.js';

export interface ProviderInquiryFollowUpResult {
  scannedAt: string;
  markedNoResponse: number;
  inquiryIds: string[];
}

/**
 * Marks only inquiries that have passed their explicit response deadline. The
 * operation is idempotent: once an inquiry is `no_response`, later passes do
 * not change it or queue another customer notification.
 */
export async function runProviderInquiryFollowUpPass(input: { now?: string; limit?: number } = {}): Promise<ProviderInquiryFollowUpResult> {
  const scannedAt = input.now || new Date().toISOString();
  const expired = await expireDueProviderInquiries({ now: scannedAt, limit: input.limit });
  for (const inquiry of expired) {
    const fulfilment = await getFulfilment(inquiry.ownerPhone, inquiry.fulfilmentId);
    const requestId = fulfilment?.economicRequestId;
    const provider = inquiry.providerName || 'The selected provider';
    const link = requestId ? `/app/requests?request=${encodeURIComponent(requestId)}` : '/app/requests';
    await sendFcmPush(
      inquiry.ownerPhone,
      'Provider has not replied',
      `${provider} did not reply by the agreed response deadline. Kurukoo has not confirmed availability, price, a repair slot, or a booking.`,
      link,
      {
        canonicalAction: 'provider_inquiry.no_response',
        objectType: 'provider_inquiry',
        objectId: inquiry.id,
        ownerScope: inquiry.ownerPhone,
        idempotencyKey: `provider-inquiry-timeout:${inquiry.id}`,
        surface: 'requests',
      },
    ).catch(() => false);
  }
  return { scannedAt, markedNoResponse: expired.length, inquiryIds: expired.map((inquiry) => inquiry.id) };
}
