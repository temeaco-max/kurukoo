import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { appendChatMessage } from './chatConversationService.js';
import { generatePrayer, type PrayerTradition, PRAYER_AGENT_ID } from './prayerAgentService.js';

export function detectPrayerRequest(message: string): boolean {
  const q = String(message || '').trim().toLowerCase();
  if (!q) return false;
  return /\b(?:pray|prayer|praying|pray with me|pray for me|prayer for me|dua|supplication|bless me)\b/.test(q);
}

function guestIdentity(req: Request, res: Response): string {
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map(value => value.trim()).find(value => value.startsWith('kurukoo_guest_id='));
  if (pair) return decodeURIComponent(pair.slice('kurukoo_guest_id='.length));
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

function ownerPhone(req: AuthRequest, res: Response): string {
  return req.user?.phone ? String(req.user.phone) : guestIdentity(req, res);
}

function inferTradition(message: string): PrayerTradition {
  const q = message.toLowerCase();
  if (/\b(?:jesus|christ|lord|church|bible|christian|christianity)\b/.test(q)) return 'christian';
  if (/\b(?:allah|islam|islamic|muslim|dua|quran|qur'an)\b/.test(q)) return 'muslim';
  if (/\b(?:jewish|judaism|torah|adonai)\b/.test(q)) return 'jewish';
  if (/\b(?:spiritual|spiritually|meditation)\b/.test(q)) return 'spiritual';
  return 'general';
}

function extractTopic(message: string): string {
  return message
    .replace(/^\s*(?:can you|could you|please|would you)\s*/i, '')
    .replace(/\b(?:pray(?:er|ing)?|pray with me|pray for me|dua|supplication|bless me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) || 'the concerns and hopes currently on the user’s heart';
}

function sse(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function chunks(text: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length; i += 24) result.push(text.slice(i, i + 24));
  return result;
}

/**
 * Primary Chat Prayer fast-path. It is deliberately narrow: it recognises an
 * explicit prayer request and hands the actual work to the first-class Prayer
 * Agent. Everything else falls through to the canonical Chat router.
 */
export async function prayerChatFastPath(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.method !== 'POST' || req.path !== '/stream') return next();
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!detectPrayerRequest(message)) return next();

  const phone = ownerPhone(req, res);
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 30) : 'web';
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined;
  const tradition = inferTradition(message);

  try {
    const user = await appendChatMessage({ phone, sender: 'user', content: message, channel, conversationId });
    const generated = await generatePrayer({ phone, topic: extractTopic(message), tradition, conversationId });
    const assistant = await appendChatMessage({
      phone,
      sender: 'kurukoo',
      content: generated.prayer,
      channel,
      conversationId: user.conversationId,
      metadata: { firstClassAgent: PRAYER_AGENT_ID, capability: 'skill.prayer', tradition, provider: generated.provider, model: generated.model },
      cardData: {
        type: 'prayer_agent',
        agentId: PRAYER_AGENT_ID,
        capability: 'skill.prayer',
        mode: 'text',
        tradition: generated.tradition,
        actions: [
          { id: 'audio', label: 'Say this as a prayer', canonicalAction: 'skill.prayer.audio' },
          { id: 'live', label: 'Pray with me live', canonicalAction: 'skill.prayer.live' },
          { id: 'routine', label: 'Make this a prayer routine', canonicalAction: 'skill.prayer.routine' },
        ],
      },
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sse(res, { type: 'status', status: 'processing', label: 'Kurukoo is listening for the heart of your request…', grounded: true });
    sse(res, { type: 'conversation', conversationId: user.conversationId, messageId: user.id });
    sse(res, { type: 'progress', stage: 'coordination', label: 'Prayer Companion is preparing your prayer…', grounded: true });
    for (const chunk of chunks(generated.prayer)) sse(res, { type: 'text', content: chunk });
    sse(res, {
      type: 'done',
      fullReply: generated.prayer,
      conversationId: user.conversationId,
      messageId: assistant.id,
      cardData: {
        type: 'prayer_agent',
        agentId: PRAYER_AGENT_ID,
        capability: 'skill.prayer',
        mode: 'text',
        tradition: generated.tradition,
        actions: [
          { id: 'audio', label: 'Say this as a prayer', canonicalAction: 'skill.prayer.audio' },
          { id: 'live', label: 'Pray with me live', canonicalAction: 'skill.prayer.live' },
          { id: 'routine', label: 'Make this a prayer routine', canonicalAction: 'skill.prayer.routine' },
        ],
      },
      diagnostics: { classificationSource: 'rules', intentConfidence: 0.999, canonicalAction: 'skill.prayer.generate', modelProvider: generated.provider, model: generated.model, finalState: 'completed' },
    });
    sse(res, '[DONE]');
    res.end();
  } catch (error) {
    console.error('[Chat] prayer fast-path failed:', error);
    return next(error);
  }
}

export const prayerChatMiddleware = [optionalAuthenticateUser, prayerChatFastPath];
