/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Development Mailpit transport test — proves the local email transport sends
 * the REAL magic-link email through the existing canonical sendEmail() path.
 * Flow: requestMagicLink() → sendEmail() → SMTP → local Mailpit → captured
 * message → magic link → canonical challenge/session (no alternate auth).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const SMTP_PORT = 11025;
const UI_PORT = 18025;
const SMTP_HOST = '127.0.0.1';
const dbPath = path.join(root, 'tmp-mailpit-auth.sqlite');

// Locate the Mailpit binary (local dev tool, not shipped with the repo).
const candidates = [
  process.env.MAILPIT_BIN,
  path.join(os.homedir(), 'bin', 'mailpit'),
  '/opt/homebrew/bin/mailpit',
  '/usr/local/bin/mailpit',
].filter(Boolean) as string[];
const mailpitBin = candidates.find((c) => fs.existsSync(c) || c === 'mailpit');
if (!mailpitBin) {
  console.log('SKIP: Mailpit binary not found (install with `brew install mailpit` or set MAILPIT_BIN).');
  process.exit(0);
}

// Isolated temporary database seeded with the existing canonical user.
process.env.DB_PATH = dbPath;
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
const { getDb, saveDb } = await import('../src/database.js');
const existingPhone = '+2348011111111';
{
  const db = await getDb();
  const check = db.prepare('SELECT phone FROM memory_profiles WHERE phone = ?');
  check.bind([existingPhone]);
  const exists = check.step();
  check.free();
  if (!exists) {
    await db.run(`INSERT INTO memory_profiles (phone, name, email, country, is_available) VALUES (?, ?, ?, 'ng', 1)`, [existingPhone, 'Temea Co', 'temea.co@gmail.com']);
    saveDb(true);
  }
}

// Local development transport selection + Mailpit runtime.
process.env.KURUKOO_EMAIL_TRANSPORT = 'mailpit';
process.env.KURUKOO_MAILPIT_HOST = SMTP_HOST;
process.env.KURUKOO_MAILPIT_SMTP_PORT = String(SMTP_PORT);
process.env.NODE_ENV = 'development';
if (!String(process.env.EMAIL_FROM || '').trim()) process.env.EMAIL_FROM = 'Kurukoo Dev <no-reply@kurukoo.local>';

const mailpit: ChildProcess = spawn(mailpitBin, ['-s', `${SMTP_HOST}:${SMTP_PORT}`, '-l', `${SMTP_HOST}:${UI_PORT}`], { stdio: 'ignore' });
const stopMailpit = () => { try { mailpit.kill('SIGTERM'); } catch { /* gone */ } };
process.on('exit', stopMailpit);

async function waitForMailpit(attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`http://${SMTP_HOST}:${UI_PORT}/api/v1/messages`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('[mailpit] Mailpit did not become ready');
}
await waitForMailpit();
console.log(`[mailpit] Mailpit ready — SMTP ${SMTP_HOST}:${SMTP_PORT}, web UI http://${SMTP_HOST}:${UI_PORT}`);

// ── 1. The canonical magic-link flow sends through sendEmail() → Mailpit ──
const challengeService = await import('../src/services/authChallengeService.js');
const result = await challengeService.requestMagicLink({ email: 'temea.co@gmail.com', name: 'Temea', returnPath: '/perch' });
assert.equal(result.success, true, `magic link request failed: ${result.message}`);
assert.equal(result.delivery, 'email', 'email must be really delivered through the transport');
assert.equal(result.provider, 'mailpit', 'delivery must go through the Mailpit SMTP transport');
assert.ok(result.providerReference, 'Mailpit/nodemailer must return a message id');
console.log(`[mailpit] sendEmail() delivered via Mailpit (message id ${result.providerReference}).`);

// ── 2. The captured email contains the real local magic link ──
const listRes = await fetch(`http://${SMTP_HOST}:${UI_PORT}/api/v1/search?query=to:temea.co@gmail.com`);
const list = await listRes.json() as { messages: Array<{ ID: string; To: Array<{ Address: string }>; Subject: string }> };
const message = list.messages.find((m) => m.Subject === 'Continue with Kurukoo' && m.To.some((t) => t.Address === 'temea.co@gmail.com'));
assert.ok(message, 'the magic-link email must be captured by Mailpit');
const detailRes = await fetch(`http://${SMTP_HOST}:${UI_PORT}/api/v1/message/${message.ID}`);
const detail = await detailRes.json() as { Text: string; HTML: string };
const haystack = `${detail.Text || ''}\n${detail.HTML || ''}`;
const linkMatch = haystack.match(/https?:\/\/[^\s"'<>]+\/auth\/challenge\/complete\?token=[^\s"'<>]+/);
assert.ok(linkMatch, 'captured email must contain the magic link');
const magicLink = linkMatch[0].replace(/&amp;/g, '&');
assert.ok(magicLink.includes('return=%2Fperch') || magicLink.includes('return=/perch'), 'magic link must target /perch');
console.log(`[mailpit] Captured magic link from the real email: ${magicLink.replace(/token=[^&]+/, 'token=<redacted>')}`);

// ── 3. Completing the captured link issues the canonical session ──
const token = magicLink.match(/token=([^&<>\s"]+)/)?.[1];
assert.ok(token, 'token must be present in the captured link');
const consumed = await challengeService.consumeAuthChallengeToken(token);
assert.equal(consumed.success, true, 'the captured magic link must complete the canonical challenge');
assert.equal(consumed.challenge.phone, existingPhone, 'session must bind to the existing canonical phone identity');
assert.ok(!consumed.challenge.phone.startsWith('em_'), 'existing email must never resolve to em_*');
console.log(`[mailpit] Captured link completed the canonical challenge for ${consumed.challenge.phone} (returnPath /perch).`);

// ── 4. Mailpit is refused in production (truthful failure, no fake send) ──
const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
try {
  const emailService = await import('../src/services/emailService.js');
  const refused = await emailService.sendEmail('someone@example.com', 'Production guard', 'Must not send.');
  assert.equal(refused.ok, false, 'Mailpit must not be used in production');
  assert.equal(refused.provider, 'mailpit');
  assert.match(String(refused.error), /not permitted in production/i);
  console.log('[mailpit] Production guard verified: Mailpit is refused outside development.');
} finally {
  process.env.NODE_ENV = previousNodeEnv;
}

// ── 5. Default transport selection still targets Resend (unchanged path) ──
delete process.env.KURUKOO_EMAIL_TRANSPORT;
try {
  const emailService = await import('../src/services/emailService.js');
  const resendProbe = await emailService.sendEmail('temea.co@gmail.com', 'Kurukoo transport probe', 'Resend path selection probe.');
  assert.equal(resendProbe.provider, 'resend', 'without KURUKOO_EMAIL_TRANSPORT the Resend path must be selected');
  console.log(`[mailpit] Resend path unchanged (provider 'resend'; ok=${resendProbe.ok} in this environment: ${resendProbe.error ?? 'sent'}).`);
} finally {
  process.env.KURUKOO_EMAIL_TRANSPORT = 'mailpit';
}

stopMailpit();
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);

console.log('\n=== MAILPIT TRANSPORT TEST PASSED ===');
console.log('Local: canonical sendEmail() → Mailpit SMTP → real magic link → canonical challenge/session.');
console.log('Production: Mailpit refused; Resend path unchanged.');

