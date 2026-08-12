import crypto from 'node:crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import { authenticateUser, optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { appendChatMessage, ensureConversation } from '../services/chatConversationService.js';
import { generateReferralCode } from '../services/referralService.js';
import { buildQrEntryUrl, describeQrContext, parseQrContext, type QrContext } from '../services/qrContextService.js';

const router = Router();
function guest(req: any, res: any) { const found = String(req.headers.cookie || '').split(';').map((item: string) => item.trim()).find((item: string) => item.startsWith('kurukoo_guest_id=')); if (found) return decodeURIComponent(found.slice(17)); const id = `anon_${crypto.randomUUID()}`; const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`); return id; }
function owner(req: AuthRequest, res: any) { const phone = req.user?.phone ? String(req.user.phone) : guest(req, res); return { phone, isGuest: phone.startsWith('anon_') }; }
function readContext(input: any): QrContext | null { return parseQrContext(input && typeof input === 'object' ? input : {}); }

router.post('/activate', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const context = readContext(req.body);
  if (!context) return res.status(400).json({ error: 'This QR code is invalid or unsupported.' });
  const user = owner(req, res);
  const conversationId = await ensureConversation(user.phone, typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined, 'unified');
  const intro = describeQrContext(context);
  const message = await appendChatMessage({ phone: user.phone, sender: 'assistant', content: intro, channel: 'web_qr', conversationId, metadata: { qr: true, context } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ conversationId, messageId: message.id, intro, context, guest: user.isGuest });
});

router.post('/generate', authenticateUser, async (req: AuthRequest, res) => {
  const requested = readContext(req.body);
  if (!requested) return res.status(400).json({ error: 'Invalid QR context.' });
  const phone = String(req.user?.phone || '');
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const context = requested.type === 'referral' ? { ...requested, ref: await generateReferralCode(phone) } : requested;
  const base = `${req.protocol}://${req.get('host')}`;
  const entryUrl = buildQrEntryUrl(base, context);
  const svg = await QRCode.toString(entryUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2E2E2E', light: '#FFF8F0' } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ context, entryUrl, svg, description: describeQrContext(context) });
});

export default router;
