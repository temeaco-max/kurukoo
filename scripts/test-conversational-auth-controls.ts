import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.join(os.tmpdir(), `kurukoo-conversational-auth-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'development';
process.env.OTP_DEBUG = 'true';
process.env.JWT_SECRET = 'conversation-auth-controls-test-secret-0123456789abcdef';

const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { getAuthState, handleConversationalAuth, setAuthState } = await import('../src/services/conversationalAuthService.js');

try {
  const guestPhone = `guest-auth-controls-${Date.now()}`;
  const phone = `+234803${String(Date.now()).slice(-7)}`;
  await upsertProfile(guestPhone, 'Guest');
  await setAuthState(guestPhone, 'awaiting_otp', { name: 'Aisha', phone });

  const resend = await handleConversationalAuth(guestPhone, 'resend code');
  assert.equal(resend.cardData?.type, 'auth_otp_input', 'Resending must retain the canonical in-chat OTP card.');
  assert.match(resend.reply, /sent another 6-digit verification code/i, 'Resending must describe the actual in-chat verification state.');
  assert.equal((await getAuthState(guestPhone)).state, 'awaiting_otp', 'Resending must not bypass OTP verification.');

  const changeNumber = await handleConversationalAuth(guestPhone, 'change number');
  assert.match(changeNumber.reply, /best phone number/i, 'Changing number must return to the canonical phone capture step.');
  assert.equal((await getAuthState(guestPhone)).state, 'awaiting_phone', 'Changing number must clear the OTP step without authenticating the guest.');

  console.log('Conversational auth controls regression passed: resend retains OTP verification and change-number returns to phone capture.');
} finally {
  try { fs.rmSync(dbPath, { force: true }); } catch {}
}
