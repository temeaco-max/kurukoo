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
  return /\b(?:i(?:'m| am)|i also|i can|i do|i provide|i offer|add me|include me|let me|make me|sign me up|i work as|i work in|i'm available for)\b/i.test(message)
    && /\b(?:barber|hair|deliver|delivery|driver|rider|contributor|contribute|plumber|electrician|mechanic|cleaner|cleaning|housekeeping|photograph|coverage)\b/i.test(message);
}

function action(message: string): 'add' | 'available' | 'pause' | null {
  if (/\b(?:pause|stop|turn off|go offline|disable)\b/i.test(message)) return 'pause';
  if (/\b(?:available|go live|turn on|activate)\b/i.test(message)) return 'available';
  if (/\b(?:i(?:'m| am)|i also|i can|i do|i provide|i offer|add me|include me|let me|make me|sign me up|i work as|i work in)\b/i.test(message)) return 'add';
  return null;
}

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
        ? 'I can pause your contributor capability without affecting your other skills.'
        : 'I’ve added contributor capability to your Kurukoo profile. Your submissions remain separate, reviewable contribution records; being a contributor does not change your other provider skills.';
      res.status(200).json({ success: true, conversationCapability: item, reply });
      return;
    }

    const db = await getDb();
    const skillStmt = db.prepare(`SELECT id FROM skills WHERE phone = ? AND skill = ? LIMIT 1`);
    skillStmt.bind([phone, skill]);
    const exists = skillStmt.step();
    skillStmt.free();
    if (!exists) {
      db.run(`INSERT INTO skills (phone, skill, source, confidence, is_available, operation_mode) VALUES (?, ?, 'conversation', 1, 0, 'stationary')`, [phone, skill]);
    }
    saveDb();

    const item = await ensureCapability(phone, skill, 'provider', { source: 'conversation', statement: message.slice(0, 300) });
    if (intent === 'pause') {
      const db2 = await getDb();
      db2.run(`UPDATE skills SET is_available = 0 WHERE phone = ? AND skill = ?`, [phone, skill]);
      saveDb();
      const updated = (await listCapabilityPortfolio(phone)).find(x => x.skill === skill);
      res.status(200).json({ success: true, conversationCapability: updated, reply: `${skill.replace(/_/g, ' ')} is now offline. Your other Kurukoo capabilities are unchanged.` });
      return;
    }
    if (intent === 'available') {
      const db2 = await getDb();
      db2.run(`UPDATE skills SET is_available = 1 WHERE phone = ? AND skill = ?`, [phone, skill]);
      saveDb();
    }

    const updated = (await listCapabilityPortfolio(phone)).find(x => x.skill === skill);
    const reply = intent === 'available'
      ? `${skill.replace(/_/g, ' ')} is marked available on your capability portfolio. Going Live nearby still requires explicit Pulse activation, verification and location consent.`
      : `I’ve added ${skill.replace(/_/g, ' ')} to your Kurukoo capability portfolio. Next I can walk you through the existing onboarding, verification, service-area and availability flow. Your other skills remain on the same identity.`;
    res.status(200).json({ success: true, conversationCapability: updated, reply });
  } catch (error) {
    next(error);
  }
}

export const capabilityPortfolioChatMiddleware = [optionalAuthenticateUser, capabilityPortfolioFastPath];
