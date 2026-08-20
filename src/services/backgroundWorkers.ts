/** Lightweight in-process workers for single-instance launch. Shared durable job leases are available for scale transition. */
import { runOrchestrationPass } from './tradeEngine.js';
import { expireDeferredIntentions, getDueIntentions, incrementAttempt, resolveOpenIntention, markPartiallyMatched } from './deferredRequestService.js';
import { ensureLivingMemorySchema, runDailyMemoryDecay, runWeeklyMemoryPrune, runMemoryCrystallize } from './livingMemoryEngine.js';
import { processDueReminders } from './reminderService.js';
import { processExpiredCheckIns } from './safetyService.js';
import { purgeExpiredData } from '../database.js';
import { find_worker } from './find-worker.js';
import { sendFcmPush } from './pushNotifications.js';
import { drainFcmQueue } from './pushNotificationsCanonical.js';
import { getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';
import { ensureTrustScoreSchema, recalculateAllTrustScores } from './trustScore.js';
import { releaseExpiredDurableJobLeases } from './durableJobQueue.js';
import { expireProviderVerifications } from './providerVerificationLifecycle.js';
import { purgeOldWebhookEvents } from './channelWebhookDeduplication.js';
import { processDiscoverWatches } from './discoverExperience.js';

let started = false;
const timers: NodeJS.Timeout[] = [];
async function safe(label: string, fn: () => Promise<unknown>): Promise<void> { try { await fn(); } catch (e) { console.error(`[Worker:${label}]`, e); } }

type DeferredEconomicProgress = 'quoted' | 'matched_without_quote' | 'not_linked' | 'not_eligible';
async function progressLinkedEconomicRequest(economicRequestId: string | null | undefined, provider: { phone: string; name: string; rating: number; hourly_rate: number }): Promise<DeferredEconomicProgress> {
  if (!economicRequestId) return 'not_linked';
  const req = await getEconomicRequest(String(economicRequestId));
  if (!req || !['requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting'].includes(req.status)) return 'not_eligible';
  try {
    let currentStatus = req.status;
    if (currentStatus === 'requested') { await transitionEconomicRequest(req.id, 'awaiting_match', { providerPhone: provider.phone }); currentStatus = 'awaiting_match'; }
    if (['awaiting_match', 'partially_matched'].includes(currentStatus)) { await transitionEconomicRequest(req.id, 'matched', { providerPhone: provider.phone }); currentStatus = 'matched'; }
    const amountMinor = Math.round(Number(provider.hourly_rate));
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) return 'matched_without_quote';
    await transitionEconomicRequest(req.id, 'quoting');
    await transitionEconomicRequest(req.id, 'quoted', { providerPhone: provider.phone, quote: { amount_minor: amountMinor, currency: 'NGN', provider_name: provider.name, rating: provider.rating } });
    return 'quoted';
  } catch (e) { console.warn('[Worker:deferred] progressLinkedEconomicRequest failed:', e); return 'not_eligible'; }
}
let deferredPassActive = false;
export async function processDueDeferred(): Promise<{ checked: number; matched: number; notified: number; quoted: number }> {
  if (deferredPassActive) return { checked: 0, matched: 0, notified: 0, quoted: 0 };
  deferredPassActive = true;
  try {
    const due = await getDueIntentions(50); let matched = 0; let notified = 0; let quoted = 0;
    for (const intention of due) {
      const phone = String(intention.phone || ''); const skill = String(intention.skill || intention.intent || '').trim();
      if (!phone || !skill) { await incrementAttempt(phone || 'unknown', intention.id); continue; }
      const match = await find_worker({ skill, location: intention.location ? String(intention.location) : undefined, max: 3, ownerPhone: phone });
      if (match.count > 0) {
        matched += 1; const top = match.providers[0]; const note = `Matched ${top.name} (${Number(top.rating || 0).toFixed(1)}★) on deferred re-check`;
        const progress = await progressLinkedEconomicRequest(intention.economic_request_id ? String(intention.economic_request_id) : null, top);
        if (progress === 'quoted') quoted += 1;
        if (progress === 'matched_without_quote') await markPartiallyMatched(phone, intention.id, `${note}. A final provider quote is still required before any payment step.`);
        else await resolveOpenIntention(phone, intention.id, 'provider_matched', note, `Open chat and continue with ${skill}`).catch(async () => { await markPartiallyMatched(phone, intention.id, note).catch(() => null); });
        const requestId = intention.economic_request_id ? String(intention.economic_request_id) : '';
        const chatLink = `/chat?requestId=${encodeURIComponent(requestId || String(intention.id))}&prompt=${encodeURIComponent(`Continue with my ${skill} request`)}`;
        const pushed = await sendFcmPush(phone, 'Kurukoo found a match', `A provider is available for "${skill}". Open Chat to review the next supported step.`, chatLink, { contextId: `request:${requestId || intention.id}`, conversationId: undefined, availableAction: 'review', canonicalAction: 'economic_request.review_match', objectType: 'economic_request', objectId: requestId || String(intention.id), ownerScope: phone, idempotencyKey: `deferred-match:${intention.id}:${requestId || 'open'}:${skill}`, surface: 'chat' }).catch(() => false);
        if (pushed) notified += 1;
      } else await incrementAttempt(phone, intention.id);
    }
    return { checked: due.length, matched, notified, quoted };
  } finally { deferredPassActive = false; }
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
  const fcmMs = process.env.KURUKOO_FCM_DRAIN_INTERVAL_SEC ? Math.max(15_000, Number(process.env.KURUKOO_FCM_DRAIN_INTERVAL_SEC) * 1000) : 30_000;
  const providerVerificationMs = process.env.KURUKOO_PROVIDER_VERIFICATION_INTERVAL_SEC ? Math.max(300_000, Number(process.env.KURUKOO_PROVIDER_VERIFICATION_INTERVAL_SEC) * 1000) : 24 * 60 * 60 * 1000;
  const leaseMs = process.env.KURUKOO_JOB_LEASE_SWEEP_INTERVAL_SEC ? Math.max(30_000, Number(process.env.KURUKOO_JOB_LEASE_SWEEP_INTERVAL_SEC) * 1000) : 60_000;
  const webhookPurgeMs = process.env.KURUKOO_WEBHOOK_DEDUP_PURGE_INTERVAL_SEC ? Math.max(300_000, Number(process.env.KURUKOO_WEBHOOK_DEDUP_PURGE_INTERVAL_SEC) * 1000) : 24 * 60 * 60 * 1000;
  const discoverWatchMs = process.env.KURUKOO_DISCOVER_WATCH_INTERVAL_SEC ? Math.max(60_000, Number(process.env.KURUKOO_DISCOVER_WATCH_INTERVAL_SEC) * 1000) : 5 * 60 * 1000;

  timers.push(setInterval(() => { void safe('orchestration', async () => { const result = await runOrchestrationPass(); if (result.matched || result.quoted || result.released) console.log(`[Worker:orchestration] matched=${result.matched} quoted=${result.quoted} released=${result.released} failed=${result.failed}`); }); }, orchMs));
  timers.push(setInterval(() => { void safe('deferred', async () => { const r = await processDueDeferred(); await expireDeferredIntentions(); if (r.checked || r.matched) console.log(`[Worker:deferred] checked=${r.checked} matched=${r.matched} notified=${r.notified} quoted=${r.quoted}`); }); }, deferredMs));
  timers.push(setInterval(() => { void safe('reminders', async () => { const r = await processDueReminders(100); if (r.checked) console.log(`[Worker:reminders] checked=${r.checked} delivered=${r.delivered} queued=${r.queued}`); }); }, reminderMs));
  timers.push(setInterval(() => { void safe('safety', async () => { const count = await processExpiredCheckIns(); if (count) console.warn(`[Worker:safety] ${count} check-in(s) require escalation review`); }); }, safetyMs));
  timers.push(setInterval(() => { void safe('memory', async () => { await ensureLivingMemorySchema(); const decay = await runDailyMemoryDecay(); const prune = await runWeeklyMemoryPrune(); const crystallize = await runMemoryCrystallize(); console.log(`[Worker:memory] decay=${decay.updated} prune=${prune.deleted} crystallize=${crystallize.promoted}`); }); }, memoryMs));
  timers.push(setInterval(() => { void safe('purge', async () => { const r = await purgeExpiredData(); console.log(`[Worker:purge] messages=${r.messagesDeleted} sessions=${r.tempSessionsDeleted} pulse=${r.pulseLocationsDeleted}`); }); }, purgeMs));
  timers.push(setInterval(() => { void safe('trust-score', async () => { await ensureTrustScoreSchema(); const updated = await recalculateAllTrustScores(); if (updated) console.log(`[Worker:trust-score] recalculated=${updated}`); }); }, trustMs));
  timers.push(setInterval(() => { void safe('fcm-drain', async () => { const result = await drainFcmQueue(50); if (result.sent || result.retried || result.invalidTokens) console.log(`[Worker:fcm] sent=${result.sent} retried=${result.retried} invalidTokens=${result.invalidTokens}`); }); }, fcmMs));
  timers.push(setInterval(() => { void safe('provider-verification-expiry', async () => { const expired = await expireProviderVerifications(); if (expired) console.log(`[Worker:provider-verification] expired=${expired}`); }); }, providerVerificationMs));
  timers.push(setInterval(() => { void safe('durable-job-leases', async () => { const released = await releaseExpiredDurableJobLeases(); if (released) console.log(`[Worker:durable-jobs] releasedExpiredLeases=${released}`); }); }, leaseMs));
  timers.push(setInterval(() => { void safe('webhook-dedup-purge', async () => { const deleted = await purgeOldWebhookEvents(30); if (deleted) console.log(`[Worker:webhook-dedup] deleted=${deleted}`); }); }, webhookPurgeMs));
  timers.push(setInterval(() => { void safe('discover-watches', async () => { const result = await processDiscoverWatches(100); if (result.changed) console.log(`[Worker:discover-watches] checked=${result.checked} changed=${result.changed} notified=${result.notified}`); }); }, discoverWatchMs));
  for (const t of timers) t.unref?.();
  setTimeout(() => {
    void safe('orchestration:boot', () => runOrchestrationPass());
    void safe('memory:boot', async () => { await ensureLivingMemorySchema(); });
    void safe('reminders:boot', async () => { await processDueReminders(100); });
    void safe('safety:boot', async () => { await processExpiredCheckIns(); });
    void safe('trust-score:boot', async () => { await ensureTrustScoreSchema(); await recalculateAllTrustScores(); });
    void safe('fcm:boot', async () => { await drainFcmQueue(50); });
    void safe('provider-verification:boot', async () => { await expireProviderVerifications(); });
    void safe('durable-job-leases:boot', async () => { await releaseExpiredDurableJobLeases(); });
    void safe('webhook-dedup:boot', async () => { await purgeOldWebhookEvents(30); });
    void safe('discover-watches:boot', async () => { await processDiscoverWatches(100); });
  }, 15_000).unref?.();
  console.log(`[Workers] Started orchestration=${Math.round(orchMs / 1000)}s deferred=${Math.round(deferredMs / 1000)}s reminders=${Math.round(reminderMs / 1000)}s safety=${Math.round(safetyMs / 1000)}s memory=${Math.round(memoryMs / 1000)}s purge=${Math.round(purgeMs / 1000)}s trust=${Math.round(trustMs / 1000)}s fcm=${Math.round(fcmMs / 1000)}s providerVerification=${Math.round(providerVerificationMs / 1000)}s durableJobLeases=${Math.round(leaseMs / 1000)}s webhookDedup=${Math.round(webhookPurgeMs / 1000)}s discoverWatches=${Math.round(discoverWatchMs / 1000)}s`);
}
export function stopBackgroundWorkers(): void { for (const t of timers) clearInterval(t); timers.length = 0; started = false; }