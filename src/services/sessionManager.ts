import { getCanonicalStore } from './canonicalStore.js';

/**
 * Record conversation activity against the canonical memory profile store.
 * External channel session state remains owned by its channel boundary.
 */
export async function updateSessionInteraction(phone: string): Promise<void> {
  if (!phone) return;
  try {
    const store = await getCanonicalStore();
    const nowIso = new Date().toISOString();
    const row = await store.one<any>('SELECT preferences FROM memory_profiles WHERE phone = ? LIMIT 1', [phone]);
    let preferences: Record<string, unknown> = {};
    if (row?.preferences) {
      try {
        const parsed = JSON.parse(String(row.preferences));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) preferences = parsed;
      } catch {
        preferences = {};
      }
    }
    preferences.last_interaction_at = nowIso;
    await store.run(
      'UPDATE memory_profiles SET last_active_at = ?, preferences = ? WHERE phone = ?',
      [nowIso, JSON.stringify(preferences), phone],
    );
  } catch (err) {
    console.error('[SessionManager] Failed to record conversation activity:', err);
  }
}

/** Compatibility boundary for older callers. */
export async function checkAndTriggerKeepAlives(): Promise<void> {
  return;
}

/** External-channel session scheduler is intentionally disabled. */
export function startSessionManagerScheduler(_intervalMs: number = 60_000): void {
  console.info('[SessionManager] External-channel session scheduler is disabled; use the internal notification queue when configured.');
}

export function stopSessionManagerScheduler(): void {
  return;
}
