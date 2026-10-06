/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-postgres-canonical-runtime-${process.pid}-${Date.now()}.sqlite`;

const connectionString = String(process.env.KURUKOO_TEST_POSTGRES_URL || '').trim();
if (!connectionString) {
  console.log('PostgreSQL canonical runtime: BLOCKED_EXTERNAL — set KURUKOO_TEST_POSTGRES_URL to a disposable local PostgreSQL database.');
  process.exit(0);
}

process.env.KURUKOO_DATABASE_MODE = 'postgres';
process.env.DATABASE_URL = connectionString;
process.env.KURUKOO_POSTGRES_SSL = String(process.env.KURUKOO_POSTGRES_SSL || 'false');
process.env.NODE_ENV = 'test';
process.env.OTP_DEBUG = 'true';
process.env.KURUKOO_AGENT_ENABLED = 'true';

const phone = String(process.env.KURUKOO_POSTGRES_RUNTIME_PHONE || '+2348000000999');
const requestId = String(process.env.KURUKOO_POSTGRES_RUNTIME_REQUEST_ID || '');
const executionId = String(process.env.KURUKOO_POSTGRES_RUNTIME_EXECUTION_ID || '');
if (!requestId || !executionId) throw new Error('KURUKOO_POSTGRES_RUNTIME_REQUEST_ID and KURUKOO_POSTGRES_RUNTIME_EXECUTION_ID are required.');
const { closeCanonicalStore } = await import('../src/services/canonicalStore.js');
const { getProfile, getMemoryFacts, recordMemoryFact } = await import('../src/services/memoryProfile.js');
const { appendChatMessage, listChatMessages } = await import('../src/services/chatConversationService.js');
const { requestPhoneOtp, verifyPhoneOtp } = await import('../src/services/otpAuthService.js');
const { getEconomicRequest } = await import('../src/services/economicRequestPersistence.js');
const { sendFcmPush, getInternalNotifications } = await import('../src/services/pushNotifications.js');
const { recordAgentWorkerRun, listAgentWorkerRuns } = await import('../src/services/agentRuntime.js');
const { getExecutionRequest } = await import('../src/services/executionPersistence.js');
const { createProviderCommunicationSession, getProviderCommunicationSession, recordProviderLocation, updateProviderCommunicationState } = await import('../src/services/providerCommunicationService.js');

try {
  assert.equal((await getProfile(phone, 'postgres-runtime-contract'))?.name, 'PostgreSQL Round Trip', 'migrated Memory profile must be readable through the canonical PostgreSQL owner');
  await recordMemoryFact(phone, 'runtime_contract', 'postgres', 'system_generated');
  assert.equal((await getMemoryFacts(phone, ['runtime_contract']))[0]?.value, 'postgres', 'Memory facts must persist through PostgreSQL');

  const chat = await appendChatMessage({ phone, sender: 'assistant', content: 'PostgreSQL canonical runtime message.', channel: 'web' });
  assert.ok(chat.id > 0);
  assert.equal((await listChatMessages(phone, { limit: 20 })).some((message: any) => message.content === 'PostgreSQL canonical runtime message.'), true, 'Chat must persist through PostgreSQL');

  const otp = await requestPhoneOtp('+2348000000888');
  assert.ok(otp.success && otp.debugCode, 'OTP must be issued in debug-gated test mode');
  assert.equal((await verifyPhoneOtp('+2348000000888', otp.debugCode!)).success, true, 'OTP verification must persist through PostgreSQL');

  assert.equal((await getEconomicRequest(requestId))?.status, 'requested', 'Economic Request must be readable through PostgreSQL');
  await sendFcmPush(phone, 'PostgreSQL runtime notification', 'Persisted without a real FCM provider.', '/chat');
  assert.equal((await getInternalNotifications(phone, 20)).some((notification: any) => notification.title === 'PostgreSQL runtime notification'), true, 'Notification record must persist through PostgreSQL');

  await recordAgentWorkerRun({ startedAt: new Date().toISOString(), status: 'completed', dueGoalCount: 0, updatedGoalCount: 0 });
  assert.ok((await listAgentWorkerRuns(5)).length > 0, 'Agent runtime state must persist through PostgreSQL');
  assert.equal((await getExecutionRequest(executionId))?.id, executionId, 'Execution/idempotency record must be readable through PostgreSQL');

  const session = await createProviderCommunicationSession({ customerPhone: phone, providerPhone: '+2348000000777', economicRequestId: requestId, mode: 'webrtc_tracking' });
  await updateProviderCommunicationState(session.id, 'connected');
  const located = await recordProviderLocation(session.id, 6.5244, 3.3792);
  assert.equal(located.state, 'provider_en_route', 'Provider communication session state must persist through PostgreSQL');
  assert.equal((await getProviderCommunicationSession(session.id))?.conversationId, session.conversationId, 'Provider communication session must retain its canonical conversation binding');

  console.log('PostgreSQL canonical runtime: VERIFIED — migrated data and canonical Auth, Memory, Chat, Economic Request, notification, Agent, execution, and provider-session persistence passed against a real PostgreSQL database.');
} finally {
  await closeCanonicalStore();
}
