import crypto from 'node:crypto';

export type QrContextType = 'referral' | 'contributor' | 'network' | 'offer' | 'product' | 'location' | 'channel' | 'public';
export interface QrContext { type: QrContextType; ref?: string; source?: string; entity?: string; capability?: string; channel?: 'whatsapp' | 'telegram' | 'sms' | 'ussd' | 'web'; }
const TYPES = new Set<QrContextType>(['referral','contributor','network','offer','product','location','channel','public']);
const CHANNELS = new Set(['whatsapp','telegram','sms','ussd','web']);
const clean = (value: unknown, max: number, pattern = /^[a-zA-Z0-9 _.,:@/-]+$/) => { const text = String(value || '').trim(); return text && text.length <= max && pattern.test(text) ? text : undefined; };

export function parseQrContext(input: Record<string, unknown>): QrContext | null {
  const type = String(input.context || input.type || 'public').toLowerCase() as QrContextType;
  if (!TYPES.has(type)) return null;
  const ref = clean(input.ref, 32, /^[A-Z0-9]+$/i)?.toUpperCase();
  const source = clean(input.source, 96);
  const entity = clean(input.entity, 96);
  const capability = clean(input.capability, 96);
  const candidate = String(input.channel || '').toLowerCase();
  const channel = CHANNELS.has(candidate) ? candidate as QrContext['channel'] : undefined;
  if (input.ref && !ref || input.source && !source || input.entity && !entity || input.capability && !capability || input.channel && !channel) return null;
  return { type, ...(ref ? { ref } : {}), ...(source ? { source } : {}), ...(entity ? { entity } : {}), ...(capability ? { capability } : {}), ...(channel ? { channel } : {}) };
}

const secret = () => process.env.QR_CONTEXT_SECRET || process.env.JWT_SECRET || 'kurukoo-qr-development-context';
export function signQrContext(context: QrContext): string { const body = Buffer.from(JSON.stringify({ context, exp: Date.now() + 7 * 86400_000 })).toString('base64url'); const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url'); return `${body}.${sig}`; }
export function verifyQrContext(token: string | undefined): QrContext | null { if (!token || token.length > 2048) return null; const [body, sig] = token.split('.'); if (!body || !sig) return null; const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url'); if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; try { const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return value.exp > Date.now() ? parseQrContext(value.context || {}) : null; } catch { return null; } }
export function buildQrEntryUrl(base: string, context: QrContext): string { const url = new URL('/start', base); url.searchParams.set('context', context.type); for (const [key, value] of Object.entries(context)) if (key !== 'type' && value) url.searchParams.set(key === 'type' ? 'context' : key, String(value)); return url.toString(); }
export async function applyQrReferralAttribution(guestPhone: string, userPhone: string): Promise<void> { const { getDb } = await import('../database.js'); const { findReferrerByCode, trackReferral } = await import('./referralService.js'); const db = await getDb(); const result = db.exec(`SELECT cm.metadata FROM chat_message_meta cm JOIN messages m ON m.id=cm.message_id WHERE m.phone=? ORDER BY m.id DESC LIMIT 20`, [userPhone]); for (const raw of result[0]?.values || []) { try { const meta = JSON.parse(String(raw[0] || '{}')); const ref = meta?.qr && meta?.context?.type === 'referral' ? String(meta.context.ref || '') : ''; if (!/^[A-Z0-9]{1,32}$/i.test(ref)) continue; const referrer = await findReferrerByCode(ref); if (referrer && referrer !== userPhone) { await trackReferral(referrer, userPhone, ref.toUpperCase()); return; } } catch {} } }

export function describeQrContext(context: QrContext): string { if (context.type === 'referral') return 'You joined Kurukoo through a referral. What would you like to get done?'; if (context.type === 'contributor') return 'You came through a contributor invitation. What would you like to explore?'; if (context.type === 'network') return `You came through a Kurukoo network${context.capability ? ` capability for ${context.capability}` : ''}. How can I help?`; if (context.type === 'offer' || context.type === 'product') return `I see you came to ask about ${context.entity || context.capability || 'this offer'}. What do you need?`; if (context.type === 'channel') return `${context.channel || 'This'} channel is ${context.channel === 'web' ? 'available here' : 'not connected in this deployment'}. You can continue in Web Chat.`; return 'Welcome to Kurukoo. What would you like to get done?'; }
