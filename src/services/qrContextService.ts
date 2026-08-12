import crypto from 'node:crypto';
import { isChannelConfigured } from '../channels/channelRegistry.js';

export type QrContextType = 'referral' | 'contributor' | 'network' | 'offer' | 'product' | 'location' | 'channel' | 'public';
export interface QrContext {
  type: QrContextType;
  ref?: string;
  source?: string;
  entity?: string;
  capability?: string;
  channel?: 'whatsapp' | 'telegram' | 'sms' | 'ussd' | 'web';
}

const TYPES = new Set<QrContextType>(['referral', 'contributor', 'network', 'offer', 'product', 'location', 'channel', 'public']);
const CHANNELS = new Set(['whatsapp', 'telegram', 'sms', 'ussd', 'web']);
const CONTEXT_KEYS = new Set(['context', 'type', 'ref', 'source', 'entity', 'capability', 'channel']);
const FORBIDDEN_METADATA_KEY = /(?:otp|pass(?:word)?|cookie|session|api[_-]?key|payment|credential|voice|token|phone|email|personal(?:_?data)?)/i;
const QR_TOKEN_MAX_LENGTH = 2048;

function clean(value: unknown, max: number, pattern = /^[a-zA-Z0-9 _.,:@/-]+$/): string | undefined {
  const text = String(value || '').trim();
  return text && text.length <= max && pattern.test(text) ? text : undefined;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

/** Reject any unbounded or credential-like metadata instead of silently dropping it. */
export function parseQrContext(input: Record<string, unknown>): QrContext | null {
  if (!isRecord(input)) return null;
  const keys = Object.keys(input);
  if (keys.some(key => FORBIDDEN_METADATA_KEY.test(key) || !CONTEXT_KEYS.has(key))) return null;

  const type = String(input.context || input.type || 'public').toLowerCase() as QrContextType;
  if (!TYPES.has(type)) return null;
  const ref = clean(input.ref, 32, /^[A-Z0-9]+$/i)?.toUpperCase();
  const source = clean(input.source, 96);
  const entity = clean(input.entity, 96);
  const capability = clean(input.capability, 96);
  const candidate = String(input.channel || '').toLowerCase();
  const channel = CHANNELS.has(candidate) ? candidate as QrContext['channel'] : undefined;
  if ((input.ref && !ref) || (input.source && !source) || (input.entity && !entity) || (input.capability && !capability) || (input.channel && !channel)) return null;
  return { type, ...(ref ? { ref } : {}), ...(source ? { source } : {}), ...(entity ? { entity } : {}), ...(capability ? { capability } : {}), ...(channel ? { channel } : {}) };
}

function secret(): string {
  return process.env.QR_CONTEXT_SECRET || process.env.JWT_SECRET || 'kurukoo-qr-development-context';
}

export function signQrContext(context: QrContext, expiresAt = Date.now() + 7 * 86400_000): string {
  const body = Buffer.from(JSON.stringify({ context, exp: expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyQrContext(token: string | undefined): QrContext | null {
  if (!token || token.length > QR_TOKEN_MAX_LENGTH) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return Number.isFinite(value.exp) && value.exp > Date.now() ? parseQrContext(value.context || {}) : null;
  } catch {
    return null;
  }
}

/** QR entry URLs carry only an opaque, signed, expiring context token. */
export function buildQrEntryUrl(base: string, context: QrContext): string {
  const url = new URL('/start', base);
  url.searchParams.set('qr', signQrContext(context));
  return url.toString();
}

export function qrActivationKey(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export async function applyQrReferralAttribution(guestPhone: string, userPhone: string): Promise<void> {
  if (!String(guestPhone).startsWith('anon_') || !userPhone) return;
  const { getDb } = await import('../database.js');
  const { findReferrerByCode, trackReferral } = await import('./referralService.js');
  const db = await getDb();
  const result = db.exec(`SELECT cm.metadata FROM chat_message_meta cm JOIN messages m ON m.id=cm.message_id WHERE m.phone=? ORDER BY m.id DESC LIMIT 20`, [userPhone]);
  for (const raw of result[0]?.values || []) {
    try {
      const metadata = JSON.parse(String(raw[0] || '{}'));
      const ref = metadata?.qr && metadata?.context?.type === 'referral' ? String(metadata.context.ref || '') : '';
      if (!/^[A-Z0-9]{1,32}$/i.test(ref)) continue;
      const referrer = await findReferrerByCode(ref);
      if (referrer && referrer !== userPhone) {
        await trackReferral(referrer, userPhone, ref.toUpperCase());
        return;
      }
    } catch {
      /* Ignore malformed historic metadata without changing referral ownership. */
    }
  }
}

export function describeQrContext(context: QrContext): string {
  if (context.type === 'referral') return 'You joined Kurukoo through a referral. What would you like to get done?';
  if (context.type === 'contributor') return 'You came through a contributor invitation. What would you like to explore?';
  if (context.type === 'network') return `You came through a Kurukoo network${context.capability ? ` capability for ${context.capability}` : ''}. How can I help?`;
  if (context.type === 'offer' || context.type === 'product') return `I see you came to ask about ${context.entity || context.capability || 'this offer'}. What do you need?`;
  if (context.type === 'location') return `I see this is relevant to ${context.entity || context.capability || 'this location'}. What would you like to get done?`;
  if (context.type === 'channel') {
    const channel = context.channel || 'web';
    return isChannelConfigured(channel)
      ? `${channel === 'web' ? 'Web Chat is available here' : `${channel} is configured for this deployment`}. You can continue in this Kurukoo conversation.`
      : `${channel} is not connected in this deployment. You can continue in Web Chat.`;
  }
  return 'Welcome to Kurukoo. What would you like to get done?';
}
