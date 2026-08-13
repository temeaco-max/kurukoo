import crypto from 'node:crypto';
import { type DeliveryState } from '../services/communicationDelivery.js';
import { clearFcmDeviceTokenIfMatches, getFcmDeviceToken } from '../services/memoryProfile.js';

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

interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

interface CachedFcmAccessToken {
  identity: string;
  accessToken: string;
  expiresAtMs: number;
}

let cachedFcmAccessToken: CachedFcmAccessToken | null = null;
const FCM_DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9:_-]{20,4096}$/;

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function loadFcmServiceAccount(): FcmServiceAccount | null {
  const raw = String(process.env.FCM_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw || raw.toLowerCase() === 'stub') return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const projectId = String(parsed.project_id || '').trim();
    const clientEmail = String(parsed.client_email || '').trim();
    const privateKey = String(parsed.private_key || '').replace(/\\n/g, '\n').trim();
    if (!projectId || !clientEmail || !privateKey.includes('BEGIN PRIVATE KEY')) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

async function getFcmAccessToken(account: FcmServiceAccount): Promise<string | null> {
  const identity = `${account.projectId}:${account.clientEmail}`;
  if (cachedFcmAccessToken?.identity === identity && cachedFcmAccessToken.expiresAtMs > Date.now() + 60_000) return cachedFcmAccessToken.accessToken;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: account.clientEmail,
    sub: account.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  }))}`;
  let signature: string;
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    signature = signer.sign(account.privateKey, 'base64url');
  } catch {
    return null;
  }
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const accessToken = typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
    const expiresIn = Math.max(60, Math.min(3_600, Number(payload.expires_in) || 3_000));
    if (!response.ok || !accessToken) return null;
    cachedFcmAccessToken = { identity, accessToken, expiresAtMs: Date.now() + expiresIn * 1_000 };
    return accessToken;
  } catch {
    return null;
  }
}

function fcmErrorCode(payload: any, status: number): string {
  const detail = Array.isArray(payload?.error?.details) ? payload.error.details.find((entry: any) => typeof entry?.errorCode === 'string') : undefined;
  return String(detail?.errorCode || payload?.error?.status || payload?.error?.message || `http_${status}`).slice(0, 160);
}

/**
 * FCM HTTP v1 accepts a message for delivery, but it does not provide a synchronous,
 * per-device delivery receipt. The shared ledger therefore records only `accepted`;
 * in-app notification reads remain the only immediate owner-scoped receipt signal.
 */
export async function sendFcmTransport(phone: string, text: string, metadata: Record<string, unknown> = {}): Promise<OutboundTransportResult> {
  const account = loadFcmServiceAccount();
  const deviceToken = (await getFcmDeviceToken(phone)) || '';
  if (!account) return { state: 'not_configured', errorCode: 'fcm_adapter_not_configured' };
  if (!FCM_DEVICE_TOKEN_PATTERN.test(deviceToken)) return { state: 'not_configured', errorCode: 'fcm_device_not_registered' };
  const accessToken = await getFcmAccessToken(account);
  if (!accessToken) return { state: 'failed', errorCode: 'fcm_authentication_failed' };
  const title = typeof metadata.title === 'string' && metadata.title.trim() ? metadata.title.trim().slice(0, 120) : 'Kurukoo update';
  const link = typeof metadata.link === 'string' && metadata.link.startsWith('/') && metadata.link.length <= 500 ? metadata.link : '/chat/';
  const deliveryId = typeof metadata.deliveryId === 'string' ? metadata.deliveryId.slice(0, 128) : '';
  const analyticsLabel = `kurukoo-${crypto.createHash('sha256').update(deliveryId || `${phone}:${Date.now()}`).digest('hex').slice(0, 24)}`;
  try {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body: text.slice(0, 4_096) },
          data: { link, ...(deliveryId ? { delivery_id: deliveryId } : {}) },
          webpush: { fcm_options: { link } },
          fcm_options: { analytics_label: analyticsLabel },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as any;
    const providerReference = typeof payload?.name === 'string' ? payload.name.slice(0, 300) : undefined;
    if (!response.ok || !providerReference) {
      const errorCode = fcmErrorCode(payload, response.status);
      if (errorCode === 'UNREGISTERED') await clearFcmDeviceTokenIfMatches(phone, deviceToken);
      return {
        state: 'failed',
        errorCode,
        metadata: { provider_acceptance_only: true, device_token_cleared: errorCode === 'UNREGISTERED' },
      };
    }
    return {
      state: 'accepted',
      providerReference,
      metadata: { provider_acceptance_only: true, per_message_receipt: 'not_supported', analytics_label: analyticsLabel },
    };
  } catch {
    return { state: 'failed', errorCode: 'fcm_network_error' };
  }
}

export async function dispatchOutboundTransport(channel: string, phone: string, text: string, metadata: Record<string, unknown> = {}): Promise<OutboundTransportResult> {
  switch (String(channel || '').toLowerCase()) {
    case 'sms': return sendSmsTransport(phone, text);
    case 'whatsapp': return sendWhatsAppTransport(phone, text, metadata);
    case 'telegram': return sendTelegramTransport(phone, text, metadata);
    case 'fcm': return sendFcmTransport(phone, text, metadata);
    default: return { state: 'not_configured', errorCode: 'outbound_transport_not_supported' };
  }
}
