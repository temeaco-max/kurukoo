import { BaseChannelHandler } from './baseChannelService.js';
import { recordChannelDeliveryReport, recordChannelDispatch } from '../services/channelDeliveryState.js';
import { findOpenProviderInquiryForSms, recordProviderInquiryResponse } from '../services/canonicalFulfilmentService.js';

export interface SmsDeliveryResult {
  ok: boolean;
  provider: 'africastalking' | 'disabled' | 'failed';
  accepted?: boolean;
  messageId?: string;
  providerStatus?: string;
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

export async function sendSmsText(phone: string, message: string): Promise<SmsDeliveryResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  const sender = process.env.AFRICASTALKING_SENDER_ID;
  if (process.env.FF_SMS !== 'true') return { ok: false, provider: 'disabled', accepted: false, reason: 'sms_feature_disabled' };
  if (!apiKey || !username || !hasConfiguredValue(apiKey) || !hasConfiguredValue(username)) return { ok: false, provider: 'disabled', accepted: false, reason: 'sms_provider_not_configured' };

  const body = new URLSearchParams({ username, to: phone, message: message.slice(0, 918), ...(sender ? { from: sender } : {}) });
  try {
    const response = await fetch(`${africaTalkingBaseUrl(username)}/version1/messaging`, {
      method: 'POST', headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body,
    });
    const rawText = await response.text().catch(() => '');
    let payload: any = {};
    try { payload = rawText ? JSON.parse(rawText) : {}; } catch { /* provider may return non-JSON error text */ }
    const recipient = recipientFromPayload(payload);
    const providerStatus = String(recipient?.status || payload?.SMSMessageData?.Message || '').slice(0, 120) || undefined;
    const messageId = String(recipient?.messageId || recipient?.id || '').trim() || undefined;
    if (!response.ok || !acceptedStatus(providerStatus)) {
      return { ok: false, provider: 'failed', accepted: false, messageId, providerStatus, reason: `sms_provider_http_${response.status}` };
    }
    await recordChannelDispatch({ channel: 'sms', provider: 'africastalking', providerMessageId: messageId, phone, status: providerStatus || 'accepted', raw: { status: providerStatus, number: recipient?.number } });
    return { ok: true, provider: 'africastalking', accepted: true, messageId, providerStatus };
  } catch (error) {
    return { ok: false, provider: 'failed', accepted: false, reason: error instanceof Error ? error.message.slice(0, 240) : 'sms_provider_request_failed' };
  }
}

function parseProviderReply(text: string): { availability: boolean; priceMinor?: number; currency: string; delivery?: string } {
  const normalized = String(text || '').trim();
  const unavailable = /\b(no|not available|unavailable|sold out|cannot)\b/i.test(normalized);
  const thousands = normalized.match(/(?:₦|ngn\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  const direct = normalized.match(/(?:₦|ngn\s*)(\d[\d,]*(?:\.\d+)?)/i);
  const amount = thousands ? Number(thousands[1]) * 1000 : direct ? Number(direct[1].replace(/,/g, '')) : NaN;
  return { availability: !unavailable, ...(Number.isFinite(amount) && amount > 0 ? { priceMinor: Math.round(amount * 100) } : {}), currency: 'NGN', delivery: /\b(delivery|deliver|yes)\b/i.test(normalized) ? 'available' : undefined };
}

function providerReferenceFromText(text: string): string | undefined {
  const match = String(text || '').match(/\b(KQ[A-Z0-9]{6,20})\b/i);
  return match?.[1]?.toUpperCase();
}

function isAfricaTalkingDeliveryReport(body: any): boolean {
  const hasMessage = Boolean(body?.Body || body?.body || body?.text || body?.message);
  return !hasMessage && Boolean(body?.id || body?.messageId || body?.MessageId) && Boolean(body?.status || body?.Status);
}

class SmsHandler extends BaseChannelHandler {
  get channelName(): string { return 'sms'; }

  protected parseMessage(body: any, _headers: Record<string, any>): { phone: string; text: string; meta?: any } | null {
    const rawPhone = body?.From || body?.from || body?.phoneNumber || '';
    const text = body?.Body || body?.body || body?.text || body?.message || '';
    if (!rawPhone || !String(text).trim()) return null;
    const phone = String(rawPhone).trim();
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    return {
      phone: normalizedPhone,
      text: String(text).trim(),
      meta: {
        externalSubject: normalizedPhone,
        messageId: String(body?.MessageId || body?.messageId || body?.id || '').slice(0, 256) || undefined,
      },
    };
  }

  protected async sendReply(phone: string, reply: string): Promise<void> {
    const result = await sendSmsText(phone, reply);
    if (!result.ok) console.warn(`[SMS] Outbound delivery unavailable: ${result.reason || 'unknown provider failure'}`);
  }
}

const smsHandlerInstance = new SmsHandler();

export async function handleSmsWebhook(body: any): Promise<{ status: string; response?: string; conversationId?: string; duplicate?: boolean; deliveryStatus?: string }> {
  if (isAfricaTalkingDeliveryReport(body)) {
    const state = await recordChannelDeliveryReport({
      channel: 'sms', provider: 'africastalking', providerMessageId: String(body.id || body.messageId || body.MessageId),
      phone: body.phoneNumber || body.to || body.To, status: body.status || body.Status,
      failureReason: body.failureReason || body.failure_reason, raw: { status: body.status || body.Status, networkCode: body.networkCode },
    });
    return { status: 'success', deliveryStatus: state?.status || 'unknown' };
  }
  const inboundText = String(body?.Body || body?.body || body?.text || body?.message || '').trim();
  const rawProviderPhone = String(body?.From || body?.from || body?.phoneNumber || '').trim();
  const providerPhone = rawProviderPhone ? (rawProviderPhone.startsWith('+') ? rawProviderPhone : `+${rawProviderPhone}`) : '';
  if (inboundText && providerPhone) {
    const inquiry = await findOpenProviderInquiryForSms({ providerPhone, reference: providerReferenceFromText(inboundText) });
    if (inquiry) {
      const sourceRef = String(body?.MessageId || body?.messageId || body?.id || '').trim() || `provider-sms:${inquiry.id}:${inboundText.slice(0, 96)}`;
      const parsed = parseProviderReply(inboundText);
      const outcome = await recordProviderInquiryResponse({
        ownerPhone: inquiry.ownerPhone, inquiryId: inquiry.id, providerIdentity: providerPhone, idempotencyKey: sourceRef, evidenceRef: sourceRef,
        response: { ...parsed, rawText: inboundText, channel: 'sms' },
        offer: { id: `provider-sms-${inquiry.id}-${sourceRef}`.slice(0, 240), providerId: inquiry.providerId, providerPhone, providerName: inquiry.providerName, title: inquiry.providerName ? `${inquiry.providerName} provider response` : 'Provider response', description: inboundText, priceMinor: parsed.priceMinor, currency: parsed.currency, availability: parsed.availability ? 'available' : 'unavailable', delivery: parsed.delivery, evidenceLevel: 'provider_confirmed', source: 'provider_inquiry' },
      });
      return { status: 'success', response: outcome.duplicate ? 'Provider response already processed.' : 'Provider response recorded.', duplicate: outcome.duplicate };
    }
  }
  const res = await smsHandlerInstance.handleWebhook(body, {});
  return { status: res.status, response: res.response, conversationId: res.conversationId, duplicate: res.duplicate };
}
