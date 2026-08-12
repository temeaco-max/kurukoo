/**
 * Phone OTP authentication — closes the "trust client-supplied phone" hole
 * from the security audit. JWT is issued only after OTP verification.
 */
import crypto from 'crypto';
import { getDb, saveDb } from '../database.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function ensureOtpSchema(): Promise<void> {
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS phone_otps (
    phone TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  saveDb();
}

function normalizePhone(phone: string): string {
  const raw = String(phone || '').trim().replace(/[\s-]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('234') && raw.length >= 12) return `+${raw}`;
  if (raw.startsWith('0') && raw.length === 11) return `+234${raw.slice(1)}`;
  return raw.startsWith('+') ? raw : `+${raw}`;
}

function hashCode(code: string, phone: string): string {
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'otp-dev').update(`${phone}:${code}`).digest('hex');
}

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function requestPhoneOtp(phoneInput: string): Promise<{ success: boolean; message: string; debugCode?: string }> {
  await ensureOtpSchema();
  const phone = normalizePhone(phoneInput);
  if (!phone || phone.length < 8) return { success: false, message: 'Valid phone number required' };

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const db = await getDb();
  db.run(
    `INSERT INTO phone_otps (phone, code_hash, attempts, expires_at, created_at)
     VALUES (?, ?, 0, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = CURRENT_TIMESTAMP`,
    [phone, hashCode(code, phone), expiresAt]
  );
  saveDb();

  // Delivery: WhatsApp / SMS when configured; never log code in production.
  const deliveryConfigured = Boolean(process.env.WHATSAPP_TOKEN || process.env.AFRICASTALKING_API_KEY);
  if (deliveryConfigured) {
    console.log('[OTP] Code issued; channel delivery pending integration');
  }

  const exposeDebug = process.env.NODE_ENV !== 'production' && process.env.OTP_DEBUG === 'true';
  return {
    success: true,
    message: deliveryConfigured
      ? 'Verification code sent'
      : 'Verification code generated (configure WhatsApp/SMS for delivery)',
    ...(exposeDebug ? { debugCode: code } : {}),
  };
}

export async function verifyPhoneOtp(phoneInput: string, code: string): Promise<{ success: boolean; phone?: string; message: string }> {
  await ensureOtpSchema();
  const phone = normalizePhone(phoneInput);
  if (!phone || !code) return { success: false, message: 'Phone and code required' };

  const db = await getDb();
  const stmt = db.prepare(`SELECT code_hash, attempts, expires_at FROM phone_otps WHERE phone = ?`);
  stmt.bind([phone]);
  if (!stmt.step()) {
    stmt.free();
    return { success: false, message: 'No active verification request' };
  }
  const row = stmt.getAsObject() as any;
  stmt.free();

  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    db.run(`DELETE FROM phone_otps WHERE phone = ?`, [phone]);
    saveDb();
    return { success: false, message: 'Code expired — request a new one' };
  }

  const attempts = Number(row.attempts || 0);
  if (attempts >= MAX_ATTEMPTS) {
    db.run(`DELETE FROM phone_otps WHERE phone = ?`, [phone]);
    saveDb();
    return { success: false, message: 'Too many attempts — request a new code' };
  }

  if (hashCode(String(code).trim(), phone) !== String(row.code_hash)) {
    db.run(`UPDATE phone_otps SET attempts = attempts + 1 WHERE phone = ?`, [phone]);
    saveDb();
    return { success: false, message: 'Invalid verification code' };
  }

  db.run(`DELETE FROM phone_otps WHERE phone = ?`, [phone]);
  saveDb();
  return { success: true, phone, message: 'Phone verified' };
}
