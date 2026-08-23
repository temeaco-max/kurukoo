/**
 * Deterministic contract: reminder through the Agent Operating Model path.
 * Proves Chat → intent → canonical executor → domain persist → Agent Goal completed
 * with sourceConversationId preserved and idempotent re-submission.
 */
import assert from 'node:assert/strict';
import { routeIntent } from '../src/services/legacyIntentRouter.js';
import { listReminders } from '../src/services/reminderService.js';
import { listAgentGoals, listAgentGoalEvents, getAgentGoal } from '../src/services/agentRuntime.js';
import { executeCanonicalCapabilityProposal } from '../src/services/canonicalCapabilityExecutor.js';
import { buildAgentBrief } from '../src/services/agentBriefService.js';

const phone = '+2348000999001';
const conversationId = `conv-aom-reminder-${Date.now()}`;

async function main() {
  // 1–5: intent → canonical executor → persisted reminder with conversation id
  const first = await routeIntent(
    'Remind me tomorrow at 9 to call the repair shop.',
    phone,
    undefined,
    undefined,
    conversationId,
  );
  assert.equal(first.skill, 'reminder', 'intent must select reminder');
  assert.equal(first.canonicalAction, 'reminder.create', 'canonical action must be reminder.create');
  assert.match(first.reply || '', /remind you/i, 'user-facing confirmation required');
  assert.ok(first.cardData?.reminder?.id, 'card must expose reminder id');

  const reminders = await listReminders(phone);
  const created = reminders.find((r) => r.id === first.cardData.reminder.id);
  assert.ok(created, 'reminder must be persisted');
  assert.equal(created!.status, 'scheduled');
  assert.equal(
    created!.source_conversation_id,
    conversationId,
    `source_conversation_id must equal originating conversation (got ${created!.source_conversation_id})`,
  );

  // 6–9: Agent Goal created and completed with event evidence
  const goals = await listAgentGoals(phone, true);
  const goal = goals.find((g) => g.goalType === 'reminder' && g.objective.includes('call the repair shop'));
  assert.ok(goal, 'Agent Goal must be created for reminder');
  assert.equal(goal!.conversationId, conversationId, 'Agent Goal conversationId must match');
  assert.equal(goal!.status, 'completed', `Agent Goal must be completed after one-shot success (got ${goal!.status})`);
  assert.ok(goal!.completedAt, 'completion timestamp required');

  const events = await listAgentGoalEvents(phone, goal!.id);
  const completedEvent = events.find((e) => e.action === 'completed' && e.result === 'success');
  assert.ok(completedEvent, 'completion event must exist');
  assert.ok(
    completedEvent!.evidence?.includes(created!.id) || completedEvent!.detail?.includes(created!.id),
    'completion event must reference reminder id',
  );

  // 10: Agent Brief sees the completed goal / reminder
  const brief = await buildAgentBrief(phone);
  const briefRefs = (brief.items || []).map((i: any) => String(i.stableRef || ''));
  assert.ok(
    briefRefs.some((r: string) => r.includes(goal!.id) || r.includes(created!.id)),
    'Agent Brief must reference goal or reminder',
  );

  // 11–12: idempotent re-submission does not create a second reminder for same key
  const beforeCount = reminders.length;
  const second = await executeCanonicalCapabilityProposal({
    capability: 'reminder',
    action: 'create',
    arguments: { title: 'call the repair shop', dueAt: created!.due_at },
    phone,
    conversationId,
    channel: 'chat',
    idempotencyKey: `route-reminder-create:${phone}:${conversationId}:${created!.due_at}:call the repair shop`,
  });
  assert.equal(second.status, 'completed');
  assert.equal(second.duplicate === true || second.canonicalObjectId === created!.id, true, 'duplicate submission must not create a new domain object');
  const after = await listReminders(phone);
  const sameTitle = after.filter((r) => r.title === 'call the repair shop' && r.status === 'scheduled');
  assert.ok(sameTitle.length >= 1, 'at least the original reminder remains');
  assert.ok(second.canonicalObjectId === created!.id || second.duplicate, 'idempotent path preserves object id');

  // Re-read goal remains completed
  const finalGoal = await getAgentGoal(phone, goal!.id);
  assert.equal(finalGoal?.status, 'completed');

  console.log('reminder AOM contract passed:', {
    reminderId: created!.id,
    sourceConversationId: created!.source_conversation_id,
    goalId: goal!.id,
    goalStatus: goal!.status,
    events: events.map((e) => e.action),
    beforeCount,
    afterCount: after.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
