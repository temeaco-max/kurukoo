import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'development';
process.env.OTP_DEBUG = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'conversation-first-test-secret-0123456789abcdef';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
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

function sseEvents(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map(chunk => chunk.replace(/^data:\s*/, ''))
    .map(chunk => JSON.parse(chunk));
}

try {
  const guestRequest = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'I need a plumber.', channel: 'web' }),
  });
  assert.equal(guestRequest.status, 200, 'Guests should be able to begin a conversation');
  const guestCookie = cookieValue(guestRequest.headers, 'kurukoo_guest_id');
  const guestEvents = sseEvents(await guestRequest.text());
  const conversation = guestEvents.find(event => event.type === 'conversation');
  const typingIndex = guestEvents.findIndex(event => event.type === 'status' && event.status === 'typing');
  const firstTextIndex = guestEvents.findIndex(event => event.type === 'text');
  const completeIndex = guestEvents.findIndex(event => event.type === 'status' && event.status === 'complete');
  const done = guestEvents.find(event => event.type === 'done');
  assert.ok(typingIndex >= 0, 'Chat streams must emit a typing status for the live chat indicator');
  assert.ok(firstTextIndex > typingIndex, 'Typing status must arrive before assistant text begins');
  assert.ok(completeIndex > firstTextIndex, 'Typing status must complete before the final stream payload');
  const conversationId = String(conversation?.conversationId || '');
  assert.ok(conversationId, 'Guest conversation should have a persistent ID');
  const guestCard = done?.cardData as { type?: string; step?: string; message?: string; continuationCard?: { type?: string } } | undefined;
  const guestReply = guestEvents.filter(event => event.type === 'text').map(event => String(event.content || '')).join('');
  assert.equal(guestCard?.type, 'auth_conversation', 'Economic requests should present the compact conversational auth form before protected actions');
  assert.equal(guestCard?.step, 'name', 'Protected guest requests should begin with the name step');
  assert.ok(guestReply.match(/tell me your name.*sign-in/i), 'Guest identity gates must describe the next action without repeating profile creation');
  assert.doesNotMatch(guestReply, /create your kurukoo profile/i, 'Guest identity gates must not repeat the retired profile-creation prompt');
  assert.doesNotMatch(guestReply, /connect with providers/i, 'Guest identity gates must not promise provider connection');
  assert.doesNotMatch(String(guestCard?.message || ''), /quotes|book a provider/i, 'Guest identity cards must not promise quotes or booking');
  assert.ok(guestCard?.continuationCard && guestCard.continuationCard.type !== 'auth_gate', 'Identity gates should retain the original safe request projection for resumption');

  const contextSwitchRequest = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ message: 'Please find someone to clean my flat in Ibadan this weekend', channel: 'web', conversationId }),
  });
  assert.equal(contextSwitchRequest.status, 200, 'A new service request must remain routable while guest identity capture is active');
  const contextSwitchEvents = sseEvents(await contextSwitchRequest.text());
  const contextSwitchDone = contextSwitchEvents.find(event => event.type === 'done');
  const contextSwitchCard = contextSwitchDone?.cardData as { type?: string; continuationCard?: { type?: string; skill?: string; stage?: string } } | undefined;
  assert.equal(contextSwitchCard?.type, 'auth_conversation', 'The switched service request should preserve the conversational auth boundary');
  assert.equal(contextSwitchCard?.continuationCard?.type, 'agentic_storefront', 'The switched service request must retain its canonical Economic Request projection');
  assert.equal(contextSwitchCard?.continuationCard?.skill, 'find_worker', 'Cleaning language must route to the canonical worker skill');
  assert.equal(contextSwitchCard?.continuationCard?.stage, 'deferred', 'No-provider local outcome must remain explicitly deferred');
  assert.match(String(contextSwitchDone?.fullReply || ''), /remains open|re-checked|save or continue/i, 'The switched service request must not be answered as a person name');

  const onboardingNameRequest = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ message: 'Grace Okafor', channel: 'web', conversationId }),
  });
  const onboardingNameEvents = sseEvents(await onboardingNameRequest.text());
  const onboardingNameReply = onboardingNameEvents.filter(event => event.type === 'text').map(event => String(event.content || '')).join('');
  assert.doesNotMatch(onboardingNameReply, /I(?:’|')ll send|sent a verification|code sent to your phone/i, 'Name onboarding must not promise external OTP delivery before a provider is configured');
  assert.match(onboardingNameReply, /verification request|approved delivery/i, 'Name onboarding must describe the bounded verification request truthfully');

  const phone = `+234803${String(Date.now()).slice(-7)}`;
  const onboardingPhoneRequest = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ message: phone, channel: 'web', conversationId }),
  });
  const onboardingPhoneEvents = sseEvents(await onboardingPhoneRequest.text());
  const onboardingPhoneReply = onboardingPhoneEvents.filter(event => event.type === 'text').map(event => String(event.content || '')).join('');
  assert.match(onboardingPhoneReply, /external SMS\/WhatsApp delivery is not configured|approved delivery provider/i, 'Phone onboarding must disclose unavailable external delivery');
  assert.doesNotMatch(onboardingPhoneReply, /I(?:’|')ve sent.*verification code|code sent to your phone/i, 'Phone onboarding must not claim an external code was delivered');

  const otpRequest = await fetch(`${baseUrl}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const otp = await otpRequest.json() as { success?: boolean; debugCode?: string };
  assert.equal(otpRequest.status, 200, 'OTP request should succeed in controlled development testing');
  assert.equal(otp.success, true);
  assert.match(String(otp.debugCode || ''), /^\d{6}$/, 'Development OTP should be exposed only when OTP_DEBUG is enabled');

  const invalidOtp = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: '000000', guestPhone: decodeURIComponent(guestCookie.split('=')[1]) }),
  });
  assert.equal(invalidOtp.status, 401, 'Invalid OTPs must be rejected');

  const verify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: otp.debugCode, guestPhone: decodeURIComponent(guestCookie.split('=')[1]) }),
  });
  const verified = await verify.json() as { success?: boolean; token?: string };
  assert.equal(verify.status, 200, 'A valid OTP should create a session');
  assert.equal(verified.success, true);
  assert.ok(verified.token, 'Valid OTP responses should issue a JWT');
  const authCookie = cookieValue(verify.headers, 'kurukoo_auth');

  const continued = await fetch(`${baseUrl}/api/chat/history?conversationId=${encodeURIComponent(conversationId)}`, {
    headers: { Cookie: authCookie },
  });
  const continuedPayload = await continued.json() as { messages?: Array<{ content?: string }> };
  assert.equal(continued.status, 200, 'Authenticated users should load their preserved conversation');
  assert.ok(continuedPayload.messages?.some(message => message.content === 'I need a plumber.'), 'Guest intent must survive authentication');
  assert.ok(continuedPayload.messages?.some(message => message.content === 'Please find someone to clean my flat in Ibadan this weekend'), 'Switched guest service intent must survive authentication');

  const resumedRequest = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify({
      message: 'I need a plumber to fix a leaking kitchen tap in Ikeja.',
      channel: 'web',
      conversationId,
    }),
  });
  assert.equal(resumedRequest.status, 200, 'A signed-in visitor should be able to continue the preserved request');
  const resumedEvents = sseEvents(await resumedRequest.text());
  const resumedDone = resumedEvents.find(event => event.type === 'done');
  assert.notEqual((resumedDone?.cardData as { type?: string } | undefined)?.type, 'survey', 'Claimed requests must not be diverted into onboarding');
  assert.doesNotMatch(String(resumedDone?.fullReply || ''), /Nice to meet you/i, 'Claimed requests must preserve the fulfillment journey');

  const anonymousRequests = await fetch(`${baseUrl}/requests`, { redirect: 'manual' });
  assert.equal(anonymousRequests.status, 302, 'Unauthenticated canonical Request Hub visits should redirect contextually');
  assert.equal(anonymousRequests.headers.get('location'), '/login?return=%2Frequests');

  const authenticatedRequests = await fetch(`${baseUrl}/requests`, { headers: { Cookie: authCookie } });
  assert.equal(authenticatedRequests.status, 200, 'Authenticated users should access the canonical Request Hub');

  const legacyWeb = await fetch(`${baseUrl}/web`, { redirect: 'manual' });
  assert.equal(legacyWeb.status, 404, 'The deprecated Request Hub alias must be retired instead of adding a compatibility redirect');
  assert.equal(legacyWeb.headers.get('location'), null, 'A retired Request Hub alias must not issue a navigation redirect');

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: authCookie } });
  assert.equal(logout.status, 200, 'Canonical logout should succeed');
  const logoutCookies = typeof (logout.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (logout.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : [logout.headers.get('set-cookie') || ''];
  assert.ok(logoutCookies.some(value => /^kurukoo_auth=;.*Max-Age=0/.test(value)), 'Logout must expire the auth cookie');
  const sessionAfterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: 'kurukoo_auth=' } });
  assert.equal(sessionAfterLogout.status, 401, 'Logout must clear the authenticated session');

  const legacyAuthRoute = await fetch(`${baseUrl}/api/chat/auth/request-otp`, { method: 'POST' });
  assert.equal(legacyAuthRoute.status, 404, 'Chat must not own a second authentication route');

  console.log('Conversation-first authentication regression passed.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
