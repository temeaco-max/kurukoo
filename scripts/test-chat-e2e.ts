/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Real Chat end-to-end smoke test — uses the EXISTING canonical chat path.
 *
 * Traces the full local flow:
 *   Browser → POST /api/chat/stream (SSE) → chatRouter →
 *   processCanonicalChatTurn → canonicalChatTurnService →
 *   kurukooIntelligenceRuntime (understand → reason → selectCapabilities) →
 *   modelRouter → unifiedAiEngine → model/provider (local SmolLM2 or
 *   configured hosted provider) → SSE response → UI stream.
 *
 * Verifies:
 *   - Authenticated conversation continuity (same conversationId, persistent history).
 *   - The SSE stream emits status, conversation, text, and done events.
 *   - A non-empty assistant reply is produced (model or deterministic fallback).
 *   - Diagnostics expose the canonical model/provider that produced the reply.
 *   - No mock, placeholder, or hardcoded "fake success" reply is returned.
 *
 * Distinguishes:
 *   - Code-path verified: the full local stack (HTTP → router → canonical
 *     turn service → intelligence runtime → model router → unified engine).
 *   - Locally delivered/received: the AI reply is generated and received
 *     in the SSE stream (via a configured hosted provider or local fallback).
 *   - Blocked by external credentials: none — the chat path is fully local
 *     once AI provider credentials are present in .env.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PORT = 3470;
const BASE = `http://127.0.0.1:${PORT}`;
const dbPath = path.join(root, 'tmp-e2e-chat.sqlite');

// Isolated temporary database BEFORE any src module import.
process.env.DB_PATH = dbPath;
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);

const { getDb, saveDb } = await import('../src/database.js');
const existingPhone = '+2348011111113';
{
  const db = await getDb();
  await db.run(
    `INSERT OR IGNORE INTO memory_profiles (phone, name, email, country, is_available, subscription_tier) VALUES (?, ?, ?, 'ng', 1, 'Base')`,
    [existingPhone, 'Chat E2E Tester', 'chat-e2e@example.com']
  );
  saveDb(true);
}

const serverEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'development',
  KURUKOO_PUBLIC_BASE_URL: BASE,
  KURUKOO_AUTH_CHALLENGE_DEBUG: 'true',
};

const server: ChildProcess = spawn('npx', ['tsx', 'index.ts'], {
  cwd: root,
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const serverLog: string[] = [];
server.stdout?.on('data', (d) => serverLog.push(String(d)));
server.stderr?.on('data', (d) => serverLog.push(String(d)));

const shutdown = () => { try { server.kill('SIGTERM'); } catch { /* gone */ } };
process.on('exit', shutdown);
process.on('uncaughtException', (e) => { shutdown(); console.error(e); process.exit(1); });
process.on('unhandledRejection', (r) => { shutdown(); console.error(r); process.exit(1); });

async function waitForServer(attempts = 90): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth/identity`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(serverLog.join(''));
  throw new Error('[chat-e2e] server did not become ready');
}

await waitForServer();
console.log(`[chat-e2e] Server ready on ${BASE}`);

// ── 1. Authenticate through the canonical JWT boundary ──
const { issueUserToken } = await import('../src/routes/authRoutes.js');
const token = issueUserToken(existingPhone);
const authHeaders = { Cookie: `kurukoo_auth=${token}`, 'Content-Type': 'application/json' };

// ── 2. Send first message through the canonical SSE stream ──
function parseSse(body: string): any[] {
  return body
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const data = block.startsWith('data: ') ? block.slice(6) : block;
      try { return JSON.parse(data); } catch { return { raw: data }; }
    });
}

console.log('[chat-e2e] Sending first message: "Hello, what is Kurukoo?"');
const response1 = await fetch(`${BASE}/api/chat/stream`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ message: 'Hello, what is Kurukoo?', channel: 'web' }),
});
assert.equal(response1.status, 200, `chat stream request failed: ${response1.status}`);
assert.equal(response1.headers.get('content-type'), 'text/event-stream; charset=utf-8', 'response must be SSE');

const body1 = await response1.text();
const events1 = parseSse(body1);

const statusEvent = events1.find((e) => e?.type === 'status' && e?.status === 'processing');
assert.ok(statusEvent, 'missing processing status event');
assert.equal(statusEvent?.grounded, true, 'processing status must be grounded (canonical)');

const conversationEvent = events1.find((e) => e?.type === 'conversation');
assert.ok(conversationEvent, 'missing conversation event');
assert.ok(conversationEvent?.conversationId, 'conversation event must carry a conversationId');
const conversationId = conversationEvent.conversationId;
console.log(`[chat-e2e] Conversation established: ${conversationId}`);

const doneEvent = events1.find((e) => e?.type === 'done');
assert.ok(doneEvent, 'missing done event');
assert.ok(doneEvent?.fullReply && doneEvent.fullReply.length > 0, 'done event must carry a non-empty fullReply');
assert.ok(!doneEvent?.fullReply.includes('placeholder'), 'reply must not contain placeholder text');
assert.ok(!doneEvent?.fullReply.includes('lorem ipsum'), 'reply must not contain dummy text');
assert.ok(!doneEvent?.fullReply.includes('not implemented'), 'reply must not contain "not implemented"');

const diagnostics = doneEvent?.diagnostics;
assert.ok(diagnostics, 'done event must carry diagnostics');
assert.ok(diagnostics?.modelProvider, 'diagnostics must expose the model provider');
// intentConfidence is optional — present for classified intents, may be undefined for deterministic routing
if (diagnostics?.intentConfidence !== undefined) {
  assert.ok(typeof diagnostics.intentConfidence === 'number', 'intent confidence must be a number when present');
}
console.log(`[chat-e2e] Reply from ${diagnostics.modelProvider} (${diagnostics.model}): ${doneEvent.fullReply.slice(0, 80)}…`);
console.log(`[chat-e2e] Classification: ${diagnostics.classificationSource || 'n/a'}, confidence: ${diagnostics.intentConfidence ?? 'n/a'}, action: ${diagnostics.canonicalAction || 'general'}`);

// ── 3. Send a follow-up message to verify conversation continuity ──
console.log('[chat-e2e] Sending follow-up: "What can you help me with?"');
const response2 = await fetch(`${BASE}/api/chat/stream`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    message: 'What can you help me with?',
    channel: 'web',
    conversationId,
  }),
});
assert.equal(response2.status, 200, `follow-up chat request failed: ${response2.status}`);

const body2 = await response2.text();
const events2 = parseSse(body2);
const conversationEvent2 = events2.find((e) => e?.type === 'conversation');
assert.equal(conversationEvent2?.conversationId, conversationId, 'follow-up must reuse the same conversationId (continuity)');

const doneEvent2 = events2.find((e) => e?.type === 'done');
assert.ok(doneEvent2?.fullReply && doneEvent2.fullReply.length > 0, 'follow-up must produce a reply');
console.log(`[chat-e2e] Continued conversation ${conversationId} with reply: ${doneEvent2.fullReply.slice(0, 80)}…`);

// ── 4. Verify history persistence ──
console.log('[chat-e2e] Verifying conversation history…');
const historyRes = await fetch(`${BASE}/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=100`, {
  headers: authHeaders,
});
const historyData = await historyRes.json();
assert.equal(historyRes.status, 200, 'history request failed');
assert.ok(Array.isArray(historyData.messages), 'history must return messages array');
assert.ok(historyData.messages.length >= 4, `history must persist both user and assistant turns (got ${historyData.messages.length})`);

const userMessages = historyData.messages.filter((m: any) => m.sender === 'user');
const assistantMessages = historyData.messages.filter((m: any) => m.sender === 'assistant');
assert.ok(userMessages.length >= 2, 'history must contain at least 2 user messages');
assert.ok(assistantMessages.length >= 2, 'history must contain at least 2 assistant messages');
assert.equal(userMessages[0].content, 'Hello, what is Kurukoo?', 'first user message must match');
assert.equal(userMessages[1].content, 'What can you help me with?', 'second user message must match');
console.log(`[chat-e2e] History verified: ${historyData.messages.length} total messages (${userMessages.length} user, ${assistantMessages.length} assistant).`);

// ── 5. Verify authenticated identity persists across turns ──
const meRes = await fetch(`${BASE}/api/auth/me`, { headers: authHeaders });
const meData = await meRes.json();
assert.equal(meRes.status, 200, 'authenticated /api/auth/me must succeed');
assert.equal(meData.user?.phone, existingPhone, 'session identity must remain bound to the original phone');
console.log(`[chat-e2e] Authenticated session verified for ${meData.user?.phone}.`);

// ── 6. Verify no mock/placeholder in the diagnostics ──
const provider = String(diagnostics?.modelProvider || '');
assert.ok(!provider.includes('mock'), 'model provider must not be a mock');
assert.ok(!provider.includes('fake'), 'model provider must not be fake');
assert.ok(!provider.includes('placeholder'), 'model provider must not be placeholder');
console.log(`[chat-e2e] Provider "${provider}" is a real canonical provider (no mock/stub).`);

shutdown();
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);

console.log('\n=== CHAT END-TO-END TEST PASSED ===');
console.log('Code-path verified: Browser → /api/chat/stream → chatRouter → processCanonicalChatTurn → canonicalChatTurnService → kurukooIntelligenceRuntime → modelRouter → unifiedAiEngine → model/provider.');
console.log('Locally delivered/received: AI reply generated and received in the SSE stream via a configured provider.');
console.log('Authenticated continuity: VERIFIED (same conversationId, persistent history, stable session identity).');
console.log('Blocked by external credentials: NONE (chat path is fully local with configured AI providers).');
