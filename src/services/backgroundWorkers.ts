/** Lightweight in-process workers for single-instance launch. */
import { runOrchestrationPass } from './tradeEngine.js';
import {
  expireDeferredIntentions,
  getDueIntentions,
  incrementAttempt,
  markPartiallyMatched,
} from './deferredRequestService.js';
import {
  ensureLivingMemorySchema,
  runDailyMemoryDecay,
  runWeeklyMemoryPrune,
  runMemoryCrystallize,
} from './livingMemoryEngine.js';
import { processDueReminders } from './reminderService.js';
import { processExpiredCheckIns } from './safetyService.js';
import { purgeExpiredData } from '../database.js';
import { inviteEligibleProviders } from './providerCoordination.js';
import { getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';
import { ensureTrustScoreSchema, recalculateAllTrustScores } from './trustScore.js';
import { dispatchDueCommunicationOutbox } from './communicationOutbox.js';
import { expireDueProviderVerifications } from './providerVerification.js';
import { notifyGoalIfNeeded, reenterDueDeferredGoals, runDueAgentGoals } from './agentRuntime.js';

let started = false;
const timers: NodeJS.Timeout[] = [];
const activeTasks = new Set<string>();

/** Prevent a slow interval or bootstrap pass from overlapping the same canonical job. */
async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  if (activeTasks.has(label)) return;
  activeTasks.add(label);
  try {
    await fn();
  } catch (e) {
    console.error(`[Worker:${label}]`, e);
  } finally {
    activeTasks.delete(label);
  }
}

let deferredPassActive = false;

export async function processDueDeferred(): Promise<{ checked: number; matched: number; notified: number; quoted: number }> {
  if (deferredPassActive) return { checked: 0, matched: 0, notified: 0, quoted: 0 };
  deferredPassActive = true;
  try {
    const due = await getDueIntentions(50);
    let matched = 0;
    let notified = 0;
    let quoted = 0;
    for (const intention of due) {
      const phone = String(intention.phone || '');
      const skill = String(intention.skill || intention.intent || '').trim();
      if (!phone || !skill) {
        await incrementAttempt(phone || 'unknown', intention.id);
        continue;
      }
      const requestId = intention.economic_request_id ? String(intention.economic_request_id) : '';
      if (!requestId) {
        await incrementAttempt(phone, intention.id);
        continue;
      }
      try {
        const coordination = await inviteEligibleProviders({ requestId, ownerPhone: phone, max: 3 });
        if (coordination.invitations.length > 0) {
          const request = await getEconomicRequest(requestId);
          if (request && ['requested', 'awaiting_match', 'partially_matched'].includes(request.status)) {
            await transitionEconomicRequest(requestId, 'matched', { providerPhone: coordination.invitations[0].providerPhone });
          }
          matched += coordination.invitations.length;
          await markPartiallyMatched(phone, intention.id, 'Eligible providers were invited to review your request. Provider acceptance and a provider-owned quote are still required.');
          notified += 1;
        } else {
          await incrementAttempt(phone, intention.id);
        }
      } catch (error) {
        console.warn('[Worker:deferred] provider invitation re-check failed:', error);
        await incrementAttempt(phone, intention.id);
      }
    }
    return { checked: due.length, matched, notified, quoted };
  } finally {
    deferredPassActive = false;
  }
}

export function startBackgroundWorkers(): void {
  if (started) return;
  if (process.env.KURUKOO_WORKERS === '0' || process.env.KURUKOO_WORKERS === 'false') { console.log('[Workers] Disabled via KURUKOO_WORKERS'); return; }
  started = true;

  const orchMs = process.env.KURUKOO_ORCHESTRATION_INTERVAL_SEC ? Math.max(30_000, Number(process.env.KURUKOO_ORCHESTRATION_INTERVAL_SEC) * 1000) : 5 * 60 * 1000;
  const deferredMs = process.env.KURUKOO_DEFERRED_INTERVAL_SEC ? Math.max(60_000, Number(process.env.KURUKOO_DEFERRED_INTERVAL_SEC) * 1000) : 2 * 60 * 60 * 1000;
  const reminderMs = process.env.KURUKOO_REMINDER_INTERVAL_SEC ? Math.max(30_000, Number(process.env.KURUKOO_REMINDER_INTERVAL_SEC) * 1000) : 60 * 1000;
  const safetyMs = process.env.KURUKOO_SAFETY_INTERVAL_SEC ? Math.max(30_000, Number(process.env.KURUKOO_SAFETY_INTERVAL_SEC) * 1000) : 60 * 1000;
  const memoryMs = process.env.KURUKOO_MEMORY_INTERVAL_SEC ? Math.max(300_000, Number(process.env.KURUKOO_MEMORY_INTERVAL_SEC) * 1000) : 24 * 60 * 60 * 1000;
  const purgeMs = process.env.KURUKOO_PURGE_INTERVAL_SEC ? Math.max(300_000, Number(process.env.KURUKOO_PURGE_INTERVAL_SEC) * 1000) : 24 * 60 * 60 * 1000;
  const trustMs = process.env.KURUKOO_TRUST_SCORE_INTERVAL_SEC ? Math.max(300_000, Number(process.env.KURUKOO_TRUST_SCORE_INTERVAL_SEC) * 1000) : 24 * 60 * 60 * 1000;
  const outboxMs = Math.max(10_000, Math.min(5 * 60_000, Number(process.env.KURUKOO_COMMUNICATION_OUTBOX_INTERVAL_MS || 30_000)));
  const verificationMs = Math.max(60_000, Math.min(24 * 60 * 60 * 1000, Number(process.env.KURUKOO_PROVIDER_VERIFICATION_INTERVAL_MS || 24 * 60 * 60 * 1000)));
  const agentMs = Math.max(30_000, Math.min(15 * 60_000, Number(process.env.KURUKOO_AGENT_WORKER_INTERVAL_MS || 60_000)));

  timers.push(setInterval(() => {
    void safe('orchestration', async () => {
      const result = await runOrchestrationPass();
      if (result.matched || result.quoted || result.released) console.log(`[Worker:orchestration] matched=${result.matched} quoted=${result.quoted} released=${result.released} failed=${result.failed}`);
    });
  }, orchMs));

  timers.push(setInterval(() => {
    void safe('deferred', async () => {
      const r = await processDueDeferred();
      await expireDeferredIntentions();
      if (r.checked || r.matched) console.log(`[Worker:deferred] checked=${r.checked} matched=${r.matched} notified=${r.notified} quoted=${r.quoted}`);
    });
  }, deferredMs));

  timers.push(setInterval(() => {
    void safe('reminders', async () => {
      const r = await processDueReminders(100);
      if (r.checked) console.log(`[Worker:reminders] checked=${r.checked} delivered=${r.delivered} queued=${r.queued}`);
    });
  }, reminderMs));

  timers.push(setInterval(() => {
    void safe('safety', async () => {
      const count = await processExpiredCheckIns();
      if (count) console.warn(`[Worker:safety] ${count} check-in(s) require escalation review`);
    });
  }, safetyMs));

  timers.push(setInterval(() => {
    void safe('memory', async () => {
      await ensureLivingMemorySchema();
      const decay = await runDailyMemoryDecay();
      const prune = await runWeeklyMemoryPrune();
      const crystallize = await runMemoryCrystallize();
      console.log(`[Worker:memory] decay=${decay.updated} prune=${prune.deleted} crystallize=${crystallize.promoted}`);
    });
  }, memoryMs));

  timers.push(setInterval(() => {
    void safe('purge', async () => {
      const r = await purgeExpiredData();
      console.log(`[Worker:purge] messages=${r.messagesDeleted} sessions=${r.tempSessionsDeleted} pulse=${r.pulseLocationsDeleted}`);
    });
  }, purgeMs));

  timers.push(setInterval(() => {
    void safe('trust-score', async () => {
      await ensureTrustScoreSchema();
      const updated = await recalculateAllTrustScores();
      if (updated) console.log(`[Worker:trust-score] recalculated=${updated}`);
    });
  }, trustMs));

  timers.push(setInterval(() => {
    void safe('communication-outbox', async () => { await dispatchDueCommunicationOutbox(); });
  }, outboxMs));

  timers.push(setInterval(() => {
    void safe('provider-verification', async () => { await expireDueProviderVerifications(); });
  }, verificationMs));

  if (process.env.KURUKOO_AGENT_ENABLED === 'true') {
    const runAgentFollowUp = async () => {
      const updates = [...await runDueAgentGoals(), ...await reenterDueDeferredGoals()];
      for (const goal of updates) await notifyGoalIfNeeded(goal);
    };
    timers.push(setInterval(() => { void safe('agent-follow-up', runAgentFollowUp); }, agentMs));
    setTimeout(() => { void safe('agent-follow-up:boot', runAgentFollowUp); }, 5_000).unref?.();
  }

  for (const t of timers) t.unref?.();

  setTimeout(() => {
    void safe('orchestration:boot', () => runOrchestrationPass());
    void safe('memory:boot', async () => { await ensureLivingMemorySchema(); });
    void safe('reminders:boot', async () => { await processDueReminders(100); });
    void safe('safety:boot', async () => { await processExpiredCheckIns(); });
    void safe('trust-score:boot', async () => { await ensureTrustScoreSchema(); await recalculateAllTrustScores(); });
    void safe('communication-outbox:boot', async () => { await dispatchDueCommunicationOutbox(); });
    void safe('provider-verification:boot', async () => { await expireDueProviderVerifications(); });
  }, 15_000).unref?.();

  console.log(`[Workers] Started orchestration=${Math.round(orchMs / 1000)}s deferred=${Math.round(deferredMs / 1000)}s reminders=${Math.round(reminderMs / 1000)}s safety=${Math.round(safetyMs / 1000)}s memory=${Math.round(memoryMs / 1000)}s purge=${Math.round(purgeMs / 1000)}s trust=${Math.round(trustMs / 1000)}s outbox=${Math.round(outboxMs / 1000)}s`);
}

export function stopBackgroundWorkers(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  activeTasks.clear();
  started = false;
}
