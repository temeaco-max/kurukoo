import crypto from 'node:crypto';
import { Router } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { appendChatMessage } from '../services/chatConversationService.js';
import { createVoiceSession, endVoiceSession, getVoiceSession, getVoiceStatus } from '../services/voiceService.js';
import { executeVoiceTool, isVoiceToolAllowed } from '../services/voiceToolRegistry.js';

const router = Router();
const sessionRateLimit = createRateLimiter({ windowMs: 60_000, max: Math.max(1, Math.min(20, Number(process.env.KURUKOO_VOICE_SESSION_RATE_LIMIT) || 5)), keyPrefix: 'voice-session', message: 'Voice session limit reached — try again shortly' });

function guestIdentity(req: any, res: any): string {
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map((value: string) => value.trim()).find((value: string) => value.startsWith('kurukoo_guest_id='));
  if (pair) return decodeURIComponent(pair.slice('kurukoo_guest_id='.length));
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

function identity(req: AuthRequest, res: any) {
  const phone = req.user?.phone ? String(req.user.phone) : guestIdentity(req, res);
  return { phone, isGuest: phone.startsWith('anon_') };
}

router.get('/status', optionalAuthenticateUser, (_req, res) => res.json({ voice: getVoiceStatus() }));

router.post('/session', optionalAuthenticateUser, sessionRateLimit, async (req: AuthRequest, res) => {
  const { phone, isGuest } = identity(req, res);
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.slice(0, 160) : undefined;
  try {
    const session = await createVoiceSession({ phone, conversationId, isGuest });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ voice: { ...session, guest: isGuest } });
  } catch (error: any) {
    const code = error?.code || 'VOICE_SESSION_ERROR';
    const status = code === 'VOICE_UNAVAILABLE' ? 503 : code === 'VOICE_CONCURRENT_LIMIT' ? 429 : 502;
    console.warn('[Voice] session_create_failed', { code, guest: isGuest });
    res.status(status).json({ error: error?.message || 'Voice is unavailable right now. You can continue by typing.', code });
  }
});

router.post('/tools', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const { phone, isGuest } = identity(req, res);
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  const args = req.body?.args;
  const session = getVoiceSession(sessionId, phone);
  if (!session) return res.status(404).json({ error: 'Voice session is unavailable.' });
  if (!isVoiceToolAllowed(name)) return res.status(403).json({ error: 'That voice action is not permitted.' });
  if (name === 'route_user_intent' && (typeof args?.text !== 'string' || args.text.trim().length === 0 || args.text.length > 4000)) return res.status(400).json({ error: 'Invalid spoken request.' });
  try {
    const result = await executeVoiceTool(name, args, { phone, conversationId: session.conversationId, isGuest, sessionId });
    console.info('[Voice] tool_executed', { sessionId, name, ok: result.ok !== false });
    res.json({ result });
  } catch (error) {
    console.warn('[Voice] tool_failed', { sessionId, name });
    res.status(500).json({ error: 'That request could not be completed right now.' });
  }
});

router.post('/transcript', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const { phone } = identity(req, res);
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const role = req.body?.role === 'assistant' ? 'assistant' : req.body?.role === 'user' ? 'user' : null;
  const content = typeof req.body?.content === 'string' ? req.body.content.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 4000) : '';
  const session = getVoiceSession(sessionId, phone);
  if (!session || !role || !content) return res.status(400).json({ error: 'Invalid voice transcript.' });
  try {
    const message = await appendChatMessage({ phone, sender: role, content, channel: 'web_voice', conversationId: session.conversationId, metadata: { voice: true, provider: 'gemini', model: getVoiceStatus().model, session_id: sessionId } });
    res.json({ messageId: message.id, conversationId: message.conversationId });
  } catch {
    res.status(500).json({ error: 'Transcript could not be saved.' });
  }
});

router.post('/end', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const { phone } = identity(req, res);
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 60) : 'client_disconnect';
  res.json({ ended: endVoiceSession(sessionId, phone, reason) });
});

export default router;
