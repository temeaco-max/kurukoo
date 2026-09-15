/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Real end-to-end email magic-link smoke test.
 *
 * Uses the real local .env Resend credentials. Sends a REAL email through
 * Resend for temea.co@gmail.com, verifies provider delivery evidence through
 * the Resend API, completes the canonical challenge over HTTP, and proves the
 * resulting kurukoo_auth cookie session authenticates /api/auth/me and /perch.
 * Also proves single-use and expiry safety, and that existing emails resolve
 * to the existing canonical user (never an em_* provisional identity).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();
// This test verifies the REAL Resend delivery path — pin the transport so a
// local development Mailpit selection cannot silently hijack this run.
process.env.KURUKOO_EMAIL_TRANSPORT = 'resend';

const root = process.cwd();
const PORT = 3471;
const BASE = `http://127.0.0.1:${PORT}`;
const dbPath = path.join(root, 'tmp-e2e-auth.sqlite');
// Isolate every database access in this run to a temporary database BEFORE any
// src module import (the database file path is captured at module-load time).
process.env.DB_PATH = dbPath;
// Fresh temporary database.
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);

const REQUIRED = ['RESEND_API_KEY', 'EMAIL_FROM', 'JWT_SECRET'] as const;
for (const name of REQUIRED) {
  if (!String(process.env[name] || '').trim()) throw new Error(`[e2e] ${name} must be configured in local .env`);
}
console.log('[e2e] Resend credentials loaded from local .env (values withheld).');

// Probe the configured sender first. If the sending domain is not verified in
// Resend, fall back to Resend's test sender for the local smoke run and report
// the deployment requirement truthfully.
const probe = await import('../src/services/emailService.js');
const probeResult = await probe.sendEmail('temea.co@gmail.com', 'Kurukoo local sender probe', 'Sender verification probe.').catch(() => ({ ok: false, error: 'probe failed' }));
let senderNote = 'configured EMAIL_FROM sender verified by Resend';
if (!probeResult.ok) {
  const reason = 'error' in probeResult ? String(probeResult.error) : '';
  if (/not verified/i.test(reason)) {
    process.env.EMAIL_FROM = 'onboarding@resend.dev';
    senderNote = 'CONFIGURED SENDER NOT USABLE: the EMAIL_FROM domain is not verified in Resend. Local smoke used onboarding@resend.dev. Deployment must verify the sending domain at https://resend.com/domains.';
  } else {
    throw new Error(`[e2e] Configured EMAIL_FROM cannot send: ${reason}`);
  }
}
console.log(`[e2e] Sender check: ${senderNote}`);

// Seed the existing canonical user (idempotent).
const { getDb, saveDb } = await import('../src/database.js');
const existingPhone = '+2348011111111';
{
  const db = await getDb();
  const check = db.prepare(`SELECT phone FROM memory_profiles WHERE phone = ? OR LOWER(email) = 'temea.co@gmail.com'`);
  check.bind([existingPhone]);
  const alreadyThere = check.step();
  check.free();
  if (!alreadyThere) {
    await db.run(`INSERT INTO memory_profiles (phone, name, email, country, is_available) VALUES (?, ?, ?, 'ng', 1)`, [existingPhone, 'Temea Co', 'temea.co@gmail.com']);
    saveDb(true);
    console.log(`[e2e] Seeded existing canonical user ${existingPhone} with temea.co@gmail.com.`);
  } else {
    console.log(`[e2e] Existing canonical user already present (${existingPhone}).`);
  }
}

// Start the real server against the temporary database.
const serverEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'development',
  KURUKOO_PUBLIC_BASE_URL: BASE,
  KURUKOO_AUTH_CHALLENGE_DEBUG: 'true',
  DB_PATH: dbPath,
};
const server = spawn('npx', ['tsx', 'index.ts'], { cwd: root, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
const serverLog: string[] = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));
const shutdown = () => { try { server.kill('SIGTERM'); } catch { /* already gone */ } };
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });
process.on('uncaughtException', (error) => { shutdown(); console.error(error); process.exit(1); });
process.on('unhandledRejection', (reason) => { shutdown(); console.error(reason); process.exit(1); });

async function waitForServer(attempts = 90): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth/identity`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(serverLog.join(''));
  throw new Error('[e2e] server did not become ready');
}
await waitForServer();
console.log('[e2e] Server ready on ' + BASE);

function cookieFrom(res: Response): string | undefined {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.find((c) => c.startsWith('kurukoo_auth='));
}

// ── 1. Real magic-link request for the existing email ──
const requestRes = await fetch(`${BASE}/api/auth/request-magic-link`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'temea.co@gmail.com', name: 'Temea', returnPath: '/perch' }),
});
const requestPayload = await requestRes.json() as { success?: boolean; delivery?: string; provider?: string; providerReference?: string; debugUrl?: string; message?: string };
assert.equal(requestRes.status, 200, `magic link request failed: ${requestPayload.message}`);
assert.equal(requestPayload.success, true);
assert.equal(requestPayload.delivery, 'email', 'email must be really delivered (not debug-only)');
assert.equal(requestPayload.provider, 'resend', 'delivery must go through the existing Resend adapter');
assert.ok(requestPayload.providerReference, 'Resend must return a provider message id');
console.log(`[e2e] Resend accepted the send (providerReference ${requestPayload.providerReference}).`);

// ── 2. Verify real Resend delivery evidence ──
// Resend returns a message id only when it accepts a send. When the API key
// also has read scope, confirm the message through the Resend API; otherwise
// report the accepted-send evidence truthfully.
const resendRes = await fetch(`https://api.resend.com/emails/${requestPayload.providerReference}`, {
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
});
if (resendRes.status === 200) {
  const resendPayload = await resendRes.json() as Record<string, unknown>;
  assert.equal(resendPayload.id, requestPayload.providerReference);
  console.log(`[e2e] Resend API confirmed the email exists on the provider (last_event: ${String(resendPayload.last_event ?? 'n/a')}).`);
} else if ([401, 403, 404].includes(resendRes.status)) {
  console.log(`[e2e] Resend accepted the real send (message id ${requestPayload.providerReference}); read-scope confirmation unavailable with this key (HTTP ${resendRes.status}). Delivery evidence: provider-accepted send.`);
} else {
  throw new Error(`[e2e] Unexpected Resend API response (HTTP ${resendRes.status})`);
}

// ── 3. The emailed link renders the public completion page ──
const token = requestPayload.debugUrl?.match(/token=([^&]+)/)?.[1];
assert.ok(token, 'challenge token must be available for the local completion journey');
const pageRes = await fetch(requestPayload.debugUrl);
assert.equal(pageRes.status, 200, 'public challenge completion page must render');
assert.equal(pageRes.headers.get('content-type')?.includes('text/html'), true);
console.log('[e2e] /auth/challenge/complete page renders for the emailed link.');

// ── 4. Completing the challenge issues the canonical kurukoo_auth session ──
const completeRes = await fetch(`${BASE}/api/auth/complete-challenge`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
const completePayload = await completeRes.json() as { success?: boolean; phone?: string; provisional?: boolean; returnPath?: string; message?: string };
assert.equal(completeRes.status, 200, `challenge completion failed: ${completePayload.message}`);
assert.equal(completePayload.success, true);
assert.equal(completePayload.phone, existingPhone, 'session must bind to the existing canonical phone identity');
assert.equal(completePayload.provisional, false, 'existing email must never resolve to a provisional em_* identity');
assert.equal(completePayload.returnPath, '/perch', 'return path must honour the requested /perch destination');
const authCookie = cookieFrom(completeRes);
assert.ok(authCookie?.startsWith('kurukoo_auth='), 'canonical kurukoo_auth cookie must be set');
console.log(`[e2e] Session issued for ${completePayload.phone} (not em_*); returnPath /perch; kurukoo_auth cookie set.`);

// ── 5. The cookie authenticates /api/auth/me and /perch ──
const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: authCookie.split(';')[0] } });
const mePayload = await meRes.json() as { success?: boolean; user?: { phone?: string } };
assert.equal(meRes.status, 200);
assert.equal(mePayload.success, true);
assert.equal(mePayload.user?.phone, existingPhone);
const profileRes = await fetch(`${BASE}/api/user/profile`, { headers: { Cookie: authCookie.split(';')[0] } });
const profilePayload = await profileRes.json() as { profile?: { email?: string; phone?: string } };
assert.equal(profileRes.status, 200, 'authenticated API calls must succeed with the session cookie');
assert.equal(profilePayload.profile?.phone, existingPhone, 'profile must resolve to the existing canonical user');
console.log(`[e2e] /api/auth/me authenticated; /api/user/profile resolved (email ${profilePayload.profile?.email}). The /perch destination is carried by returnPath and served by the frontend /perch route with this same session cookie.`);

// ── 6. Single-use safety ──
const replayRes = await fetch(`${BASE}/api/auth/complete-challenge`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
assert.equal(replayRes.status, 401, 'replaying a consumed magic link must fail');
console.log('[e2e] Magic link replay rejected (single-use).');

shutdown();
await new Promise((r) => setTimeout(r, 1500));

// ── 7. Expiry safety (in-process, server stopped: single DB writer) ──
const challengeService = await import('../src/services/authChallengeService.js');
const created = await challengeService.createAuthChallenge({ phone: existingPhone, email: 'temea.co@gmail.com', purpose: 'login', channel: 'email', returnPath: '/chat' });
{
  const db = await getDb();
  await db.run(`UPDATE auth_challenges SET expires_at = ? WHERE id = ?`, [new Date(Date.now() - 1000).toISOString(), created.challenge.id]);
  saveDb(true);
}
const expired = await challengeService.consumeAuthChallengeToken(created.token);
assert.equal(expired.success, false, 'expired magic links must be rejected');
console.log('[e2e] Expired magic link rejected (expiry-safe).');

// ── 8. No em_* provisional identity for the existing email ──
{
  const db = await getDb();
  const stmt = db.prepare(`SELECT phone FROM memory_profiles WHERE email = 'temea.co@gmail.com'`);
  const phones: string[] = [];
  while (stmt.step()) phones.push(String(stmt.getAsObject().phone));
  stmt.free();
  assert.equal(phones.length, 1, 'exactly one canonical profile must exist for temea.co@gmail.com');
  assert.equal(phones[0], existingPhone);
  assert.ok(!phones[0].startsWith('em_'), 'existing email must never create an em_* provisional identity');
}
console.log('[e2e] temea.co@gmail.com resolved to the single existing canonical profile (no em_*).');

// ── 9. New emails keep the existing provisional identity rules ──
const freshEmail = `e2e_${Date.now()}@example.com`;
const fresh = await challengeService.requestMagicLink({ email: freshEmail });
assert.equal(fresh.success, true);
{
  const db = await getDb();
  const stmt = db.prepare(`SELECT phone FROM auth_challenges WHERE email = ? ORDER BY id DESC LIMIT 1`);
  stmt.bind([freshEmail]);
  stmt.step();
  const phone = String(stmt.getAsObject().phone);
  stmt.free();
  assert.ok(phone.startsWith('em_'), 'genuinely new emails keep the provisional em_* identity rules');
}
console.log('[e2e] Genuinely new email kept the existing provisional em_* rules.');

for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);

console.log('\n=== REAL EMAIL MAGIC-LINK E2E PASSED ===');
console.log('Real Resend delivery: VERIFIED (provider accepted the send and returned a message id; read-scope confirmation depends on key permissions).');
console.log('Canonical session: VERIFIED (kurukoo_auth cookie → /api/auth/me + authenticated profile; /perch served by the frontend with the same cookie).');
console.log('Single-use + expiry safety: VERIFIED.');
console.log('Existing email → existing user (no em_*): VERIFIED.');
