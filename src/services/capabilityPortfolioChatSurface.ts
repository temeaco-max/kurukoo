import crypto from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';
import { ensureCapability, listCapabilityPortfolio } from './capabilityPortfolioService.js';

const ALIASES: Array<[RegExp, string]> = [
  [/(?:mobile\s+)?barber(?:ing)?|cut(?:ting)?\s+hair/i, 'mobile_barber'],
  [/deliver(?:y|ies|ing)|delivery\s+(?:driver|boy|runner)|dispatch\s+(?:driver|rider)/i, 'delivery_runner'],
  [/(?:community\s+)?contributor|contribute\s+(?:to|photos?|evidence|reports?)/i, 'contributor'],
  [/plumber|plumbing/i, 'plumber'],
  [/electrician|electrical\s+work/i, 'electrician'],
  [/mechanic|car\s+repair/i, 'mechanic'],
  [/cleaner|cleaning|housekeeping/i, 'house_cleaner'],
  [/photograph(?:y|er)|event\s+coverage/i, 'photographer'],
];

function guestId(req: AuthRequest, res: Response): string {
  if (req.user?.phone) return String(req.user.phone);
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map(v => v.trim()).find(v => v.startsWith('kurukoo_guest_id='));
  if (pair) return decodeURIComponent(pair.slice('kurukoo_guest_id='.length));
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

function extractSkill(message: string): string | null {
  for (const [pattern, skill] of ALIASES) if (pattern.test(message)) return skill;
  return null;
}

function isCapabilityStatement(message: string): boolean {
  const selfClaim = /^(?:i(?:'m| am)\s+(?:a|an)\b|i also\s+(?:do|provide|deliver)\b|i\s+(?:do|provide|offer)\b|add me\s+(?:as|for)\b|include me\s+(?:as|for)\b|sign me up\s+(?:as|for)\b|i work (?:as|in)\b|i(?:'m| am) available (?:for|to)\b)/i;
  const explicitAvailability = /\b(?:make|mark)\s+me\s+(?:available|live)\s+(?:for|as)\b/i;
  const portfolioControl = /\b(?:add|pause|stop|turn off|disable|enable)\s+(?:my|the)\s+(?:barber|delivery|contributor|plumber|electrician|mechanic|cleaning|cleaner|photographer)\b/i;
  return (selfClaim.test(message) || explicitAvailability.test(message) || portfolioControl.test(message)) && /\b(?:barber|hair|deliver|delivery|driver|rider|contributor|contribute|plumber|electrician|mechanic|cleaner|cleaning|housekeeping|photograph|coverage)\b/i.test(message);
}

function action(message: string): 'add' | 'available' | 'pause' | null {
  if (/\b(?:pause|stop|turn off|go offline|disable)\b/i.test(message)) return 'pause';
  if (/\b(?:available|go live|turn on|activate|make me live)\b/i.test(message)) return 'available';
  return 'add';
}

function writeSse(res: Response, payload: unknown) { res.write(`data: ${JSON.stringify(payload)}\n\n`); }
function chunkText(text: string): string[] { const chunks: string[] = []; for (let i = 0; i < text.length; i += 24) chunks.push(text.slice(i, i + 24)); return chunks; }

export async function capabilityPortfolioFastPath(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.method !== 'POST' || req.path !== '/stream') return next();
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || !isCapabilityStatement(message)) return next();
  const phone = guestId(req, res);
  if (phone.startsWith('anon_')) return next();

  const skill = extractSkill(message);
  const intent = action(message);
  if (!skill || !intent) return next();

  try {
    if (skill === 'contributor') {
      const item = await ensureCapability(phone, skill, 'contributor', { source: 'conversation', statement: message.slice(0, 300) });
      const reply = intent === 'pause'
        ? 'I paused your contributor capability without affecting your other skills.'
        : 'I added contributor capability to your Kurukoo profile. Your submissions remain separate, reviewable contribution records; your other provider skills stay on the same identity.';
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      writeSse(res, { type: 'status', status: 'processing', grounded: true });
      for (const chunk of chunkText(reply)) writeSse(res, { type: 'text', content: chunk });
      writeSse(res, { type: 'done', fullReply: reply, cardData: { type: 'capability_portfolio', capability: item, canonicalAction: 'capability_portfolio.update' }, diagnostics: { classificationSource: 'rules', intentConfidence: 0.99, canonicalAction: 'capability_portfolio.update', finalState: 'completed' } });
      writeSse(res, '[DONE]');
      res.end();
      return;
    }

    const db = await getDb();
    const skillStmt = db.prepare(`SELECT id FROM skills WHERE phone = ? AND skill = ? LIMIT 1`);
    skillStmt.bind([phone, skill]);
    const exists = skillStmt.step();
    skillStmt.free();
    if (!exists) db.run(`INSERT INTO skills (phone, skill, source, confidence, is_available, operation_mode) VALUES (?, ?, 'conversation', 1, 0, 'stationary')`, [phone, skill]);
    saveDb();

    await ensureCapability(phone, skill, 'provider', { source: 'conversation', statement: message.slice(0, 300) });
    if (intent === 'pause') {
      db.run(`UPDATE skills SET is_available = 0 WHERE phone = ? AND skill = ?`, [phone, skill]);
      saveDb();
    } else if (intent === 'available') {
      db.run(`UPDATE skills SET is_available = 1 WHERE phone = ? AND skill = ?`, [phone, skill]);
      saveDb();
    }

    const updated = (await listCapabilityPortfolio(phone)).find(x => x.skill === skill);
    const reply = intent === 'pause'
      ? `${skill.replace(/_/g, ' ')} is now offline. Your other Kurukoo capabilities are unchanged.`
      : intent === 'available'
        ? `${skill.replace(/_/g, ' ')} is marked available on your capability portfolio. Going Live nearby still requires explicit Pulse activation, verification and location consent.`
        : `I added ${skill.replace(/_/g, ' ')} to your Kurukoo capability portfolio. Next I can walk you through the existing onboarding, verification, service-area and availability flow. Your other skills remain on the same identity.`;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    writeSse(res, { type: 'status', status: 'processing', grounded: true });
    for (const chunk of chunkText(reply)) writeSse(res, { type: 'text', content: chunk });
    writeSse(res, { type: 'done', fullReply: reply, cardData: { type: 'capability_portfolio', capability: updated, canonicalAction: 'capability_portfolio.update' }, diagnostics: { classificationSource: 'rules', intentConfidence: 0.99, canonicalAction: 'capability_portfolio.update', finalState: 'completed' } });
    writeSse(res, '[DONE]');
    res.end();
  } catch (error) {
    next(error);
  }
}

export const capabilityPortfolioChatMiddleware = [optionalAuthenticateUser, capabilityPortfolioFastPath];
