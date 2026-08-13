import { DeliveryState } from '../services/communicationDelivery.js';

export interface OutboundTransportResult {
  state: Extract<DeliveryState, 'accepted' | 'failed' | 'not_configured'>;
  providerReference?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export async function sendSmsTransport(phone: string, text: string): Promise<OutboundTransportResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  const sender = process.env.AFRICASTALKING_SENDER_ID;
  if (!apiKey || !username || apiKey.toLowerCase() === 'stub' || username.toLowerCase() === 'stub') {
    return { state: 'not_configured', errorCode: 'sms_adapter_not_configured' };
  }
  const body = new URLSearchParams({
    username,
    to: phone,
    message: text.slice(0, 918),
    ...(sender ? { from: sender } : {}),
  });
  try {
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
    const payload = await response.json().catch(() => ({})) as any;
    const recipient = payload?.SMSMessageData?.Recipients?.[0] || {};
    const providerReference = String(recipient?.messageId || recipient?.message_id || '').trim() || undefined;
    const providerStatus = String(recipient?.status || '').toLowerCase();
    if (!response.ok || ['rejected', 'failed', 'expired', 'absentsubscriber', 'donotdisturbrejection'].includes(providerStatus)) {
      return {
        state: 'failed',
        providerReference,
        errorCode: String(recipient?.status || `http_${response.status}`).slice(0, 160),
        metadata: { provider_status: recipient?.status || null },
      };
    }
    return { state: 'accepted', providerReference, metadata: { provider_status: recipient?.status || null } };
  } catch (error) {
    return { state: 'failed', errorCode: error instanceof Error ? `network:${error.message.slice(0, 120)}` : 'sms_network_error' };
  }
}

export async function sendWhatsAppTransport(phone: string, text: string, metadata: Record<string, unknown> = {}): Promise<OutboundTransportResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = typeof metadata.phoneNumberId === 'string' ? metadata.phoneNumberId : process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { state: 'not_configured', errorCode: 'whatsapp_adapter_not_configured' };
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone.replace(/^\+/, ''), type: 'text', text: { body: text.slice(0, 4096) } }),
    });
    const payload = await response.json().catch(() => ({})) as any;
    const providerReference = payload?.messages?.[0]?.id ? String(payload.messages[0].id) : undefined;
    if (!response.ok || !providerReference) return { state: 'failed', errorCode: String(payload?.error?.message || `http_${response.status}`).slice(0, 160), providerReference };
    return { state: 'accepted', providerReference };
  } catch (error) {
    return { state: 'failed', errorCode: error instanceof Error ? error.message.slice(0, 160) : 'whatsapp_network_error' };
  }
}

export async function sendTelegramTransport(_phone: string, text: string, metadata: Record<string, unknown> = {}): Promise<OutboundTransportResult> {
  const chatId = metadata.chatId;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || (typeof chatId !== 'number' && typeof chatId !== 'string')) return { state: 'not_configured', errorCode: 'telegram_adapter_not_configured' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok || payload?.ok === false) return { state: 'failed', errorCode: String(payload?.description || `http_${response.status}`).slice(0, 160) };
    return { state: 'accepted', providerReference: payload?.result?.message_id == null ? undefined : String(payload.result.message_id) };
  } catch (error) {
    return { state: 'failed', errorCode: error instanceof Error ? error.message.slice(0, 160) : 'telegram_network_error' };
  }
}

export async function dispatchOutboundTransport(channel: string, phone: string, text: string, metadata: Record<string, unknown> = {}): Promise<OutboundTransportResult> {
  switch (String(channel || '').toLowerCase()) {
    case 'sms': return sendSmsTransport(phone, text);
    case 'whatsapp': return sendWhatsAppTransport(phone, text, metadata);
    case 'telegram': return sendTelegramTransport(phone, text, metadata);
    default: return { state: 'not_configured', errorCode: 'outbound_transport_not_supported' };
  }
}
