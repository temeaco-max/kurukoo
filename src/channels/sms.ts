import { BaseChannelHandler } from './baseChannelService.js';
import {
  claimProviderInquirySmsDispatch,
  findOpenProviderInquiryForSms,
  providerInquiryReference,
  recordProviderInquiryResponse,
  recordProviderInquirySmsDeliveryReport,
  recordProviderInquirySmsDispatch,
  type ProviderInquiryDispatchStatus,
} from '../services/canonicalFulfilmentService.js';
import { recordChannelDeliveryReport, recordChannelDispatch, normalizeChannelDeliveryStatus } from '../services/channelDeliveryState.js';
import { sendFcmPush } from '../services/pushNotifications.js';
import { getEconomicRequest, transitionEconomicRequest } from '../services/skillFlows.js';
import { getFulfilment } from '../services/canonicalFulfilmentService.js';

export interface SmsDeliveryResult {
  ok: boolean;
  provider: 'africastalking' | 'disabled' | 'failed';
  accepted?: boolean;
  messageId?: string;
  providerStatus?: string;
  reason?: string;
}

export interface ProviderInquirySmsOutcome {
  status: 'accepted' | 'already_recorded' | 'delivery_uncertain' | 'failed';
  inquiryId: string;
  reference: string;
  messageId?: string;
  reason?: string;
}

function hasConfiguredValue(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && !['stub', 'placeholder', '<secret>'].includes(normalized);
}

function africaTalkingBaseUrl(username: string): string {
  const configured = String(process.env.AFRICASTALKING_API_BASE || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return username.toLowerCase() === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
}

function recipientFromPayload(payload: any): Record<string, unknown> | undefined {
  const recipients = payload?.SMSMessageData?.Recipients || payload?.recipients || [];
  return Array.isArray(recipients) ? recipients[0] : undefined;
}

function acceptedStatus(value: unknown): boolean {
  return !/(?:failed|rejected|invalid|error|none)/i.test(String(value || ''));
}

function smsDispatchStatus(value: unknown): ProviderInquiryDispatchStatus {
  const normalized = normalizeChannelDeliveryStatus(value);
  return normalized === 'unknown' ? 'unknown' : normalized;
}

export function smsAvailability(): { available: boolean; reason?: string } {
  if (process.env.FF_SMS !== 'true') return { available: false, reason: 'sms_feature_disabled' };
  if (!hasConfiguredValue(process.env.AFRICASTALKING_API_KEY) || !hasConfiguredValue(process.env.AFRICASTALKING_USERNAME)) {
    return { available: false, reason: 'sms_provider_not_configured' };
  }
  return { available: true };
}

function normalizedPhone(value: unknown): string {
  const raw = String(value || '').trim();
  return raw ? (raw.startsWith('+') ? raw : `+${raw}`) : '';
}

function providerReferenceFromText(text: string): string | undefined {
  const match = String(text || '').match(/\b(KQ[A-Z0-9]{6,20})\b/i);
  return match?.[1]?.toUpperCase();
}

function parseProviderReply(text: string): { availability: boolean; priceMinor?: number; currency: string; delivery?: string } {
  const normalized = String(text || '').trim();
  const unavailable = /\b(?:unavailable|sold out|cannot help|not available|no stock)\b/i.test(normalized);
  const thousands = normalized.match(/(?:₦|ngn\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  const direct = normalized.match(/(?:₦|ngn\s*)(\d[\d,]*(?:\.\d+)?)/i);
  const amount = thousands ? Number(thousands[1]) * 1000 : direct ? Number(direct[1].replace(/,/g, '')) : NaN;
  return {
    availability: !unavailable,
    ...(Number.isFinite(amount) && amount > 0 ? { priceMinor: Math.round(amount * 100) } : {}),
    currency: 'NGN',
    delivery: /\b(?:delivery|deliver|can deliver)\b/i.test(normalized) ? 'available' : undefined,
  };
}

function isAfricaTalkingDeliveryReport(body: any): boolean {
  const hasMessage = Boolean(body?.Body || body?.body || body?.text || body?.message);
  return !hasMessage && Boolean(body?.id || body?.messageId || body?.MessageId) && Boolean(body?.status || body?.Status);
}

export async function sendSmsText(phone: string, message: string): Promise<SmsDeliveryResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  const sender = process.env.AFRICASTALKING_SENDER_ID;
  const availability = smsAvailability();
  if (!availability.available || !apiKey || !username) {
    return { ok: false, provider: 'disabled', accepted: false, reason: availability.reason || 'sms_provider_not_configured' };
  }
  const body = new URLSearchParams({ username, to: phone, message: message.slice(0, 918), ...(sender ? { from: sender } : {}) });
  try {
    const response = await fetch(`${africaTalkingBaseUrl(username)}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
    const rawText = await response.text().catch(() => '');
    let payload: any = {};
    try { payload = rawText ? JSON.parse(rawText) : {}; } catch { /* Provider errors may not be JSON. */ }
    const recipient = recipientFromPayload(payload);
    const providerStatus = String(recipient?.status || payload?.SMSMessageData?.Message || '').slice(0, 120) || undefined;
    const messageId = String(recipient?.messageId || recipient?.id || '').trim() || undefined;
    const accepted = response.ok && acceptedStatus(providerStatus);
    if (messageId) {
      await recordChannelDispatch({
        channel: 'sms',
        provider: 'africastalking',
        providerMessageId: messageId,
        phone,
        status: accepted ? providerStatus || 'accepted' : 'failed',
        raw: { status: providerStatus, number: recipient?.number },
      });
    }
    if (!accepted) {
      return { ok: false, provider: 'failed', accepted: false, messageId, providerStatus, reason: `sms_provider_http_${response.status}` };
    }
    return { ok: true, provider: 'africastalking', accepted: true, messageId, providerStatus };
  } catch (error) {
    return { ok: false, provider: 'failed', accepted: false, reason: error instanceof Error ? error.message.slice(0, 240) : 'sms_provider_request_failed' };
  }
}

/**
 * Performs exactly one provider-contact attempt for an inquiry. A network failure
 * remains uncertain and is never retried automatically, preventing duplicate real-world messages.
 */
export async function sendProviderInquirySms(ownerPhone: string, inquiryId: string): Promise<ProviderInquirySmsOutcome> {
  const availability = smsAvailability();
  if (!availability.available) {
    return { status: 'failed', inquiryId, reference: providerInquiryReference(inquiryId), reason: availability.reason };
  }
  const claimed = await claimProviderInquirySmsDispatch({ ownerPhone, inquiryId });
  const { inquiry, dispatch } = claimed;
  if (claimed.duplicate) {
    if (['accepted', 'submitted', 'buffered', 'delivered'].includes(dispatch.status)) {
      return { status: 'already_recorded', inquiryId, reference: dispatch.reference, messageId: dispatch.providerMessageId };
    }
    return { status: 'delivery_uncertain', inquiryId, reference: dispatch.reference, messageId: dispatch.providerMessageId, reason: dispatch.failureReason || 'previous_delivery_attempt_requires_operator_review' };
  }

  const message = `${inquiry.question}\nReply with availability and price. Reference: ${dispatch.reference}`;
  const delivery = await sendSmsText(inquiry.providerPhone!, message);
  if (delivery.ok && delivery.messageId) {
    await recordProviderInquirySmsDispatch({
      ownerPhone,
      inquiryId,
      providerMessageId: delivery.messageId,
      status: smsDispatchStatus(delivery.providerStatus || 'accepted'),
      raw: { provider: delivery.provider, providerStatus: delivery.providerStatus || 'accepted' },
    });
    return { status: 'accepted', inquiryId, reference: dispatch.reference, messageId: delivery.messageId };
  }
  if (delivery.ok) {
    await recordProviderInquirySmsDispatch({
      ownerPhone,
      inquiryId,
      status: 'unknown',
      failureReason: 'sms_provider_response_missing_message_id',
      raw: { provider: delivery.provider, providerStatus: delivery.providerStatus || 'accepted' },
    });
    return { status: 'delivery_uncertain', inquiryId, reference: dispatch.reference, reason: 'sms_provider_response_missing_message_id' };
  }

  // The transport may have accepted a message before a timeout/error was observed.
  // Preserve the uncertainty instead of sending a second message automatically.
  await recordProviderInquirySmsDispatch({
    ownerPhone,
    inquiryId,
    providerMessageId: delivery.messageId,
    status: delivery.messageId ? smsDispatchStatus(delivery.providerStatus || 'failed') : 'unknown',
    failureReason: delivery.reason || 'sms_provider_request_failed',
    raw: { provider: delivery.provider, providerStatus: delivery.providerStatus || null },
  });
  return { status: delivery.messageId ? 'failed' : 'delivery_uncertain', inquiryId, reference: dispatch.reference, messageId: delivery.messageId, reason: delivery.reason };
}

async function reflectProviderReplyOnEconomicRequest(input: {
  ownerPhone: string;
  fulfilmentId: string;
  providerPhone: string;
  providerName?: string;
  inquiryId: string;
  evidenceRef: string;
  availability: boolean;
  priceMinor?: number;
  currency: string;
  rawText: string;
}): Promise<string | undefined> {
  const fulfilment = await getFulfilment(input.ownerPhone, input.fulfilmentId);
  const requestId = fulfilment?.economicRequestId;
  if (!requestId) return undefined;
  const request = await getEconomicRequest(requestId);
  if (!request || request.phone !== input.ownerPhone) return undefined;
  const providerResponse = {
    inquiryId: input.inquiryId,
    providerPhone: input.providerPhone,
    providerName: input.providerName,
    evidenceRef: input.evidenceRef,
    availability: input.availability,
    rawText: input.rawText,
    receivedAt: new Date().toISOString(),
  };
  const fulfilmentPatch = { ...(request.fulfillment || {}), providerInquiry: providerResponse };
  if (input.availability && input.priceMinor && input.priceMinor > 0) {
    const quote = {
      amount_minor: input.priceMinor,
      currency: input.currency,
      provider_name: input.providerName || 'Selected provider',
      source: 'provider_sms_response',
      evidence_ref: input.evidenceRef,
      confirmed: true,
    };
    const nextStatus = request.status === 'quoted' ? 'quoted' : request.status === 'quoting' || request.status === 'matched' ? 'quoted' : request.status;
    await transitionEconomicRequest(requestId, nextStatus, { providerPhone: input.providerPhone, quote, fulfillment: fulfilmentPatch });
  } else {
    await transitionEconomicRequest(requestId, request.status, { providerPhone: input.providerPhone, fulfillment: fulfilmentPatch });
  }
  return requestId;
}

async function notifyOwnerOfProviderReply(input: { ownerPhone: string; requestId?: string; providerName?: string; inquiryId: string; duplicate?: boolean }): Promise<void> {
  if (input.duplicate) return;
  const provider = input.providerName || 'A provider';
  const link = input.requestId ? `/app/requests?request=${encodeURIComponent(input.requestId)}` : '/app/requests';
  await sendFcmPush(input.ownerPhone, 'Provider reply received', `${provider} replied to your request. Review the evidence and any quoted price before taking the next step.`, link, {
    canonicalAction: 'provider_inquiry.response_received',
    objectType: 'provider_inquiry',
    objectId: input.inquiryId,
    ownerScope: input.ownerPhone,
    idempotencyKey: `provider-inquiry-response:${input.inquiryId}`,
    surface: 'requests',
  }).catch(() => false);
}

class SmsHandler extends BaseChannelHandler {
  get channelName(): string { return 'sms'; }

  protected parseMessage(body: any, _headers: Record<string, any>): { phone: string; text: string; meta?: any } | null {
    const phone = normalizedPhone(body?.From || body?.from || body?.phoneNumber);
    const text = String(body?.Body || body?.body || body?.text || body?.message || '').trim();
    if (!phone || !text) return null;
    return { phone, text, meta: { externalSubject: phone, messageId: String(body?.MessageId || body?.messageId || body?.id || '').slice(0, 256) || undefined } };
  }

  protected async sendReply(phone: string, reply: string): Promise<void> {
    const result = await sendSmsText(phone, reply);
    if (!result.ok) console.warn(`[SMS] Outbound delivery unavailable: ${result.reason || 'unknown provider failure'}`);
  }
}

const smsHandlerInstance = new SmsHandler();

export async function handleSmsWebhook(body: any): Promise<{ status: string; response?: string; conversationId?: string; duplicate?: boolean; deliveryStatus?: string }> {
  if (isAfricaTalkingDeliveryReport(body)) {
    const providerMessageId = String(body?.id || body?.messageId || body?.MessageId || '').trim();
    const providerStatus = String(body?.status || body?.Status || '').trim();
    const state = await recordChannelDeliveryReport({
      channel: 'sms', provider: 'africastalking', providerMessageId,
      phone: normalizedPhone(body?.phoneNumber || body?.to || body?.To) || undefined,
      status: providerStatus,
      failureReason: body?.failureReason || body?.failure_reason,
      raw: { status: providerStatus, networkCode: body?.networkCode, retryCount: body?.retryCount },
    });
    const inquiryDispatch = await recordProviderInquirySmsDeliveryReport({
      providerMessageId,
      status: smsDispatchStatus(providerStatus),
      failureReason: body?.failureReason || body?.failure_reason,
      raw: { status: providerStatus, networkCode: body?.networkCode, retryCount: body?.retryCount },
    });
    return { status: 'success', deliveryStatus: inquiryDispatch?.status || state?.status || 'unknown' };
  }

  const inboundText = String(body?.Body || body?.body || body?.text || body?.message || '').trim();
  const providerPhone = normalizedPhone(body?.From || body?.from || body?.phoneNumber);
  if (inboundText && providerPhone) {
    const inquiry = await findOpenProviderInquiryForSms({ providerPhone, reference: providerReferenceFromText(inboundText) });
    if (inquiry) {
      const sourceRef = String(body?.MessageId || body?.messageId || body?.id || '').trim() || `provider-sms:${inquiry.id}:${inboundText.slice(0, 96)}`;
      const parsed = parseProviderReply(inboundText);
      const outcome = await recordProviderInquiryResponse({
        ownerPhone: inquiry.ownerPhone,
        inquiryId: inquiry.id,
        providerIdentity: providerPhone,
        idempotencyKey: sourceRef,
        evidenceRef: sourceRef,
        response: { ...parsed, rawText: inboundText, channel: 'sms', receivedAt: new Date().toISOString() },
        offer: {
          providerId: inquiry.providerId,
          providerPhone,
          providerName: inquiry.providerName,
          title: inquiry.providerName ? `${inquiry.providerName} provider response` : 'Provider response',
          description: inboundText,
          priceMinor: parsed.priceMinor,
          currency: parsed.currency,
          availability: parsed.availability ? 'available' : 'unavailable',
          delivery: parsed.delivery,
          evidenceLevel: 'provider_confirmed',
          source: 'provider_inquiry',
        },
      });
      const requestId = outcome.duplicate ? undefined : await reflectProviderReplyOnEconomicRequest({
        ownerPhone: inquiry.ownerPhone,
        fulfilmentId: inquiry.fulfilmentId,
        providerPhone,
        providerName: inquiry.providerName,
        inquiryId: inquiry.id,
        evidenceRef: sourceRef,
        availability: parsed.availability,
        priceMinor: parsed.priceMinor,
        currency: parsed.currency,
        rawText: inboundText,
      });
      await notifyOwnerOfProviderReply({ ownerPhone: inquiry.ownerPhone, requestId, providerName: inquiry.providerName, inquiryId: inquiry.id, duplicate: outcome.duplicate });
      return { status: 'success', response: outcome.duplicate ? 'Provider response already processed.' : 'Provider response recorded.', duplicate: outcome.duplicate };
    }
  }

  const res = await smsHandlerInstance.handleWebhook(body, {});
  return { status: res.status, response: res.response, conversationId: res.conversationId, duplicate: res.duplicate };
}

export function providerInquirySmsReference(inquiryId: string): string {
  return providerInquiryReference(inquiryId);
}
