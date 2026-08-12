import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { authenticateUser, optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { deleteChatMessage, listChatConversations, listChatMessages, clearChatConversation, ensureConversation, appendChatMessage } from '../services/chatConversationService.js';
import { isOnboarding, handleOnboardingInput } from '../services/progressiveOnboarding.js';
import { routeIntent } from '../services/intentRouter.js';
import { getAuthState, setAuthState, handleConversationalAuth } from '../services/conversationalAuthService.js';
import { handleSafetyContactInput, setSafetyCaptureState } from '../services/safetyService.js';
import { finalizeOrder } from '../services/orderFinalizer.js';
import { migrateGuestSessionToAccount } from '../services/guestSessionMigration.js';
import { applyQrReferralAttribution } from '../services/qrContextService.js';
import { streamUnifiedAI } from '../services/unifiedAiEngine.js';
import economicRequestRouter from './economicRequestRouter.js';
import { createConversationGoal } from '../services/agentRuntime.js';

const router = Router();

// Authentication is owned exclusively by /api/auth. Keep retired chat-scoped auth paths
// visibly absent rather than allowing another middleware to report an authorization error.
router.all('/auth/*', (_req, res) => res.status(404).json({ error: 'Not found' }));

function getGuestPhone(req: any, res: any): string {
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map(v => v.trim()).find(v => v.startsWith('kurukoo_guest_id='));
  if (pair) return decodeURIComponent(pair.slice(17));
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

function userPhone(req: AuthRequest, res?: any): string | null {
  if (req.user?.phone) return String(req.user.phone);
  if (res) return getGuestPhone(req, res);
  return null;
}

router.use('/economic-requests', authenticateUser, economicRequestRouter);
function sse(res: any, payload: any) { res.write(`data: ${JSON.stringify(payload)}\n\n`); }
function chunkText(text: string): string[] { const chunks: string[] = []; const source = String(text || ''); for (let i = 0; i < source.length; i += 24) chunks.push(source.slice(i, i + 24)); return chunks; }

router.post('/stream', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req, res);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 30) : 'web';
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined;
  const attachment = req.body?.attachment;

  if (!phone || !message) return res.status(400).json({ error: 'Message is required' });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let fullReply = '';
  let cardData: any = null;
  let activeConversation = conversationId;
  const isGuest = phone.startsWith('anon_');

  try {
    const savedUser = await appendChatMessage({ phone, sender: 'user', content: message, channel, conversationId, metadata: attachment ? { attachment } : undefined });
    activeConversation = savedUser.conversationId;
    sse(res, { type: 'conversation', conversationId: activeConversation, messageId: savedUser.id });
    // The web client consumes stream status events in the existing real-time response
    // channel; no second conversation or transport is introduced for typing presence.
    sse(res, { type: 'status', status: 'typing', label: 'Kurukoo is typing…' });

    // Handle conversational auth for guests
    const authState = isGuest ? await getAuthState(phone) : { state: 'none' };
    
    // Check for safety capture state
    const db = await getDb();
    const profileStmt = db.prepare('SELECT preferences FROM memory_profiles WHERE phone = ?');
    profileStmt.bind([phone]);
    let prefs: any = {};
    if (profileStmt.step()) {
      const obj = profileStmt.getAsObject();
      prefs = obj.preferences ? JSON.parse(String(obj.preferences)) : {};
    }
    profileStmt.free();
    const safetyState = prefs.safety_capture_state || 'none';

    if (isGuest && authState.state !== 'none') {
      const authResult = await handleConversationalAuth(phone, message);
      fullReply = authResult.reply;
      cardData = authResult.cardData;
      
      if (authResult.authenticated && authResult.token && authResult.phone) {
        // Authenticated! Issue cookies and migrate.
        const token = authResult.token;
        const userPhoneValue = authResult.phone;
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        res.setHeader('Set-Cookie', [
          `kurukoo_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
          `kurukoo_guest_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
        ]);
        
        await migrateGuestSessionToAccount(phone, userPhoneValue);
        await applyQrReferralAttribution(phone, userPhoneValue).catch(() => undefined);
        
        sse(res, { type: 'auth_success', phone: userPhoneValue });
      }
      
      for (const chunk of chunkText(fullReply)) {
        sse(res, { type: 'text', content: chunk });
        await new Promise(r => setTimeout(r, 8));
      }
    } else if (!isGuest && safetyState !== 'none') {
      const safetyResult = await handleSafetyContactInput(phone, message);
      fullReply = safetyResult.reply;
      cardData = safetyResult.cardData;
      for (const chunk of chunkText(fullReply)) {
        sse(res, { type: 'text', content: chunk });
        await new Promise(r => setTimeout(r, 8));
      }
    } else if (!isGuest && await isOnboarding(phone)) {
      const onboarding = await handleOnboardingInput(phone, message);
      fullReply = onboarding.reply;
      cardData = onboarding.cardData;
      for (const chunk of chunkText(fullReply)) {
        sse(res, { type: 'text', content: chunk });
        await new Promise(r => setTimeout(r, 8));
      }
    } else {
      const routing = await routeIntent(message, phone);
      cardData = routing.cardData;
      const agentGoal = !isGuest ? await createConversationGoal({
        phone,
        conversationId: activeConversation,
        skill: routing.skill,
        objective: message,
        economicRequestId: typeof cardData?.requestId === 'string' ? cardData.requestId : undefined,
        source: channel === 'web_qr' ? 'qr' : 'conversation',
      }) : null;
      if (agentGoal) sse(res, { type: 'agent_goal', goal: { id: agentGoal.id, status: agentGoal.status, objective: agentGoal.objective, summary: agentGoal.summary, autonomy: agentGoal.autonomy, economicRequestId: agentGoal.economicRequestId || null } });

      if (routing.skill && routing.skill !== 'general_question' && routing.skill !== 'autonomous_agent') {
        if (isGuest) {
          // Start conversational identity flow
          await setAuthState(phone, 'awaiting_name', { intent: routing.skill, continuationCard: cardData });
          fullReply = `${routing.reply}\n\nI can help with that. Before I save this for you, let's create your Kurukoo profile. What's your name?`;
          cardData = {
            type: 'auth_in_chat_start',
            title: 'Create Your Profile',
            message: 'Your request is captured. Tell me your name to continue.',
            continuationCard: routing.cardData
          };
        } else if (cardData?.type === 'safety_contact_capture') {
          await setSafetyCaptureState(phone, 'awaiting_phone', { name: cardData.name });
          fullReply = routing.reply;
        } else if (cardData?.type === 'agentic_storefront' || routing.skill === 'reminder') {
          // Native assistance remains in the shared conversation but must not
          // create an Economic Request, lead charge, or order.
          fullReply = routing.reply;
        } else {
          let orderMessage = '';
          try {
            const orderResult = await finalizeOrder(phone, 'lead', { skill: routing.skill });
            orderMessage = orderResult.message || '';
          } catch (error) {
            console.warn('[Chat] skill finalization deferred:', error);
          }
          fullReply = `${routing.reply}${orderMessage ? ` (${orderMessage})` : ''}`.trim();
        }
        for (const chunk of chunkText(fullReply)) {
          sse(res, { type: 'text', content: chunk });
          await new Promise(r => setTimeout(r, 8));
        }
      } else {
        sse(res, { type: 'status', status: 'thinking', label: 'Kurukoo is considering the best next step…' });
        for await (const chunk of streamUnifiedAI(message, { phone, threadId: activeConversation })) {
          if (chunk.type === 'metadata' || chunk.type === 'thought') sse(res, chunk);
          else if (chunk.type === 'text' && chunk.content) {
            fullReply += chunk.content;
            sse(res, chunk);
          }
        }
      }
    }

    const savedAssistant = await appendChatMessage({ phone, sender: 'assistant', content: fullReply.trim(), channel, conversationId: activeConversation, cardData, metadata: { ai: true } });
    sse(res, { type: 'status', status: 'complete' });
    sse(res, { type: 'done', fullReply: fullReply.trim(), cardData, conversationId: activeConversation, messageId: savedAssistant.id });
    sse(res, '[DONE]');
    res.end();
  } catch (error: any) {
    console.error('[Chat] unified stream failed:', error);
    if (!res.writableEnded) {
      sse(res, { type: 'status', status: 'error' });
      sse(res, { type: 'error', error: 'Unable to complete your request right now.' });
      sse(res, '[DONE]');
      res.end();
    }
  }
});

router.get('/history', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req, res);
  if (!phone) return res.status(401).json({ error: 'Phone is required' });
  const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
  const beforeId = typeof req.query.beforeId === 'string' ? Number(req.query.beforeId) : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
  try {
    const [conversations, messages] = await Promise.all([listChatConversations(phone, 50), listChatMessages(phone, { conversationId, beforeId, limit })]);
    res.json({ success: true, conversations, messages, nextBeforeId: messages.length ? messages[0].id : null });
  } catch (error) {
    console.error('[Chat] history failed:', error);
    res.status(500).json({ error: 'Unable to load conversation history' });
  }
});
router.post('/conversation', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req, res);
  if (!phone) return res.status(401).json({ error: 'Phone is required' });
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 30) : 'web';
  const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 120) : undefined;
  try {
    const id = await ensureConversation(phone, undefined, channel, title);
    res.json({ success: true, conversationId: id });
  } catch (error) {
    console.error('[Chat] conversation create failed:', error);
    res.status(500).json({ error: 'Unable to create conversation' });
  }
});

router.delete('/message/:id', async (req: AuthRequest, res) => { const phone = userPhone(req); const id = Number(req.params.id); if (!phone || !Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid message ID' }); try { const deleted = await deleteChatMessage(phone, id); if (!deleted) return res.status(404).json({ error: 'Message not found' }); res.json({ success: true }); } catch (error) { console.error('[Chat] message delete failed:', error); res.status(500).json({ error: 'Unable to delete message' }); } });
router.delete('/conversation/:id', async (req: AuthRequest, res) => { const phone = userPhone(req); const conversationId = String(req.params.id || ''); if (!phone || !conversationId) return res.status(400).json({ error: 'Invalid conversation ID' }); try { const deleted = await clearChatConversation(phone, conversationId); res.json({ success: true, deleted }); } catch (error) { console.error('[Chat] conversation delete failed:', error); res.status(500).json({ error: 'Unable to delete conversation' }); } });
router.post('/attachments', async (req: AuthRequest, res) => { const phone = userPhone(req); if (!phone) return res.status(401).json({ error: 'Authenticated phone is required' }); const { name, type, data } = req.body || {}; if (typeof name !== 'string' || typeof type !== 'string' || typeof data !== 'string') return res.status(400).json({ error: 'name, type and data are required' }); const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','video/mp4','video/webm']); if (!allowed.has(type)) return res.status(415).json({ error: 'Unsupported attachment type' }); const raw = data.replace(/^data:[^;]+;base64,/, ''); const bytes = Buffer.byteLength(raw, 'base64'); const limit = type.startsWith('video/') ? 25 * 1024 * 1024 : 10 * 1024 * 1024; if (bytes > limit) return res.status(413).json({ error: `Attachment exceeds ${Math.floor(limit / 1024 / 1024)}MB limit` }); const safeExt = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 8) || '.bin'; const dir = process.env.CHAT_UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads', 'chat'); await fs.mkdir(dir, { recursive: true }); const filename = `${crypto.createHash('sha256').update(`${phone}:${Date.now()}:${Math.random()}`).digest('hex').slice(0,32)}${safeExt}`; await fs.writeFile(path.join(dir, filename), Buffer.from(raw, 'base64'), { flag: 'wx' }); res.json({ success: true, attachment: { url: `/uploads/chat/${filename}`, name: name.slice(0,160), type, size: bytes } }); });

export default router;
