import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDb, saveDb } from '../src/database.js';
import { createReminder, listReminders, cancelReminder, getReminderForPhone } from '../src/services/reminderService.js';
import { executeCanonicalCapabilityProposal } from '../src/services/canonicalCapabilityExecutor.js';
import { createConversationGoal, getAgentGoal, completeAgentGoal } from '../src/services/agentRuntime.js';
import { ensureAgentRuntimeSchema } from '../src/services/agentRuntime.js';

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
let passed = 0;
let failed = 0;

function assertTest(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`${PASS} ${message}`);
  } else {
    failed++;
    console.error(`${FAIL} ${message}`);
  }
}

const TEST_PHONE = '447000000001';
const TEST_CONVERSATION_ID = `test-conv:${crypto.randomUUID().slice(0, 8)}`;

async function setupDb(): Promise<void> {
  await ensureAgentRuntimeSchema();
  const db = await getDb();
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT DEFAULT '',
    due_at TEXT NOT NULL,
    recurrence TEXT,
    status TEXT DEFAULT 'scheduled',
    source_conversation_id TEXT,
    resume_context_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_reminders_phone ON reminders(phone, due_at)');
  saveDb();
}

async function cleanup(): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM reminders WHERE phone = ?', [TEST_PHONE]);
  db.run('DELETE FROM agent_goals WHERE phone = ?', [TEST_PHONE]);
  db.run('DELETE FROM agent_goal_events WHERE goal_id IN (SELECT id FROM agent_goals WHERE phone = ?)', [TEST_PHONE]);
  db.run('DELETE FROM capability_action_runs WHERE phone = ?', [TEST_PHONE]);
  saveDb();
}

function testNoDirectCreateReminderCall(): boolean {
  const source = readFileSync('src/services/legacyIntentRouter.ts', 'utf-8');
  const lines = source.split('\n');
  for (const line of lines) {
    if (line.includes('await createReminder') || (line.includes('createReminder(') && !line.trim().startsWith('import'))) {
      return false;
    }
  }
  return true;
}

function testNoDirectCancelReminderCall(): boolean {
  const source = readFileSync('src/services/legacyIntentRouter.ts', 'utf-8');
  const lines = source.split('\n');
  for (const line of lines) {
    if (line.includes('await cancelReminder') || (line.includes('cancelReminder(') && !line.trim().startsWith('import'))) {
      return false;
    }
  }
  return true;
}

function testCompleteAgentGoalExists(): boolean {
  return typeof completeAgentGoal === 'function';
}

async function testConversationIdPassed(): Promise<boolean> {
  const dueAt = new Date(Date.now() + 60_000).toISOString();
  const idempotencyKey = `test-conv-id:${TEST_PHONE}:${TEST_CONVERSATION_ID}`;
  try {
    const result = await executeCanonicalCapabilityProposal({
      capability: 'reminder',
      action: 'create',
      arguments: { title: 'Test conv ID', dueAt },
      phone: TEST_PHONE,
      conversationId: TEST_CONVERSATION_ID,
      contextId: 'conv:' + TEST_CONVERSATION_ID,
      channel: 'chat',
      idempotencyKey,
    });
    const reminders = await listReminders(TEST_PHONE, true);
    const reminder = reminders.find(r => r.id === result.canonicalObjectId);
    return Boolean(reminder && reminder.source_conversation_id === TEST_CONVERSATION_ID && reminder.resume_context_id === 'conv:' + TEST_CONVERSATION_ID);
  } catch {
    return false;
  } finally {
    await cleanup();
  }
}
async function testSourceConversationIdRetained(): Promise<boolean> {
  const dueAt = new Date(Date.now() + 120_000).toISOString();
  const convId = `test-source-conv:${crypto.randomUUID().slice(0, 8)}`;
  const reminder = await createReminder(TEST_PHONE, {
    title: 'Source conv test',
    dueAt,
    sourceConversationId: convId,
    resumeContextId: `ctx:${convId}`,
  });
  const fetched = await getReminderForPhone(TEST_PHONE, reminder.id);
  await cleanup();
  return Boolean(fetched && fetched.source_conversation_id === convId && fetched.resume_context_id === `ctx:${convId}`);
}

async function testCanonicalExecutorCreate(): Promise<boolean> {
  const dueAt = new Date(Date.now() + 60_000).toISOString();
  const result = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'create',
    arguments: { title: 'Canonical create test', dueAt },
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    channel: 'chat',
    idempotencyKey: `test-canonical-create:${TEST_PHONE}:${Date.now()}`,
  });
  const ok = result.status === 'completed' && result.canonicalObjectId && result.canonicalFacts?.reminderId === result.canonicalObjectId;
  await cleanup();
  return ok;
}

async function testCanonicalExecutorCancel(): Promise<boolean> {
  const dueAt = new Date(Date.now() + 120_000).toISOString();
  const reminder = await createReminder(TEST_PHONE, { title: 'Cancel test', dueAt });
  const result = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'cancel',
    canonicalObjectId: reminder.id,
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    channel: 'chat',
    idempotencyKey: `test-canonical-cancel:${TEST_PHONE}:${reminder.id}`,
  });
  const ok = result.status === 'completed';
  await cleanup();
  return ok;
}

async function testIdempotency(): Promise<boolean> {
  const dueAt = new Date(Date.now() + 60_000).toISOString();
  const key = `test-idempotency:${TEST_PHONE}:${Date.now()}`;
  const first = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'create',
    arguments: { title: 'Idempotency test', dueAt },
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    channel: 'chat',
    idempotencyKey: key,
  });
  await new Promise(resolve => setTimeout(resolve, 300));
  const second = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'create',
    arguments: { title: 'Idempotency test', dueAt },
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    channel: 'chat',
    idempotencyKey: key,
  });
  const reminders = await listReminders(TEST_PHONE, true);
  const matching = reminders.filter(r => r.title === 'Idempotency test');
  await cleanup();
  return second.duplicate === true && matching.length === 1;
}

async function testCompletionRecordsCompleted(): Promise<boolean> {
  const goal = await createConversationGoal({
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    skill: 'reminder',
    objective: 'Test reminder goal completion',
    source: 'conversation',
    persistWhenDisabled: true,
  });
  if (!goal) return false;
  const completed = await completeAgentGoal(TEST_PHONE, goal.id);
  const ok = completed && completed.status === 'completed' && completed.completedAt !== undefined;
  await cleanup();
  return Boolean(ok);
}

async function testCompletionOwnerScoped(): Promise<boolean> {
  const goal = await createConversationGoal({
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    skill: 'reminder',
    objective: 'Owner scope test',
    source: 'conversation',
    persistWhenDisabled: true,
  });
  if (!goal) return false;
  const foreignCompleted = await completeAgentGoal('447000000099', goal.id);
  const ok = foreignCompleted === null || (foreignCompleted !== null && foreignCompleted.status !== 'completed');
  await cleanup();
  return ok;
}

async function testDuplicateCompletion(): Promise<boolean> {
  const goal = await createConversationGoal({
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    skill: 'reminder',
    objective: 'Duplicate completion test',
    source: 'conversation',
    persistWhenDisabled: true,
  });
  if (!goal) return false;
  const first = await completeAgentGoal(TEST_PHONE, goal.id);
  const second = await completeAgentGoal(TEST_PHONE, goal.id);
  const ok = first.status === 'completed' && second.status === 'completed';
  await cleanup();
  return ok;
}

async function testBriefContinuationConnected(): Promise<boolean> {
  const goal = await createConversationGoal({
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    skill: 'reminder',
    objective: 'Brief continuation test',
    source: 'conversation',
    persistWhenDisabled: true,
  });
  if (!goal) return false;
  await completeAgentGoal(TEST_PHONE, goal.id);
  const db = await getDb();
  const events = db.exec(
    'SELECT action, result FROM agent_goal_events WHERE goal_id = ? ORDER BY created_at DESC LIMIT 5',
    [goal.id],
  );
  const rows = events[0]?.values || [];
  await cleanup();
  return rows.length > 0 && rows.some((r: any[]) => r[0] === 'completed');
}

async function testConversationIdPreserved(): Promise<boolean> {
  const goal = await createConversationGoal({
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    skill: 'reminder',
    objective: 'Conversation preservation test',
    source: 'conversation',
    persistWhenDisabled: true,
  });
  if (!goal) return false;
  const fetched = await getAgentGoal(TEST_PHONE, goal.id);
  await cleanup();
  return Boolean(fetched && fetched.conversationId === TEST_CONVERSATION_ID);
}

async function testForeignCancelFailsClosed(): Promise<boolean> {
  const foreignId = crypto.randomUUID();
  const result = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'cancel',
    canonicalObjectId: foreignId,
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    channel: 'chat',
    idempotencyKey: `test-foreign-cancel:${TEST_PHONE}:${foreignId}`,
  });
  return result.status !== 'completed';
}

async function testStaleCancelFailsClosed(): Promise<boolean> {
  const dueAt = new Date(Date.now() + 60_000).toISOString();
  const reminder = await createReminder(TEST_PHONE, { title: 'Stale test', dueAt });
  await cancelReminder(TEST_PHONE, reminder.id);
  const result = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'cancel',
    canonicalObjectId: reminder.id,
    phone: TEST_PHONE,
    conversationId: TEST_CONVERSATION_ID,
    channel: 'chat',
    idempotencyKey: `test-stale-cancel:${TEST_PHONE}:${reminder.id}:${Date.now()}`,
  });
  await cleanup();
  return result.status === 'stale_context';
}

async function main(): Promise<void> {
  await setupDb();
  await cleanup();
  console.log('\n--- Reminder AOM Contract Tests ---\n');
  assertTest(testNoDirectCreateReminderCall(), 'legacyIntentRouter no longer directly calls createReminder');
  assertTest(testNoDirectCancelReminderCall(), 'legacyIntentRouter no longer directly calls cancelReminder');
  assertTest(testCompleteAgentGoalExists(), 'completeAgentGoal exists');
  assertTest(await testConversationIdPassed(), 'conversationId is passed into canonical execution');
  assertTest(await testSourceConversationIdRetained(), 'reminder persistence retains source_conversation_id');
  assertTest(await testCanonicalExecutorCreate(), 'canonical executor handles reminder create');
  assertTest(await testCanonicalExecutorCancel(), 'canonical executor handles exact-owner reminder cancel');
  assertTest(await testIdempotency(), 'idempotency is enforced');
  assertTest(await testCompletionRecordsCompleted(), 'completion records completed status');
  assertTest(await testCompletionOwnerScoped(), 'completion is owner-scoped');
  assertTest(await testDuplicateCompletion(), 'duplicate completion is safe');
  assertTest(await testBriefContinuationConnected(), 'Agent Brief/notification continuation is connected');
  assertTest(await testConversationIdPreserved(), 'same conversation ID is preserved through goal lifecycle');
  assertTest(await testForeignCancelFailsClosed(), 'foreign reminder ID cancel fails closed');
  assertTest(await testStaleCancelFailsClosed(), 'stale/already-cancelled reminder cancel returns stale_context');
  await cleanup();
  console.log(`\n📊 Reminder AOM Contract: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Test harness error:', error);
  process.exit(1);
});
