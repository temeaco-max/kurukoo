import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'development';
process.env.OTP_DEBUG = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qr-context-test-secret-0123456789abcdef';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { app } = await import('../src/index.js');
const { getDb } = await import('../src/database.js');
const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { generateReferralCode, trackReferral } = await import('../src/services/referralService.js');
const { buildQrEntryUrl, describeQrContext, parseQrContext, signQrContext, verifyQrContext } = await import('../src/services/qrContextService.js');
const { listChatConversations, listChatMessages } = await import('../src/services/chatConversationService.js');

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

function cookieValue(headers: Headers, name: string): string {
  const candidates = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : [headers.get('set-cookie') || ''];
  const match = candidates.map(value => String(value).match(new RegExp(`${name}=([^;]+)`))).find(Boolean);
  assert.ok(match, `Expected ${name} cookie; received ${JSON.stringify(candidates)}`);
  return `${name}=${match[1]}`;
}

function economicRequestCount(db: any, phone?: string): number {
  const exists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='economic_requests'`);
  if (!exists[0]?.values?.length) return 0;
  const result = phone
    ? db.exec(`SELECT COUNT(*) FROM economic_requests WHERE phone=?`, [phone])
    : db.exec(`SELECT COUNT(*) FROM economic_requests`);
  return Number(result[0]?.values?.[0]?.[0] || 0);
}

try {
  const contexts = [
    { type: 'referral', ref: 'ABCD1234', source: 'poster' },
    { type: 'contributor', source: 'network-invitation' },
    { type: 'offer', entity: 'Phone repair' },
    { type: 'product', entity: 'Solar panel' },
    { type: 'location', entity: 'Ikeja' },
    { type: 'channel', channel: 'whatsapp' },
  ] as const;
  for (const context of contexts) {
    const parsed = parseQrContext({ context: context.type, ...context });
    assert.ok(parsed, `${context.type} context must remain bounded and supported`);
    const token = signQrContext(parsed!);
    assert.deepEqual(verifyQrContext(token), parsed, `${context.type} token must verify`);
  }

  const referral = parseQrContext({ context: 'referral', ref: 'ABCD1234', source: 'poster' })!;
  const token = signQrContext(referral);
  assert.equal(verifyQrContext(`${token}tampered`), null, 'Tampered opaque context must reject');
  assert.equal(verifyQrContext(signQrContext(referral, Date.now() - 1)), null, 'Expired opaque context must reject');
  for (const forbidden of ['otp', 'password', 'cookie', 'session_id', 'api_key', 'payment_credential', 'phone', 'voice_token']) {
    assert.equal(parseQrContext({ context: 'public', [forbidden]: 'secret' }), null, `${forbidden} must never be accepted as QR metadata`);
  }
  assert.equal(parseQrContext({ context: 'payment', ref: 'ABCD' }), null, 'Unsupported QR type must reject');
  assert.equal(parseQrContext({ context: 'referral', ref: 'x'.repeat(33) }), null, 'Overlong QR metadata must reject');
  assert.match(describeQrContext(parseQrContext({ context: 'channel', channel: 'whatsapp' })!), /not connected/i, 'Unconfigured channel QR must not claim connectivity');

  const entryUrl = buildQrEntryUrl(baseUrl, referral);
  const entry = new URL(entryUrl);
  assert.equal(entry.pathname, '/start');
  assert.ok(entry.searchParams.get('qr'), 'Generated entry URL must carry a signed opaque QR context');
  assert.equal(entry.searchParams.get('ref'), null, 'Generated entry URL must not expose referral metadata directly');
  for (const secretKey of ['token', 'password', 'otp', 'cookie', 'session', 'api_key', 'payment']) assert.equal(entry.searchParams.get(secretKey), null, `Entry URL must not expose ${secretKey}`);

  const start = await fetch(entryUrl, { redirect: 'manual' });
  assert.equal(start.status, 302, '/start must redirect signed contexts into chat');
  const redirected = new URL(start.headers.get('location') || '', baseUrl);
  assert.equal(redirected.pathname, '/chat');
  assert.equal(redirected.searchParams.get('qr'), entry.searchParams.get('qr'), '/start must preserve only the verified opaque context');
  const badStart = await fetch(`${baseUrl}/start?qr=not-a-valid-token`, { redirect: 'manual' });
  assert.equal(badStart.headers.get('location'), '/chat?qr_error=invalid', '/start must reject malformed or tampered QR contexts');

  const beforeDb = await getDb();
  const beforeRequests = economicRequestCount(beforeDb);
  const firstActivation = await fetch(`${baseUrl}/api/qr/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr: entry.searchParams.get('qr') }) });
  assert.equal(firstActivation.status, 200, 'Signed QR must activate for a guest');
  const guestCookie = cookieValue(firstActivation.headers, 'kurukoo_guest_id');
  const first = await firstActivation.json() as { conversationId: string; messageId: number; activated: boolean; intro: string };
  assert.ok(first.conversationId && first.messageId, 'QR activation must use the canonical conversation and message ledger');
  assert.equal(first.activated, true);
  const guestPhone = decodeURIComponent(guestCookie.split('=')[1]);
  assert.equal((await listChatConversations(guestPhone)).length, 1, 'First QR arrival may create only the guest’s canonical conversation');
  const repeatedActivation = await fetch(`${baseUrl}/api/qr/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: guestCookie }, body: JSON.stringify({ qr: entry.searchParams.get('qr'), conversationId: first.conversationId }) });
  const repeated = await repeatedActivation.json() as { conversationId: string; messageId: number; activated: boolean };
  assert.equal(repeated.conversationId, first.conversationId, 'QR activation must reuse the existing conversation');
  assert.equal(repeated.messageId, first.messageId, 'The contextual greeting must persist once rather than duplicate');
  assert.equal(repeated.activated, false, 'Repeated activation must be idempotent');
  const afterRequests = economicRequestCount(await getDb());
  assert.equal(afterRequests, beforeRequests, 'QR scanning and activation must never create an Economic Request');
  const messages = await listChatMessages(guestPhone, { conversationId: first.conversationId, limit: 20 });
  assert.equal(messages.filter(message => String(message.channel) === 'web_qr').length, 1, 'QR greeting must live in the existing conversation message store only once');

  const rawActivation = await fetch(`${baseUrl}/api/qr/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: guestCookie }, body: JSON.stringify({ context: 'referral', ref: 'ABCD1234' }) });
  assert.equal(rawActivation.status, 400, 'Unsigned raw QR metadata must not be activated');

  const referrerPhone = `+234805${String(Date.now()).slice(-7)}`;
  await upsertProfile(referrerPhone, 'QR Referrer');
  const referralCode = await generateReferralCode(referrerPhone);
  await trackReferral(referrerPhone, referrerPhone, referralCode);
  const selfReferralRows = (await getDb()).exec(`SELECT status FROM referrals WHERE referrer_phone=? AND referred_phone=?`, [referrerPhone, referrerPhone]);
  assert.equal(selfReferralRows[0]?.values?.length || 0, 0, 'Service-level self-referral must not create attribution');
  const migrationToken = signQrContext(parseQrContext({ context: 'referral', ref: referralCode, source: 'migration-test' })!);
  const migrationActivation = await fetch(`${baseUrl}/api/qr/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr: migrationToken }) });
  const migrationGuestCookie = cookieValue(migrationActivation.headers, 'kurukoo_guest_id');
  const migrationGuest = decodeURIComponent(migrationGuestCookie.split('=')[1]);
  const migration = await migrationActivation.json() as { conversationId: string };
  const userPhone = `+234806${String(Date.now()).slice(-7)}`;
  const otpIssue = await fetch(`${baseUrl}/api/auth/request-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: userPhone }) });
  const otp = await otpIssue.json() as { debugCode?: string };
  assert.match(String(otp.debugCode || ''), /^\d{6}$/, 'Controlled OTP test must receive a development code');
  const verification = await fetch(`${baseUrl}/api/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: userPhone, code: otp.debugCode, guestPhone: migrationGuest }) });
  assert.equal(verification.status, 200, 'Guest QR conversation must migrate through canonical OTP verification');
  const authCookie = cookieValue(verification.headers, 'kurukoo_auth');
  const migratedMessages = await listChatMessages(userPhone, { conversationId: migration.conversationId, limit: 20 });
  assert.ok(migratedMessages.some(message => String(message.channel) === 'web_qr'), 'QR greeting must survive guest-to-authenticated migration in the same conversation');
  const referralRows = (await getDb()).exec(`SELECT status FROM referrals WHERE referrer_phone=? AND referred_phone=?`, [referrerPhone, userPhone]);
  assert.equal(String(referralRows[0]?.values?.[0]?.[0] || ''), 'registered', 'Post-OTP QR attribution may register a referral but must not award Points or claim qualification');

  const qrToIntent = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify({ message: 'I need a taxi to Ikeja.', channel: 'web', conversationId: migration.conversationId }),
  });
  assert.equal(qrToIntent.status, 200, 'A QR-originated authenticated conversation must continue through canonical chat');
  await qrToIntent.text();
  const qrRequests = economicRequestCount(await getDb(), userPhone);
  assert.ok(qrRequests >= 1, 'Only the user’s subsequent intent may enter the existing Economic Request lifecycle');

  const voice = fs.readFileSync('public/js/kurukoo-voice.js', 'utf8');
  assert.match(voice, /localStorage\.getItem\('kurukoo_conversation_id'\)/, 'Voice must reuse the QR-originated canonical conversation ID');
  assert.match(voice, /body: JSON\.stringify\(\{ conversationId: requestedConversationId \}\)/, 'Voice session must converge on the existing chat conversation');
  const scanner = fs.readFileSync('public/js/kurukoo-qr-page.js', 'utf8');
  assert.match(scanner, /url\.origin !== location\.origin/, 'QR scanner must reject external destinations instead of opening them');
  assert.match(scanner, /url\.pathname !== '\/start'/, 'QR scanner must accept only the signed Kurukoo entry route');
  const qrRouterSource = fs.readFileSync('src/routes/qrRouter.ts', 'utf8');
  assert.doesNotMatch(qrRouterSource, /addPoints\(|addCredits\(/, 'QR routes must never award Points');
  assert.match(qrRouterSource, /verifyQrContext\(/, 'QR activation must verify signed opaque context');
  const authSource = fs.readFileSync('src/routes/authRoutes.ts', 'utf8');
  assert.match(authSource, /applyQrReferralAttribution\(/, 'Browser OTP verification must apply QR attribution only after guest migration');

  await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: authCookie } });
  console.log('QR context integration passed: signed bounded entry, safe start redirect, idempotent canonical activation, no scan request or Points creation, channel truthfulness, guest-to-OTP continuity, post-auth referral registration, and voice conversation handoff.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
