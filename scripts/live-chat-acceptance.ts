/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.ACCEPTANCE_BASE_URL || 'http://127.0.0.1:3100';
const testPhone = process.env.KURUKOO_TEST_PHONE || '08030000000';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'acceptance-admin-password';
const evidencePath = process.env.ACCEPTANCE_EVIDENCE || '/tmp/kurukoo-live-chat-acceptance.json';

function firstCookie(response: Response): string {
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

function parseSse(text: string): any[] {
  return text.split(/\n\n+/).map(block => block.trim()).filter(Boolean).map(block => {
    const data = block.startsWith('data: ') ? block.slice(6) : block;
    try { return JSON.parse(data); } catch { return { raw: data }; }
  });
}

const adminLogin = await fetch(`${base}/api/admin/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: adminUsername, password: adminPassword }) });
assert.equal(adminLogin.status, 200, `admin login failed: ${adminLogin.status}`);
const adminData = await readJson(adminLogin);
assert.ok(adminData.token, 'admin token missing');

const reset = await fetch(`${base}/api/admin/test-chat/reset`, { method: 'POST', headers: { 'x-admin-token': adminData.token, 'content-type': 'application/json' } });
assert.equal(reset.status, 200, `test reset failed: ${reset.status}`);

const launch = await fetch(`${base}/api/admin/test-chat`, { headers: { 'x-admin-token': adminData.token } });
assert.equal(launch.status, 200, `test chat launch failed: ${launch.status}`);
const userCookie = firstCookie(launch);
assert.match(userCookie, /^kurukoo_auth=/, 'test launch did not issue user session');

const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: userCookie } });
const meData = await readJson(me);
assert.equal(me.status, 200);
assert.equal(meData.developmentTestAccount, true);

const sequence = [
  'Hello',
  'What is Kurukoo?',
  'Remember that I prefer short answers.',
  'What do you remember about me?',
  'Remind me tomorrow to test Kurukoo.',
  'I need a plumber.',
  'Ikeja.',
  'Tomorrow evening.',
  'Continue where we left off.',
  'I want to order food.',
  'Jollof rice for two.',
  'Ask the community.',
  'Cancel the reminder.',
  'Keep checking for a plumber and tell me when you find one.',
  'What have you been doing for me?',
  'Cancel that.',
];

let conversationId = '';
const turns: any[] = [];
for (const message of sequence) {
  const response = await fetch(`${base}/api/chat/stream`, {
    method: 'POST',
    headers: { cookie: userCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ message, channel: 'web', ...(conversationId ? { conversationId } : {}) }),
  });
  const body = await response.text();
  const events = parseSse(body);
  const processing = events.find(event => event?.type === 'status' && event?.status === 'processing');
  assert.equal(processing?.grounded, true, `${message}: missing grounded processing event`);
  const conversationEvent = events.find(event => event?.type === 'conversation');
  const done = events.find(event => event?.type === 'done');
  if (conversationEvent?.conversationId) conversationId = conversationEvent.conversationId;
  turns.push({ message, status: response.status, conversationId, events, reply: done?.fullReply || events.filter(event => event?.type === 'text').map(event => event.content || '').join('') });
  assert.equal(response.status, 200, `Chat failed for ${message}`);
  assert.ok(conversationId, `No conversation ID for ${message}`);
}

const history = await fetch(`${base}/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=100`, { headers: { cookie: userCookie } });
const historyData = await readJson(history);
const historyEvidence = { status: history.status, body: historyData };
assert.equal(history.status, 200);
assert.ok(Array.isArray(historyData.messages), `history response did not contain messages: ${JSON.stringify(historyEvidence).slice(0, 1000)}`);
const evidence = { base, testPhone, conversationId, identity: meData, turns, history: { status: history.status, messageCount: historyData.messages.length, conversations: historyData.conversations } };
await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
assert.ok(historyData.messages.length >= sequence.length * 2, `conversation history did not persist both sides: ${JSON.stringify(historyEvidence).slice(0, 1600)}`);

await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2));
console.log(`Live Chat acceptance passed: ${sequence.length} continuous turns, conversation ${conversationId}, ${historyData.messages.length} persisted messages.`);
console.log(`Evidence: ${evidencePath}`);
