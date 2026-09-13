/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { authenticateUser, optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';
import { deleteChatMessage, listChatConversations, listChatMessages, clearChatConversation, ensureConversation, appendChatMessage } from '../services/chatConversationService.js';
import { migrateGuestSessionToAccount } from '../services/guestSessionMigration.js';
import { applyQrReferralAttribution } from '../services/qrContextService.js';
import { processCanonicalChatTurn } from '../services/canonicalChatTurnService.js';
import { getAuthState, setAuthState } from '../services/conversationalAuthService.js';
import { inspectAttachmentSecurity } from '../services/attachmentSecurityBoundary.js';
import { checkCompliance } from '../services/complianceFilter.js';
import economicRequestRouter from './economicRequestRouter.js';
import { listUniversalCapabilities } from '../services/universalCapabilityProtocol.js';
import { normalizeChannel, Channel } from '../services/channelIdentifiers.js';
import { executeCanonicalCapabilityProposal } from '../services/canonicalCapabilityExecutor.js';

const router = Router();

// Start the compact in-chat identity conversation for a guest without creating a
// second auth system. Existing phone/OTP progress is never overwritten.
router.post('/auth/start', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req, res);
  if (!phone) return res.status(401).json({ error: 'Guest session is unavailable' });
  if (!phone.startsWith('anon_')) return res.json({ success: true, authenticated: true });
  const current = await getAuthState(phone);
  if (current.state === 'none') await setAuthState(phone, 'awaiting_name', {});
  res.json({ success: true, state: current.state === 'none' ? 'awaiting_name' : current.state });
});

// Authentication is otherwise owned exclusively by /api/auth. Keep retired
// chat-scoped auth paths visibly absent rather than allowing another middleware
// to report an authorization error.
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

router.post('/action', authenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req);
  const body = req.body?.proposal && typeof req.body.proposal === 'object' ? { ...req.body.proposal, ...req.body } : req.body || {};
  if (!phone || phone.startsWith('anon_')) return res.status(401).json({ error: 'Authenticated owner is required' });
  if (typeof body.capability !== 'string' || typeof body.action !== 'string') return res.status(400).json({ error: 'capability and action are required' });
  try {
    const result = await executeCanonicalCapabilityProposal({
      phone,
      capability: body.capability.slice(0, 120),
      action: body.action.slice(0, 120),
      contextId: typeof body.contextId === 'string' ? body.contextId.slice(0, 180) : undefined,
      canonicalObjectId: typeof body.canonicalObjectId === 'string' ? body.canonicalObjectId.slice(0, 180) : undefined,
      arguments: body.arguments && typeof body.arguments === 'object' ? body.arguments : undefined,
      confidence: body.confidence,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined,
      confirmationRequired: Boolean(body.confirmationRequired),
      confirmationGranted: Boolean(body.confirmationGranted || body.confirmed),
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 180) : undefined,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId.slice(0, 180) : undefined,
      channel: typeof body.channel === 'string' ? body.channel.slice(0, 30) : undefined,
    });
    const statusCode = result.status === 'unauthorized' ? 403 : result.status === 'invalid' ? 400 : result.status === 'stale_context' ? 409 : 200;
    res.status(statusCode).json({ success: !['invalid', 'unauthorized', 'stale_context', 'failed', 'blocked'].includes(result.status), protocol: 'kurukoo-universal-capability-v1', result });
  } catch (error) {
    console.error('[Chat] canonical capability action failed:', error);
    res.status(500).json({ error: 'Unable to execute the canonical capability action' });
  }
});

router.get('/capabilities', async (req: AuthRequest, res) => {
  try {
    const requestedMode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
    const catalog = await listUniversalCapabilities();
    const capabilities = requestedMode ? catalog.filter(item => item.mode === requestedMode) : catalog;
    res.json({
      success: true,
      protocol: 'kurukoo-universal-capability-v1',
      canonicalOwners: ['canonicalChatTurnService', 'canonical domain services', 'agentRuntime'],
      capabilities,
    });
  } catch (error) {
    console.error('[Chat] capability catalog failed:', error);
    res.status(500).json({ error: 'Unable to load the canonical capability catalog' });
  }
});

function sse(res: any, payload: any) { res.write(`data: ${JSON.stringify(payload)}\n\n`); }
function chunkText(text: string): string[] { const chunks: string[] = []; const source = String(text || ''); for (let i = 0; i < source.length; i += 24) chunks.push(source.slice(i, i + 24)); return chunks; }

router.post('/stream', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req, res);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const channelInput = typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 30) : '';
  const channel = normalizeChannel(channelInput);
  if (channel === null) return res.status(400).json({ error: 'Unsupported channel' });
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined;
  const attachment = req.body?.attachment;
  const contextAction = req.body?.contextAction && typeof req.body.contextAction === 'object' ? {
    type: typeof req.body.contextAction.type === 'string' ? req.body.contextAction.type.slice(0, 80) : '',
    entityId: typeof req.body.contextAction.entityId === 'string' ? req.body.contextAction.entityId.slice(0, 180) : undefined,
    contextId: typeof req.body.contextAction.contextId === 'string' ? req.body.contextAction.contextId.slice(0, 180) : undefined,
    conversationId: typeof req.body.contextAction.conversationId === 'string' ? req.body.contextAction.conversationId.slice(0, 180) : undefined,
    canonicalAction: typeof req.body.contextAction.canonicalAction === 'string' ? req.body.contextAction.canonicalAction.slice(0, 120) : undefined,
    objectType: typeof req.body.contextAction.objectType === 'string' ? req.body.contextAction.objectType.slice(0, 80) : undefined,
    objectId: typeof req.body.contextAction.objectId === 'string' ? req.body.contextAction.objectId.slice(0, 180) : undefined,
  } : undefined;

  if (!phone || !message) return res.status(400).json({ error: 'Message is required' });

  // Safety gate: run user-generated content through the compliance boundary
  // before it enters the AI pipeline. Blocks scam keywords/patterns from
  // reaching conversation modelling, economic routing, or provider matching.
  const complianceOk = await checkCompliance(phone, message).catch(() => true);
  if (!complianceOk) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    sse(res, { type: 'status', status: 'error' });
    sse(res, { type: 'error', error: 'This message looks like it may not be safe. Please rephrase and try again.' });
    sse(res, '[DONE]');
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullReply = '';
  let cardData: any = null;
  let activeConversation = conversationId;

  try {
    const turn = await processCanonicalChatTurn({ phone, message, channel, conversationId, attachment, contextAction });
    activeConversation = turn.conversationId;
    fullReply = turn.reply;
    cardData = turn.cardData;
    if (turn.authSuccess) {
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', [
        'kurukoo_auth=' + encodeURIComponent(turn.authSuccess.token) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800' + secure,
        'kurukoo_guest_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + secure
      ]);
      await migrateGuestSessionToAccount(phone, turn.authSuccess.phone);
      await applyQrReferralAttribution(phone, turn.authSuccess.phone).catch(() => undefined);
    }
    // Authentication may complete inside this turn. Flush only after any
    // HttpOnly session migration headers have been attached.
    res.flushHeaders?.();
    sse(res, { type: 'status', status: 'processing', label: 'Kurukoo is checking your request…', grounded: true });
    sse(res, { type: 'conversation', conversationId: activeConversation, messageId: turn.userMessageId });
    sse(res, { type: 'status', status: 'typing', label: 'Kurukoo is typing…' });
    if (turn.progressStage && turn.progressStage !== 'complete') sse(res, { type: 'progress', stage: turn.progressStage, label: turn.progressStage === 'understanding' ? 'Understanding your request…' : turn.progressStage === 'checking' ? 'Checking the available Kurukoo state…' : turn.progressStage === 'coordinating' ? 'Preparing the next supported step…' : 'Preparing your request…', grounded: true });
    if (turn.authSuccess) sse(res, { type: 'auth_success', phone: turn.authSuccess.phone });
    if (turn.agentGoal) sse(res, { type: 'agent_goal', goal: turn.agentGoal });
    if (turn.capabilityResult) sse(res, { type: 'capability_result', result: turn.capabilityResult });
    for (const chunk of chunkText(fullReply)) sse(res, { type: 'text', content: chunk });
    sse(res, { type: 'status', status: 'complete' });
    sse(res, { type: 'done', fullReply: fullReply.trim(), cardData, conversationId: activeConversation, diagnostics: { classificationSource: turn.classificationSource, intentConfidence: turn.intentConfidence, modelProvider: turn.modelProvider, model: turn.model, latencyMs: turn.latencyMs, extractionSource: turn.extractionSource, extractedEntities: turn.extractedEntities, canonicalAction: turn.canonicalAction, progressStage: turn.progressStage, contextDecision: turn.contextDecision ? { selectedContext: turn.contextDecision.selectedContext, selectedContextId: turn.contextDecision.selectedContextId, relation: turn.contextDecision.relation, confidence: turn.contextDecision.confidence, ambiguous: turn.contextDecision.ambiguous, preserveContextIds: turn.contextDecision.preserveContextIds } : undefined, capabilityResult: turn.capabilityResult, finalState: cardData?.status || cardData?.state || cardData?.stage } });
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
  const channel = normalizeChannel(typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 30) : '') ?? Channel.WEB;
  const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 120) : undefined;
  try {
    const id = await ensureConversation(phone, undefined, channel, title, true);
    res.json({ success: true, conversationId: id });
  } catch (error) {
    console.error('[Chat] conversation create failed:', error);
    res.status(500).json({ error: 'Unable to create conversation' });
  }
});

router.delete('/message/:id', async (req: AuthRequest, res) => { const phone = userPhone(req); const id = Number(req.params.id); if (!phone || !Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid message ID' }); try { const deleted = await deleteChatMessage(phone, id); if (!deleted) return res.status(404).json({ error: 'Message not found' }); res.json({ success: true }); } catch (error) { console.error('[Chat] message delete failed:', error); res.status(500).json({ error: 'Unable to delete message' }); } });
router.delete('/conversation/:id', async (req: AuthRequest, res) => { const phone = userPhone(req); const conversationId = String(req.params.id || ''); if (!phone || !conversationId) return res.status(400).json({ error: 'Invalid conversation ID' }); try { const deleted = await clearChatConversation(phone, conversationId); res.json({ success: true, deleted }); } catch (error) { console.error('[Chat] conversation delete failed:', error); res.status(500).json({ error: 'Unable to delete conversation' }); } });
async function ensurePrivateAttachmentTable(db: any) {
  db.run(`CREATE TABLE IF NOT EXISTS chat_attachments (id TEXT PRIMARY KEY, phone TEXT NOT NULL, stored_path TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, message_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL)`);
  db.run('CREATE INDEX IF NOT EXISTS idx_chat_attachments_owner_expiry ON chat_attachments(phone, expires_at)');
}
function privateAttachmentDir(): string {
  const configured = process.env.CHAT_UPLOAD_DIR?.trim();
  const fallback = path.join(process.cwd(), 'storage', 'chat');
  if (!configured) return fallback;
  const resolved = path.resolve(configured);
  const publicRoot = path.resolve(process.cwd(), 'frontend/public');
  return resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`) ? fallback : resolved;
}
async function cleanupExpiredAttachments(db: any) {
  const stmt = db.prepare(`SELECT id, stored_path FROM chat_attachments WHERE expires_at <= CURRENT_TIMESTAMP`);
  const expired: Array<{ id: string; stored_path: string }> = [];
  while (stmt.step()) expired.push(stmt.getAsObject() as any);
  stmt.free();
  for (const attachment of expired) { try { await fs.unlink(attachment.stored_path); } catch {} db.run('DELETE FROM chat_attachments WHERE id=?', [attachment.id]); }
  if (expired.length) saveDb();
}

router.post('/attachments', async (req: AuthRequest, res) => {
  const phone = userPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authenticated phone is required' });
  const { name, type, data } = req.body || {};
  if (typeof name !== 'string' || typeof type !== 'string' || typeof data !== 'string') return res.status(400).json({ error: 'name, type and data are required' });
  const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','video/mp4','video/webm']);
  if (!allowed.has(type)) return res.status(415).json({ error: 'Unsupported attachment type' });
  const raw = data.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 === 1) return res.status(400).json({ error: 'Attachment data is not valid base64' });
  const buffer = Buffer.from(raw, 'base64');
  const bytes = buffer.byteLength;
  const limit = type.startsWith('video/') ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!bytes || bytes > limit) return res.status(413).json({ error: `Attachment exceeds ${Math.floor(limit / 1024 / 1024)}MB limit` });
  const safeName = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160) || 'attachment';
  // Run attachment through the malware/content security boundary
  // (magic byte validation, forbidden content scan, file type verification)
  const securityResult = inspectAttachmentSecurity({ data: buffer, mimeType: type, filename: safeName });
  if (securityResult.state === 'rejected') {
    return res.status(403).json({ error: `Attachment rejected: ${securityResult.reason}` });
  }
  if (securityResult.state === 'pending_scan') {
    return res.status(202).json({ success: true, pendingScan: true, reason: securityResult.reason });
  }
  const safeExt = path.extname(safeName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 8) || '.bin';
  const dir = privateAttachmentDir();
  await fs.mkdir(dir, { recursive: true });
  const id = crypto.randomUUID();
  const storedPath = path.join(dir, `${id}${safeExt}`);
  const sha256 = securityResult.sha256;
  const db = await getDb();
  await ensurePrivateAttachmentTable(db);
  await cleanupExpiredAttachments(db);
  await fs.writeFile(storedPath, buffer, { flag: 'wx' });
  db.run(`INSERT INTO chat_attachments(id, phone, stored_path, original_name, mime_type, size_bytes, sha256, expires_at) VALUES(?,?,?,?,?,?,?,datetime('now','+30 days'))`, [id, phone, storedPath, safeName, type, bytes, sha256]);
  saveDb();
  res.status(201).json({ success: true, attachment: { id, url: `/api/chat/attachments/${id}`, name: safeName, type, size: bytes, expiresInDays: 30 } });
});

router.get('/attachments/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req);
  const id = String(req.params.id || '');
  if (!phone || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).end();
  const db = await getDb();
  await ensurePrivateAttachmentTable(db);
  await cleanupExpiredAttachments(db);
  const stmt = db.prepare('SELECT stored_path, original_name, mime_type, size_bytes FROM chat_attachments WHERE id=? AND phone=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1');
  stmt.bind([id, phone]);
  const row = stmt.step() ? stmt.getAsObject() as any : null;
  stmt.free();
  if (!row) return res.status(404).end();
  const resolved = path.resolve(String(row.stored_path));
  if (!resolved.startsWith(path.resolve(privateAttachmentDir()) + path.sep)) return res.status(404).end();
  res.type(String(row.mime_type));
  res.setHeader('Content-Disposition', `inline; filename="${String(row.original_name).replace(/["\r\n]/g, '')}"`);
  res.setHeader('Content-Length', String(row.size_bytes));
  res.sendFile(resolved);
});

router.delete('/attachments/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = userPhone(req);
  const id = String(req.params.id || '');
  if (!phone || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).end();
  const db = await getDb();
  await ensurePrivateAttachmentTable(db);
  const stmt = db.prepare('SELECT stored_path FROM chat_attachments WHERE id=? AND phone=? LIMIT 1');
  stmt.bind([id, phone]);
  const row = stmt.step() ? stmt.getAsObject() as any : null;
  stmt.free();
  if (!row) return res.status(404).end();
  try { await fs.unlink(String(row.stored_path)); } catch {}
  db.run('DELETE FROM chat_attachments WHERE id=? AND phone=?', [id, phone]);
  saveDb();
  res.json({ success: true });
});

export default router;
