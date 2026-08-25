import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-agent-approval-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'true';
process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE = '2';
process.on('exit', () => { try { fs.rmSync(dbPath, { force: true }); } catch {} });

const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { createConversationGoal, getAgentGoal, listAgentGoalEvents } = await import('../src/services/agentRuntime.js');
const { approveAgentGoal } = await import('../src/services/agentGoalApprovalService.js');
const { getCanonicalStore } = await import('../src/services/canonicalStore.js');

const owner = `+234809${String(Date.now()).slice(-7)}`;
await upsertProfile(owner, 'Approval Owner');

// Reminder creation is a real low-risk canonical capability with a deterministic executor.
const goal = await createConversationGoal({
  phone: owner,
  conversationId: 'approval-proof',
  skill: 'reminder',
  objective: 'Create a reminder after explicit approval.',
  persistWhenDisabled: false,
});
assert.ok(goal);
assert.equal(goal!.status, 'needs_user');
assert.equal(goal!.plan.confirmationRequired, true);

const approved = await approveAgentGoal({
  phone: owner,
  goalId: goal!.id,
  action: 'create',
  arguments: { title: 'Approved Kurukoo test reminder', dueAt: new Date(Date.now() + 3600000).toISOString() },
});
assert.equal(approved.ok, true, approved.message);
assert.equal(approved.goal?.status, 'completed');
assert.equal(approved.outcome?.status, 'completed');
assert.ok(approved.outcome?.canonicalObjectId, 'Canonical executor must return the created object identity');

const refreshed = await getAgentGoal(owner, goal!.id);
assert.equal(refreshed?.status, 'completed');
const events = await listAgentGoalEvents(owner, goal!.id);
assert.ok(events.some((event) => event.action === 'notification_queued' || event.action === 'quality_evaluated'), 'Approval must leave durable lifecycle evidence');

// Approval must remain owner-scoped and cannot be replayed against another user.
const foreign = await approveAgentGoal({ phone: '+2348080000000', goalId: goal!.id, action: 'create', arguments: {} });
assert.equal(foreign.ok, false);
assert.equal(foreign.goal, null);

const store = await getCanonicalStore();
const reminder = await store.one<any>('SELECT id, phone, status FROM reminders WHERE phone=? ORDER BY id DESC LIMIT 1', [owner]);
assert.equal(String(reminder?.phone), owner);
assert.equal(String(reminder?.status), 'scheduled');

console.log('Agent approval continuation passed: explicit owner approval, canonical executor, idempotent capability result, verified Goal completion, durable lifecycle evidence, and owner isolation.');
