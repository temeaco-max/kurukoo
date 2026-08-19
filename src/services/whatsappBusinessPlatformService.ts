import crypto from 'node:crypto';
import { processCanonicalChatTurn } from './canonicalChatTurnService.js';

export interface WhatsAppBusinessStatus {
  enabled: boolean;
  configured: boolean;
  featureFlag: boolean;
  phoneNumberId: string | null;
  graphApiVersion: string;
  webhookConfigured: boolean;
  liveVerified: boolean;
}

export interface WhatsAppWebhookMessage {
  from: string;
  messageId: string;
  text: string;
  timestamp?: string;
}

function configured(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return Boolean(text) && !['stub', 'unconfigured', 'change_me'].includes(text.toLowerCase()) && !text.toLowerCase().startsWith('change_me');
}

function graphVersion(): string {
  return String(process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0').trim();
}

export function getWhatsAppBusinessStatus(): WhatsAppBusinessStatus {
  const featureFlag = process.env.FF_WHATSAPP_BUSINESS === 'true';
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim() || null;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const configuredAll = configured(phoneNumberId) && configured(token) && configured(appSecret) && configured(verifyToken);
  return {
    enabled: featureFlag && configuredAll,
    configured: configuredAll,
    featureFlag,
    phoneNumberId,
    graphApiVersion: graphVersion(),
    webhookConfigured: configured(verifyToken) && configured(appSecret),
    liveVerified: process.env.WHATSAPP_BUSINESS_LIVE_VERIFIED === 'true',
  };
}

export function verifyWhatsAppWebhook(mode: unknown, token: unknown, challenge: unknown): string | null {
  const expectedToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();
  if (String(mode || '') !== 'subscribe' || !expectedToken || String(token || '') !== expectedToken) return null;
  return String(challenge || '');
}

export function verifyWhatsAppSignature(rawBody: Buffer | string, signatureHeader: unknown): boolean {
  const secret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  const signature = String(signatureHeader || '').trim();
  if (!secret || !signature.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function normalizeWhatsAppBusinessWebhook(payload: any): WhatsAppWebhookMessage[] {
  const messages: WhatsAppWebhookMessage[] = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      for (const message of Array.isArray(value?.messages) ? value.messages : []) {
        const text = String(message?.text?.body || '').trim();
        const from = String(message?.from || '').trim();
        const messageId = String(message?.id || '').trim();
        if (!from || !messageId || !text) continue;
        messages.push({ from: from.startsWith('+') ? from : `+${from}`, messageId, text, timestamp: String(message?.timestamp || '').trim() || undefined });
      }
    }
  }
  return messages;
}

export async function processWhatsAppBusinessWebhook(payload: any): Promise<{ accepted: number; ignored: number; replies: Array<{ phone: string; text: string }> }> {
  const status = getWhatsAppBusinessStatus();
  if (!status.enabled) return { accepted: 0, ignored: 0, replies: [] };
  const inbound = normalizeWhatsAppBusinessWebhook(payload);
  const replies: Array<{ phone: string; text: string }> = [];
  let accepted = 0;
  for (const message of inbound) {
    try {
      const turn = await processCanonicalChatTurn({ phone: message.from, message: message.text, channel: 'whatsapp' });
      replies.push({ phone: message.from, text: turn.reply });
      accepted += 1;
    } catch {
      // Webhook ingestion remains idempotent and fail-closed; external sending is separate.
    }
  }
  return { accepted, ignored: inbound.length - accepted, replies };
}

export async function sendWhatsAppBusinessText(phone: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const status = getWhatsAppBusinessStatus();
  if (!status.enabled || !status.phoneNumberId || !configured(process.env.WHATSAPP_ACCESS_TOKEN)) return { ok: false, error: 'whatsapp_business_disabled_or_unconfigured' };
  const recipient = String(phone || '').trim();
  const body = String(text || '').trim();
  if (!recipient || !body) return { ok: false, error: 'recipient_or_text_missing' };
  const response = await fetch(`https://graph.facebook.com/${status.graphApiVersion}/${encodeURIComponent(status.phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient.replace(/^\+/, ''), type: 'text', text: { body } }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: String(payload?.error?.message || `whatsapp_business_http_${response.status}`) };
  const messageId = String(payload?.messages?.[0]?.id || '').trim() || undefined;
  return { ok: true, messageId };
}
