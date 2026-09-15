/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Magic-link / challenge authentication — additive to OTP.
 *
 * Design constraints (Kurukoo OS):
 * - Phone remains the primary communications identity once proven.
 * - Email magic link proves an email credential; provisional em_* subjects
 *   are explicitly provisional until channel proof or a real phone is bound.
 * - Tokens are single-use, hashed at rest, purpose-bound, short TTL.
 * - returnPath is allowlisted to internal paths only.
 * - OTP tables and otpAuthService are never modified by this module.
 */
import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { sendEmail } from './emailService.js';
import { sendFcmPush } from './pushNotifications.js';

export type AuthChallengePurpose = 'login' | 'attach_email' | 'push_reauth' | 'email_account_provisional';
export type AuthChallengeChannel = 'email' | 'push' | 'web_link';

export interface AuthChallengeRecord {
  id: string;
  phone: string;
  email?: string;
  purpose: AuthChallengePurpose;
  channel: AuthChallengeChannel;
  guestPhone?: string;
  name?: string;
  returnPath?: string;
  expiresAt: string;
  consumedAt?: string;
  attempts: number;
  createdAt: string;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function jwtSecret(): string {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('[Kurukoo Security] JWT_SECRET must be configured before auth challenges.');
  }
  return secret || 'development-only-auth-challenge-secret';
}

function hashToken(token: string): string {
  return crypto.createHmac('sha256', jwtSecret()).update(`auth-challenge:${token}`).digest('hex');
}

export function normalizeChallengeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidChallengeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeChallengeEmail(email));
}

/** Provisional subject for email-first continuity. Never treat as channel-proven phone. */
export function provisionalPhoneFromEmail(email: string): string {
  const normalized = normalizeChallengeEmail(email);
  const digest = crypto.createHash('sha256').update(`kurukoo-provisional-email:${normalized}`).digest('hex').slice(0, 24);
  return `em_${digest}`;
}

export function isProvisionalEmailSubject(phone: string): boolean {
  return String(phone || '').startsWith('em_');
}

export function isGuestSubject(phone: string): boolean {
  return String(phone || '').startsWith('anon_') || String(phone || '').startsWith('guest_');
}

export function isMagicLinkAuthEnabled(): boolean {
  return String(process.env.KURUKOO_MAGIC_LINK_AUTH || 'true').toLowerCase() !== 'false';
}

export function isAuthChallengeDebugEnabled(): boolean {
  return String(process.env.KURUKOO_AUTH_CHALLENGE_DEBUG || '').toLowerCase() === 'true';
}

function publicAppBaseUrl(): string {
  return String(process.env.KURUKOO_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

const ALLOWED_RETURN_PREFIXES = ['/chat', '/connect', '/login', '/settings', '/profile', '/wallet', '/orders', '/provider', '/workspace', '/perch', '/notifications', '/'];

export function sanitizeReturnPath(raw?: string | null): string | undefined {
  const p = String(raw || '').trim();
  if (!p) return undefined;
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('://') || p.includes('\\')) return undefined;
  if (ALLOWED_RETURN_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix + '?'))) {
    return p;
  }
  return '/chat';
}

async function ensureAuthChallengeTable(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS auth_challenges (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    email TEXT,
    purpose TEXT NOT NULL,
    channel TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    guest_phone TEXT,
    name TEXT,
    return_path TEXT,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_auth_challenges_phone ON auth_challenges(phone, purpose, expires_at)`);
  saveDb();
}

function rowToChallenge(row: any): AuthChallengeRecord {
  return {
    id: String(row.id),
    phone: String(row.phone),
    email: row.email ? String(row.email) : undefined,
    purpose: String(row.purpose) as AuthChallengePurpose,
    channel: String(row.channel) as AuthChallengeChannel,
    guestPhone: row.guest_phone ? String(row.guest_phone) : undefined,
    name: row.name ? String(row.name) : undefined,
    returnPath: row.return_path ? String(row.return_path) : undefined,
    expiresAt: String(row.expires_at),
    consumedAt: row.consumed_at ? String(row.consumed_at) : undefined,
    attempts: Number(row.attempts || 0),
    createdAt: String(row.created_at || ''),
  };
}

export async function createAuthChallenge(input: {
  phone: string;
  email?: string;
  purpose: AuthChallengePurpose;
  channel: AuthChallengeChannel;
  guestPhone?: string;
  name?: string;
  returnPath?: string;
}): Promise<{ challenge: AuthChallengeRecord; token: string; completePath: string }> {
  await ensureAuthChallengeTable();
  const token = crypto.randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const returnPath = sanitizeReturnPath(input.returnPath);
  const db = await getDb();
  db.run(
    `INSERT INTO auth_challenges (id, phone, email, purpose, channel, token_hash, guest_phone, name, return_path, expires_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.phone,
      input.email || null,
      input.purpose,
      input.channel,
      hashToken(token),
      input.guestPhone || null,
      input.name || null,
      returnPath || null,
      expiresAt,
    ],
  );
  saveDb();
  const completePath = `/auth/challenge/complete?token=${encodeURIComponent(token)}${returnPath ? `&return=${encodeURIComponent(returnPath)}` : ''}`;
  return {
    challenge: {
      id,
      phone: input.phone,
      email: input.email,
      purpose: input.purpose,
      channel: input.channel,
      guestPhone: input.guestPhone,
      name: input.name,
      returnPath,
      expiresAt,
      attempts: 0,
      createdAt: new Date().toISOString(),
    },
    token,
    completePath,
  };
}

export async function consumeAuthChallengeToken(token: string): Promise<
  | { success: true; challenge: AuthChallengeRecord }
  | { success: false; message: string }
> {
  await ensureAuthChallengeTable();
  const hashed = hashToken(token);
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM auth_challenges WHERE token_hash = ? LIMIT 1`);
  stmt.bind([hashed]);
  if (!stmt.step()) {
    stmt.free();
    return { success: false, message: 'Invalid or expired sign-in link' };
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  const challenge = rowToChallenge(row);
  if (challenge.consumedAt) {
    return { success: false, message: 'This sign-in link was already used' };
  }
  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    return { success: false, message: 'This sign-in link has expired' };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { success: false, message: 'Too many attempts for this sign-in link' };
  }
  db.run(`UPDATE auth_challenges SET consumed_at = ?, attempts = attempts + 1 WHERE id = ?`, [
    new Date().toISOString(),
    challenge.id,
  ]);
  saveDb();
  return { success: true, challenge: { ...challenge, consumedAt: new Date().toISOString() } };
}

export async function requestMagicLink(input: {
  email: string;
  name?: string;
  guestPhone?: string;
  returnPath?: string;
  purpose?: AuthChallengePurpose;
}): Promise<{ success: boolean; message: string; challengeId?: string; debugUrl?: string; delivery: 'email' | 'none'; provider?: string; providerReference?: string }> {
  if (!isMagicLinkAuthEnabled()) {
    return { success: false, message: 'Magic link auth is disabled', delivery: 'none' };
  }
  const email = normalizeChallengeEmail(input.email);
  if (!isValidChallengeEmail(email)) {
    return { success: false, message: 'Enter a valid email address', delivery: 'none' };
  }

  // Look up existing memory_profiles by email (case-insensitive)
  const db = await getDb();
  const stmt = db.prepare("SELECT phone, name, email FROM memory_profiles WHERE LOWER(email) = LOWER(?) LIMIT 1");
  stmt.bind([email]);
  let existingProfile = null;
  if (stmt.step()) {
    existingProfile = stmt.getAsObject();
  }
  stmt.free();

  let phone: string;
  let purpose = input.purpose || 'email_account_provisional';

  if (existingProfile && typeof existingProfile.phone === 'string') {
    // Email exists — bind challenge to existing user's phone identity
    phone = String(existingProfile.phone).trim();
    purpose = 'attach_email';
    // Preserve existing name if no new name provided
    input.name = input.name || (typeof existingProfile.name === 'string' ? existingProfile.name : undefined);
  } else {
    // Email is genuinely new — create provisional em_* identity
    phone = provisionalPhoneFromEmail(email);
    purpose = input.purpose || 'email_account_provisional';
  }

  const { challenge, token, completePath } = await createAuthChallenge({
    phone,
    email,
    purpose,
    channel: 'email',
    guestPhone: input.guestPhone,
    name: input.name,
    returnPath: input.returnPath,
  });
  const base = publicAppBaseUrl();
  const link = base ? `${base}${completePath}` : completePath;
  const subject = 'Continue with Kurukoo';
  const body = `Hi${input.name ? ` ${input.name}` : ''},\n\nUse this one-time link to continue (expires in 10 minutes):\n\n${link}\n\nIf you did not request this, ignore this email.\n\n— Kurukoo`;
  const sent = await sendEmail(email, subject, body).catch(() => false);
  const debugUrl = isAuthChallengeDebugEnabled() && process.env.NODE_ENV !== 'production' ? link : undefined;
  if (!sent && !debugUrl) {
    return {
      success: false,
      message: 'Could not send the email. Check RESEND_API_KEY / EMAIL_FROM or enable debug for local testing.',
      delivery: 'none',
      challengeId: challenge.id,
    };
  }
  return {
    success: true,
    message: typeof sent === 'object' && sent.ok ? 'Magic link sent to your email' : 'Magic link ready (debug mode — email not sent)',
    challengeId: challenge.id,
    debugUrl,
    delivery: typeof sent === 'object' && sent.ok ? 'email' : 'none',
    provider: typeof sent === 'object' && sent.ok ? sent.provider : undefined,
    providerReference: typeof sent === 'object' && sent.ok ? (sent.id || sent.messageId) : undefined,
  };
}

export async function requestPushLoginApproval(input: {
  phone: string;
  name?: string;
  guestPhone?: string;
  returnPath?: string;
}): Promise<{ success: boolean; message: string; challengeId?: string; delivery: 'push' | 'none' }> {
  const phone = String(input.phone || '').trim();
  if (!phone || isGuestSubject(phone) || isProvisionalEmailSubject(phone)) {
    return {
      success: false,
      message: 'Push approval requires an existing non-provisional Kurukoo phone identity with a registered device.',
      delivery: 'none',
    };
  }
  const { challenge, completePath } = await createAuthChallenge({
    phone,
    purpose: 'push_reauth',
    channel: 'push',
    guestPhone: input.guestPhone,
    name: input.name,
    returnPath: input.returnPath,
  });
  const base = publicAppBaseUrl();
  const link = base ? `${base}${completePath}` : completePath;
  const sent = await sendFcmPush(
    phone,
    'Approve Kurukoo sign-in',
    'Tap to approve this sign-in on a device already linked to your Kurukoo account.',
    link,
    {
      contextId: `auth_challenge:${challenge.id}`,
      availableAction: 'approve',
      canonicalAction: 'auth.challenge.approve',
      objectType: 'auth_challenge',
      objectId: challenge.id,
      ownerScope: phone,
      idempotencyKey: `auth-challenge-push:${challenge.id}`,
      surface: 'auth',
    },
  ).catch(() => false);
  if (!sent) {
    return {
      success: false,
      message: 'No push endpoint is available for this account. Register a device or use email magic link.',
      delivery: 'none',
      challengeId: challenge.id,
    };
  }
  return {
    success: true,
    message: 'Approval request sent to your registered Kurukoo devices',
    challengeId: challenge.id,
    delivery: 'push',
  };
}

export function progressiveAuthReadiness(): {
  magicLinkEnabled: boolean;
  challengeDebug: boolean;
  publicBaseUrlConfigured: boolean;
  ssoGoogleConfigured: boolean;
  ssoAppleConfigured: boolean;
  note: string;
} {
  return {
    magicLinkEnabled: isMagicLinkAuthEnabled(),
    challengeDebug: isAuthChallengeDebugEnabled(),
    publicBaseUrlConfigured: Boolean(publicAppBaseUrl()),
    ssoGoogleConfigured: Boolean(String(process.env.KURUKOO_GOOGLE_CLIENT_ID || '').trim()),
    ssoAppleConfigured: Boolean(String(process.env.KURUKOO_APPLE_CLIENT_ID || '').trim()),
    note: 'SSO client IDs are readiness signals only; they do not activate provider SSO until a verified OAuth adapter is wired.',
  };
}
