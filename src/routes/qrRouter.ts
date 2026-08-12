import crypto from 'node:crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import { authenticateUser, optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { appendChatMessage, ensureConversation, listChatMessages } from '../services/chatConversationService.js';
import { generateReferralCode } from '../services/referralService.js';
import { buildQrEntryUrl, describeQrContext, parseQrContext, qrActivationKey, verifyQrContext, type QrContext } from '../services/qrContextService.js';

const router = Router();

function guest(req: any, res: any): string {
  const found = String(req.headers.cookie || '').split(';').map((item: string) => item.trim()).find((item: string) => item.startsWith('kurukoo_guest_id='));
  if (found) return decodeURIComponent(found.slice(17));
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

function owner(req: AuthRequest, res: any): { phone: string; isGuest: boolean } {
  const phone = req.user?.phone ? String(req.user.phone) : guest(req, res);
  return { phone, isGuest: phone.startsWith('anon_') };
}

function readGenerationContext(input: unknown): QrContext | null {
  return parseQrContext(input && typeof input === 'object' ? input as Record<string, unknown> : {});
}

function readSignedContext(input: any): { context: QrContext; token: string } | null {
  const token = typeof input?.qr === 'string' ? input.qr : '';
  const context = verifyQrContext(token);
  return context ? { context, token } : null;
}

function messageMetadata(row: any): Record<string, unknown> {
  try { return JSON.parse(String(row?.metadata || '{}')); } catch { return {}; }
}

router.post('/activate', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const signed = readSignedContext(req.body);
  if (!signed) return res.status(400).json({ error: 'This QR code is invalid, expired, or unsupported.' });

  const user = owner(req, res);
  const requestedConversationId = typeof req.body?.conversationId === 'string' && req.body.conversationId.length <= 128 ? req.body.conversationId : undefined;
  const conversationId = await ensureConversation(user.phone, requestedConversationId, 'unified');
  const activation = qrActivationKey(signed.token);
  const existing = (await listChatMessages(user.phone, { conversationId, limit: 100 })).find(row => {
    const metadata = messageMetadata(row);
    return metadata.qr === true && metadata.activation === activation;
  });
  const intro = describeQrContext(signed.context);
  const message = existing
    ? { id: Number(existing.id), conversationId }
    : await appendChatMessage({
      phone: user.phone,
      sender: 'assistant',
      content: intro,
      channel: 'web_qr',
      conversationId,
      metadata: { qr: true, activation, context: signed.context },
    });

  res.setHeader('Cache-Control', 'no-store');
  res.json({ conversationId, messageId: message.id, intro, context: signed.context, guest: user.isGuest, activated: !existing });
});

router.post('/generate', authenticateUser, async (req: AuthRequest, res) => {
  const requested = readGenerationContext(req.body);
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
