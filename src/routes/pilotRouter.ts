import crypto from 'node:crypto';
import { Router } from 'express';
import { optionalAuthenticateUser, AuthRequest } from '../middleware/auth.js';
import { emitPilotEvent, recordPilotFeedback } from '../services/pilotObservability.js';

const router = Router();

function guestSession(req: any, res: any): string {
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map((value: string) => value.trim()).find((value: string) => value.startsWith('kurukoo_guest_id='));
  if (pair) return decodeURIComponent(pair.slice('kurukoo_guest_id='.length)).slice(0, 160);
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

router.post('/pilot/feedback', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const rating = String(req.body?.rating || '');
  if (!['helpful', 'not_helpful', 'something_wrong'].includes(rating)) {
    return res.status(400).json({ error: 'Choose helpful, not_helpful, or something_wrong.' });
  }
  const sessionId = guestSession(req, res);
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.slice(0, 120) : null;
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId.slice(0, 120) : null;
  const messageId = Number.isInteger(req.body?.messageId) ? Number(req.body.messageId) : null;
  try {
    await recordPilotFeedback({
      ownerId: req.user?.phone ? String(req.user.phone) : null,
      sessionId,
      conversationId,
      requestId,
      messageId,
      rating: rating as 'helpful' | 'not_helpful' | 'something_wrong',
      note: typeof req.body?.note === 'string' ? req.body.note : null,
      context: { surface: 'conversation', channel: String(req.body?.channel || 'web').slice(0, 40) },
    });
    res.status(201).json({ success: true, message: 'Feedback recorded. It will not interrupt your conversation.' });
  } catch (error) {
    await emitPilotEvent({ event: 'error_boundary', sessionId, conversationId, requestId, status: 'failed', context: { error_class: 'feedback_write' } });
    res.status(503).json({ error: 'Feedback is temporarily unavailable. You can continue your conversation.' });
  }
});

export default router;
