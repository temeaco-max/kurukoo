import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'development';
process.env.OTP_DEBUG = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'food-auth-context-resume-test-secret-0123456789abcdef';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_DEV_AUTH = 'true';
process.env.KURUKOO_TEST_PHONE = '+2348031234567';

interface StreamDone { fullReply?: string; cardData?: any; conversationId?: string; diagnostics?: { extractedEntities?: Record<string, unknown> } }

function cookieValue(headers: Headers, name: string, required = true): string {
  const values = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : [headers.get('set-cookie') || ''];
  const match = values.map(value => String(value).match(new RegExp(`${name}=([^;]+)`))).find(Boolean);
  if (!match) { if (required) assert.fail(`Expected ${name} cookie.`); return ''; }
  return `${name}=${match![1]}`;
}

function streamDone(body: string): StreamDone {
  const done = body.split('\n\n').filter(Boolean).map(chunk => chunk.replace(/^data:\s*/, '')).map(chunk => JSON.parse(chunk)).find(event => event.type === 'done');
  assert.ok(done, 'Expected a completed chat stream.');
  return done as StreamDone;
}

const { app } = await import('../src/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;
const { handleConversationalAuth, setAuthState } = await import('../src/services/conversationalAuthService.js');
const { getFulfilmentForEconomicRequest } = await import('../src/services/canonicalFulfilmentService.js');

async function turn(message: string, cookie = '', conversationId?: string): Promise<{ done: StreamDone; cookie: string; authCookie: string }> {
  const response = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ message, channel: 'web', ...(conversationId ? { conversationId } : {}) }),
  });
  assert.equal(response.status, 200, `Chat turn must succeed for ${message}`);
  const done = streamDone(await response.text());
  const nextCookie = cookie || cookieValue(response.headers, 'kurukoo_guest_id');
  const authCookie = cookieValue(response.headers, 'kurukoo_auth', false);
  return { done, cookie: nextCookie, authCookie };
}

try {
  const directGuest = 'guest-food-auth-name-boundary';
  await setAuthState(directGuest, 'awaiting_name');
  const directTaskText = await handleConversationalAuth(directGuest, 'rice and yam in Ikeja');
  assert.doesNotMatch(directTaskText.reply, /nice to meet you/i, 'The direct awaiting-name boundary must reject task/location text even when it resembles a multiword name.');
  await setAuthState(directGuest, 'awaiting_name');
  const directExplicitName = await handleConversationalAuth(directGuest, 'My name is Rice');
  assert.equal(directExplicitName.cardData?.name, 'Rice', 'An explicit identity introduction must remain valid at the direct awaiting-name boundary.');

  const first = await turn('I need rice and yam delivered to me in Ikeja.');
  const conversationId = String(first.done.conversationId || '');
  const firstCard = first.done.cardData;
  const requestId = String(firstCard?.continuationCard?.requestId || '');
  assert.equal(firstCard?.type, 'auth_conversation', 'A guest food request must retain the canonical identity boundary.');
  assert.equal(firstCard?.step, 'name', 'A guest food request must ask for identity only after preserving the request.');
  assert.ok(requestId, 'Food request continuation must retain its canonical request ID.');
  assert.equal(firstCard?.continuationCard?.skill, 'order_food');
  assert.equal(firstCard?.continuationCard?.fields?.find((field: any) => field.key === 'items')?.value, 'rice and yam');
  assert.equal(firstCard?.continuationCard?.fields?.find((field: any) => field.key === 'location')?.value, 'Ikeja');
  assert.equal(firstCard?.continuationCard?.extractedEntities?.delivery, true, 'Delivery intent must remain a semantic task slot.');

  const repeatedTask = await turn('rice and yam in Ikeja', first.cookie, conversationId);
  assert.equal(repeatedTask.done.cardData?.type, 'auth_conversation', 'Repeated food details must remain on the canonical auth boundary, not become a name.');
  assert.equal(repeatedTask.done.cardData?.step, 'name');
  assert.equal(repeatedTask.done.cardData?.continuationCard?.requestId, requestId, 'Repeated food details must merge into the same request.');
  assert.doesNotMatch(String(repeatedTask.done.fullReply || ''), /nice to meet you, rice/i, 'Task text must never be accepted as an identity name.');
  assert.equal(repeatedTask.done.cardData?.continuationCard?.fields?.find((field: any) => field.key === 'items')?.value, 'rice and yam');

  const named = await turn('My name is Rice', first.cookie, conversationId);
  assert.equal(named.done.cardData?.step, 'phone', 'An explicit standalone name must advance only the identity subflow.');
  assert.equal(named.done.cardData?.name, 'Rice', 'Identity parsing must remove the name-introduction phrase.');

  const inline = await turn("I'm Tunde; I need rice in Ikeja");
  assert.equal(inline.done.cardData?.type, 'auth_conversation');
  assert.equal(inline.done.cardData?.step, 'phone', 'A leading explicit identity phrase may advance identity while the task remains separate.');
  assert.equal(inline.done.cardData?.name, 'Tunde');
  assert.equal(inline.done.cardData?.continuationCard?.skill, 'order_food');
  assert.equal(inline.done.cardData?.continuationCard?.fields?.find((field: any) => field.key === 'items')?.value, 'rice');
  assert.equal(inline.done.cardData?.continuationCard?.fields?.find((field: any) => field.key === 'location')?.value, 'Ikeja');

  const resumeStart = await turn('I need rice and yam delivered to me in Ikeja.');
  const resumeConversationId = String(resumeStart.done.conversationId || '');
  const resumeRequestId = String(resumeStart.done.cardData?.continuationCard?.requestId || '');
  const name = await turn('Ada Okafor', resumeStart.cookie, resumeConversationId);
  assert.equal(name.done.cardData?.step, 'phone');
  const phone = process.env.KURUKOO_TEST_PHONE!;
  const phoneTurn = await turn(phone, resumeStart.cookie, resumeConversationId);
  const debugCode = String(phoneTurn.done.cardData?.devCode || '');
  assert.match(debugCode, /^\d{6}$/, 'Controlled test identity must expose an explicit development-only OTP.');
  const authenticated = await turn(debugCode, resumeStart.cookie, resumeConversationId);
  const authCard = authenticated.done.cardData;
  assert.equal(authCard?.requestId, resumeRequestId, 'Authentication must resume the original request ID rather than create a new request.');
  assert.equal(authCard?.resumedAfterAuthentication, true, 'The returned card must disclose exact request resumption after identity.');
  assert.equal(authCard?.fields?.find((field: any) => field.key === 'items')?.value, 'rice and yam');
  assert.equal(authCard?.fields?.find((field: any) => field.key === 'location')?.value, 'Ikeja');
  assert.match(String(authenticated.done.fullReply || ''), /resumed the exact request/i, 'Authentication completion must truthfully report continuity.');
  assert.ok(authenticated.authCookie, 'In-chat authentication must attach an authenticated session cookie.');
  const authenticatedFulfilment = await getFulfilmentForEconomicRequest(process.env.KURUKOO_TEST_PHONE!, resumeRequestId);
  assert.equal(authenticatedFulfilment?.skill, 'order_food', 'The real Chat request must retain its durable fulfilment projection after authentication.');
  assert.equal(authenticatedFulfilment?.ownerPhone, process.env.KURUKOO_TEST_PHONE, 'Guest fulfilment ownership must migrate to the authenticated account with its request.');
  assert.equal(authenticatedFulfilment?.requirements.items, 'rice and yam');

  const correction = await turn('Change location to Lekki', authenticated.authCookie, resumeConversationId);
  assert.equal(correction.done.cardData?.requestId, resumeRequestId, 'Correction must target the exact authenticated request.');
  assert.equal(correction.done.cardData?.fields?.find((field: any) => field.key === 'location')?.value, 'Lekki');
  const correctedFulfilment = await getFulfilmentForEconomicRequest(process.env.KURUKOO_TEST_PHONE!, resumeRequestId);
  assert.equal(correctedFulfilment?.id, authenticatedFulfilment?.id, 'Corrections must update the same fulfilment record as the exact request.');
  assert.equal(correctedFulfilment?.requirements.location, 'Lekki', 'Fulfilment requirements must follow the canonical Chat correction.');

  const interruption = await turn('What is Kurukoo?', authenticated.authCookie, resumeConversationId);
  assert.notEqual(interruption.done.cardData?.requestId, resumeRequestId, 'An informational interruption must not masquerade as an updated request card.');
  const resumed = await turn('Continue with my request', authenticated.authCookie, resumeConversationId);
  assert.equal(resumed.done.cardData?.requestId, resumeRequestId, 'Resume must return to the same canonical request after an interruption.');
  assert.equal(resumed.done.cardData?.fields?.find((field: any) => field.key === 'location')?.value, 'Lekki');

  console.log(JSON.stringify({ ok: true, requestId, resumedRequestId: resumeRequestId, identityIsolation: true, slots: ['items', 'location', 'delivery'], cases: ['direct_name_guard', 'rice_and_ikeja', 'rice_and_yam_in_ikeja', 'my_name_is_rice', 'inline_tunde_food', 'authentication_resume', 'repeated_answer', 'correction', 'interruption_resume'] }));
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
