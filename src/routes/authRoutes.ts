/** OTP-first authentication with one phone-based Kurukoo identity. */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getDb, saveDb } from '../database.js';
import { migrateGuestSessionToAccount } from '../services/guestSessionMigration.js';
import { applyQrReferralAttribution } from '../services/qrContextService.js';
import { requestPhoneOtp, verifyPhoneOtp } from '../services/otpAuthService.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';

const router = Router();
const AUTH_COOKIE = 'kurukoo_auth';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
  return secret;
}

export function issueUserToken(phone: string): string {
  return jwt.sign({ phone, role: 'user' }, getJwtSecret(), { expiresIn: '30d', algorithm: 'HS256' });
}

function setAuthCookie(res: any, token: string, clearGuest = false): void {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' };
  res.cookie(AUTH_COOKIE, token, options);
  if (clearGuest) res.clearCookie('kurukoo_guest_id', { httpOnly: true, secure: options.secure, sameSite: 'lax', path: '/' });
}

export async function upsertProfile(phone: string, name?: string, email?: string, goal?: string): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare('SELECT phone FROM memory_profiles WHERE phone = ?');
  stmt.bind([phone]);
  const exists = stmt.step();
  stmt.free();
  if (exists) {
    db.run("UPDATE memory_profiles SET name=COALESCE(NULLIF(?, ''),name), email=COALESCE(NULLIF(?, ''),email) WHERE phone=?", [name || '', email || '', phone]);
  } else {
    db.run(`INSERT INTO memory_profiles (phone,name,location,country,subscription_tier,wallet_balance_minor,preferences,behavior_patterns,email,is_available) VALUES (?,?,'Ibadan','ng','Base',30,?,'{}',?,1)`, [phone, name || 'Kurukoo User', JSON.stringify({ goal: goal || 'buyer' }), email || '']);
  }
  saveDb();
}

router.post('/request-otp', authRateLimit, async (req, res) => {
  try {
    const result = await requestPhoneOtp(String(req.body?.phone || '').trim());
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('request-otp error:', e);
    res.status(500).json({ success: false, message: 'Failed to issue verification code' });
  }
});

router.post('/verify-otp', authRateLimit, async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    const guestPhone = String(req.body?.guestPhone || '').trim();
    const result = await verifyPhoneOtp(phone, code);
    if (!result.success || !result.phone) return res.status(401).json(result);

    const userPhone = result.phone;
    await upsertProfile(userPhone, req.body?.name, req.body?.email, req.body?.goal);

    if (guestPhone.startsWith('anon_')) {
      try {
        await migrateGuestSessionToAccount(guestPhone, userPhone);
        // Attribution records a qualified referral only after identity is verified;
        // it does not award Points and never runs during QR scan/activation.
        await applyQrReferralAttribution(guestPhone, userPhone);
      } catch (migrationError) { console.error('Guest migration or QR attribution failed during verify-otp:', migrationError); }
    }

    const token = issueUserToken(userPhone);
    setAuthCookie(res, token, guestPhone.startsWith('anon_'));
    res.json({ success: true, phone: userPhone, token, message: 'Authenticated' });
  } catch (e: any) {
    console.error('verify-otp error:', e);
    res.status(500).json({ success: false, message: e.message || 'Verification failed' });
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { phone, name, email, goal } = req.body || {};
    if (!phone && !email) return res.status(400).json({ success: false, error: 'Phone number or email required' });
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as any;
        if (decoded?.phone) {
          await upsertProfile(decoded.phone, name, email, goal);
          setAuthCookie(res, token);
          return res.json({ success: true, phone: decoded.phone, name: name || 'Kurukoo User', token });
        }
      } catch { /* continue */ }
    }
    if (process.env.OTP_LEGACY_LOGIN === 'true') {
      const userPhone = String(phone);
      await upsertProfile(userPhone, name, email, goal);
      const token = issueUserToken(userPhone);
      setAuthCookie(res, token);
      return res.json({ success: true, phone: userPhone, name: name || 'Kurukoo User', token, warning: 'Legacy login enabled — disable OTP_LEGACY_LOGIN in production' });
    }
    return res.status(401).json({ success: false, error: 'Phone login requires OTP.', require_otp: true });
  } catch (e: any) {
    console.error('Auth login error:', e);
    res.status(500).json({ success: false, error: e.message || 'Login failed' });
  }
});

router.post('/logout', (_req, res) => {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  res.clearCookie(AUTH_COOKIE, options);
  res.clearCookie('kurukoo_guest_id', options);
  res.cookie(AUTH_COOKIE, '', { ...options, maxAge: 0 });
  res.cookie('kurukoo_guest_id', '', { ...options, maxAge: 0 });
  res.json({ success: true });
});

router.get('/me', authenticateUser, async (req: AuthRequest, res) => { res.json({ success: true, user: req.user }); });

export default router;
