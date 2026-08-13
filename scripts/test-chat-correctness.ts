import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-chat-correctness-'));
process.env.DB_PATH = path.join(tempDir, 'chat.sqlite');
process.env.JWT_SECRET = 'chat-correctness-test-secret-0123456789';
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_MAX_CONCURRENT_GOALS = '4';
process.env.CREDIT_ECONOMY_ENABLED = 'true';

const { app } = await import('../src/index.js');
const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { getDb } = await import('../src/database.js');

const phone = '+2348090000011';
await upsertProfile(phone, 'Chat Correctness User');

const token = jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

function parseSse(body: string): Array<Record<string, any>> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map(chunk => chunk.replace(/^data:\s*/, ''))
    .filter(chunk => chunk !== '[DONE]')
    .map(chunk => JSON.parse(chunk));
}

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

try {
  const balance = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'Show my Points balance', channel: 'web' }),
  });
  assert.equal(balance.status, 200, 'Authenticated chat must accept a native balance request');
  const balanceEvents = parseSse(await balance.text());
  const balanceDone = balanceEvents.find(event => event.type === 'done');
  assert.match(String(balanceDone?.fullReply || ''), /Points/i, 'Balance requests must return a useful native response');
  assert.ok(balanceDone?.conversationId, 'Every chat turn must persist a canonical conversation ID');

  const db = await getDb();
  const implicitGoalsAfterBalance = db.exec("SELECT id FROM agent_goals WHERE phone = ?", [phone]);
  assert.equal(implicitGoalsAfterBalance[0]?.values?.length || 0, 0, 'A normal native conversation turn must not silently create an autonomous goal');

  const worker = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'I need a plumber', channel: 'web' }),
  });
  assert.equal(worker.status, 200, 'A canonical service request must enter through the existing chat flow');
  const workerEvents = parseSse(await worker.text());
  const workerDone = workerEvents.find(event => event.type === 'done');
  assert.equal(workerDone?.cardData?.type, 'agentic_storefront', 'Service requests must use the canonical interactive storefront card');
  assert.ok(workerDone?.cardData?.requestId, 'Starting a service request must retain its canonical Economic Request identity');

  const goalsAfterRequest = db.exec("SELECT id, economic_request_id FROM agent_goals WHERE phone = ?", [phone]);
  assert.equal(goalsAfterRequest[0]?.values?.length, 1, 'An explicit canonical request may create one bounded continuation goal');
  assert.equal(String(goalsAfterRequest[0]?.values?.[0]?.[1]), String(workerDone.cardData.requestId), 'The bounded goal must point at the same Economic Request');

  const resumed = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'continue', channel: 'web', conversationId: workerDone.conversationId }),
  });
  assert.equal(resumed.status, 200, 'The same conversation must support request continuation');
  const resumedEvents = parseSse(await resumed.text());
  const resumedDone = resumedEvents.find(event => event.type === 'done');
  assert.equal(resumedDone?.cardData?.type, 'agentic_storefront', 'Conversation continuation must resume the existing storefront rather than starting a parallel flow');
  assert.equal(String(resumedDone?.cardData?.requestId), String(workerDone.cardData.requestId), 'Continuation must preserve the original Economic Request');
  const goalsAfterResume = db.exec("SELECT id FROM agent_goals WHERE phone = ?", [phone]);
  assert.equal(goalsAfterResume[0]?.values?.length, 1, 'Request continuation must not create duplicate agent goals');

  const reminder = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'Remind me in 2 minutes to stretch', channel: 'web' }),
  });
  assert.equal(reminder.status, 200, 'Native reminders must work through Chat');
  const reminderEvents = parseSse(await reminder.text());
  const reminderDone = reminderEvents.find(event => event.type === 'done');
  assert.match(String(reminderDone?.fullReply || ''), /Done\. I’ll remind you/i, 'Reminder turns must receive the native reminder confirmation');
  const reminderOrders = db.exec("SELECT id FROM orders WHERE phone = ? AND order_type = 'lead'", [phone]);
  assert.equal(reminderOrders[0]?.values?.length || 0, 0, 'Native reminders must not create economic lead orders');
  const goalsAfterReminder = db.exec("SELECT id FROM agent_goals WHERE phone = ?", [phone]);
  assert.equal(goalsAfterReminder[0]?.values?.length, 1, 'Native reminders must not create an implicit autonomous goal');

  const history = await fetch(`${baseUrl}/api/chat/history?conversationId=${encodeURIComponent(String(workerDone?.conversationId))}`, { headers });
  assert.equal(history.status, 200, 'Chat history must be accessible to the authenticated owner');
  const historyPayload = await history.json() as { messages?: Array<{ sender?: string; content?: string }> };
  assert.ok(historyPayload.messages?.some(message => message.content === 'I need a plumber'), 'User messages must persist in the same canonical conversation');
  assert.ok(historyPayload.messages?.some(message => message.sender === 'assistant'), 'Assistant responses must persist in the same canonical conversation');

  console.log('Chat correctness regression passed: native conversation, storefront/request creation, bounded continuation, reminder separation, idempotent agent continuation, and persistent history.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
}
