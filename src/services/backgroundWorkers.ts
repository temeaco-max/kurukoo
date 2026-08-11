/**
 * Lightweight in-process workers for single-instance launch.
 * Disable with KURUKOO_WORKERS=0. Intervals are env-tunable.
 */
import { runOrchestrationPass } from './tradeEngine.js';
import {
  expireDeferredIntentions,
  getDueIntentions,
  incrementAttempt,
  resolveOpenIntention,
  markPartiallyMatched,
} from './deferredRequestService.js';
import {
  ensureLivingMemorySchema,
  runDailyMemoryDecay,
  runWeeklyMemoryPrune,
  runMemoryCrystallize,
} from './livingMemoryEngine.js';
import { purgeExpiredData } from '../database.js';
import { find_worker } from './find-worker.js';
import { sendFcmPush } from './pushNotifications.js';
import { getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';

let started = false;
const timers: NodeJS.Timeout[] = [];

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[Worker:${label}]`, e);
  }
}

/** Advance linked economic_request to quoted so storefront resume shows the match. */
type DeferredEconomicProgress = 'quoted' | 'matched_without_quote' | 'not_linked' | 'not_eligible';

async function progressLinkedEconomicRequest(
  economicRequestId: string | null | undefined,
  provider: { phone: string; name: string; rating: number; hourly_rate: number }
): Promise<DeferredEconomicProgress> {
  if (!economicRequestId) return 'not_linked';
  const req = await getEconomicRequest(String(economicRequestId));
  if (!req || !['requested', 'awaiting_match', 'partially_matched', 'matched', 'quoting'].includes(req.status)) {
    return 'not_eligible';
  }
  try {
    if (req.status === 'requested' || req.status === 'awaiting_match' || req.status === 'partially_matched') {
      await transitionEconomicRequest(req.id, 'matched', { providerPhone: provider.phone });
    }

    const amountMinor = Math.round(Number(provider.hourly_rate));
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      return 'matched_without_quote';
    }

    await transitionEconomicRequest(req.id, 'quoting');
    await transitionEconomicRequest(req.id, 'quoted', {
      providerPhone: provider.phone,
      quote: {
        amount_minor: amountMinor,
        currency: 'NGN',
        provider_name: provider.name,
        rating: provider.rating,
      },
    });
    return 'quoted';
  } catch (e) {
    console.warn('[Worker:deferred] progressLinkedEconomicRequest failed:', e);
    return 'not_eligible';
  }
}

/**
 * Re-check deferred open intentions that are due (Blueprint §4.1.3).
 * On match: resolve intention, quote linked economic_request, notify via FCM.
 */
export async function processDueDeferred(): Promise<{ checked: number; matched: number; notified: number; quoted: number }> {
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

    const match = await find_worker({
      skill,
      location: intention.location ? String(intention.location) : undefined,
      max: 3,
    });

    if (match.count > 0) {
      matched += 1;
      const top = match.providers[0];
      const note = `Matched ${top.name} (${Number(top.rating || 0).toFixed(1)}★) on deferred re-check`;

      const linkedId = intention.economic_request_id
        ? String(intention.economic_request_id)
        : null;
      const progress = await progressLinkedEconomicRequest(linkedId, top);
      if (progress === 'quoted') quoted += 1;

      if (progress === 'matched_without_quote') {
        await markPartiallyMatched(
          phone,
          intention.id,
          `${note}. A final provider quote is still required before any payment step.`
        );
      } else {
        await resolveOpenIntention(
          phone,
          intention.id,
          'provider_matched',
          note,
          `Open chat and continue with ${skill}`
        ).catch(async () => {
          await markPartiallyMatched(phone, intention.id, note).catch(() => null);
        });
      }

      const pushed = await sendFcmPush(
        phone,
        'Kurukoo found a match',
        `A provider is available for “${skill}”. Open the app and say “continue” to review the quote.`,
        undefined
      ).catch(() => false);
      if (pushed) notified += 1;
    } else {
      await incrementAttempt(phone, intention.id);
    }
  }

  return { checked: due.length, matched, notified, quoted };
}

export function startBackgroundWorkers(): void {
  if (started) return;
  if (process.env.KURUKOO_WORKERS === '0' || process.env.KURUKOO_WORKERS === 'false') {
    console.log('[Workers] Disabled via KURUKOO_WORKERS');
    return;
  }
  started = true;

  const orchMs = process.env.KURUKOO_ORCHESTRATION_INTERVAL_SEC
    ? Math.max(30_000, Number(process.env.KURUKOO_ORCHESTRATION_INTERVAL_SEC) * 1000)
    : 5 * 60 * 1000;
  const deferredMs = process.env.KURUKOO_DEFERRED_INTERVAL_SEC
    ? Math.max(60_000, Number(process.env.KURUKOO_DEFERRED_INTERVAL_SEC) * 1000)
    : 2 * 60 * 60 * 1000; // 2h
  const memoryMs = process.env.KURUKOO_MEMORY_INTERVAL_SEC
    ? Math.max(300_000, Number(process.env.KURUKOO_MEMORY_INTERVAL_SEC) * 1000)
    : 24 * 60 * 60 * 1000; // daily
  const purgeMs = process.env.KURUKOO_PURGE_INTERVAL_SEC
    ? Math.max(300_000, Number(process.env.KURUKOO_PURGE_INTERVAL_SEC) * 1000)
    : 24 * 60 * 60 * 1000;

  timers.push(
    setInterval(() => {
      void safe('orchestration', async () => {
        const result = await runOrchestrationPass();
        if (result.matched || result.quoted || result.released) {
          console.log(
            `[Worker:orchestration] matched=${result.matched} quoted=${result.quoted} released=${result.released} failed=${result.failed}`
          );
        }
      });
    }, orchMs)
  );

  timers.push(
    setInterval(() => {
      void safe('deferred', async () => {
        const r = await processDueDeferred();
        await expireDeferredIntentions();
        if (r.checked || r.matched) {
          console.log(
            `[Worker:deferred] checked=${r.checked} matched=${r.matched} notified=${r.notified} quoted=${r.quoted}`
          );
        }
      });
    }, deferredMs)
  );

  timers.push(
    setInterval(() => {
      void safe('memory', async () => {
        await ensureLivingMemorySchema();
        const decay = await runDailyMemoryDecay();
        const prune = await runWeeklyMemoryPrune();
        const crystallize = await runMemoryCrystallize();
        console.log(
          `[Worker:memory] decay=${decay.updated} prune=${prune.deleted} crystallize=${crystallize.promoted}`
        );
      });
    }, memoryMs)
  );

  timers.push(
    setInterval(() => {
      void safe('purge', async () => {
        const r = await purgeExpiredData();
        console.log(
          `[Worker:purge] messages=${r.messagesDeleted} sessions=${r.tempSessionsDeleted} pulse=${r.pulseLocationsDeleted}`
        );
      });
    }, purgeMs)
  );

  for (const t of timers) t.unref?.();

  setTimeout(() => {
    void safe('orchestration:boot', () => runOrchestrationPass());
    void safe('memory:boot', async () => {
      await ensureLivingMemorySchema();
    });
  }, 15_000).unref?.();

  console.log(
    `[Workers] Started orchestration=${Math.round(orchMs / 1000)}s deferred=${Math.round(deferredMs / 1000)}s memory=${Math.round(memoryMs / 1000)}s purge=${Math.round(purgeMs / 1000)}s`
  );
}

export function stopBackgroundWorkers(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  started = false;
}
