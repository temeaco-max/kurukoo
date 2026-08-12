import { getDb, saveDb } from '../database.js';

/**
 * Record conversation activity without claiming an external messaging session.
 * External WhatsApp, FCM, SMS, and USSD adapters are intentionally not managed
 * by this service while they are unconfigured.
 */
export async function updateSessionInteraction(phone: string): Promise<void> {
  if (!phone) return;
  try {
    const db = await getDb();
    const result = db.exec('SELECT preferences FROM memory_profiles WHERE phone = ?', [phone]);
    const row = result[0]?.values?.[0];
    let preferences: Record<string, unknown> = {};
    if (row?.[0]) {
      try {
        const parsed = JSON.parse(String(row[0]));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) preferences = parsed;
      } catch {
        preferences = {};
      }
    }
    const nowIso = new Date().toISOString();
    preferences.last_interaction_at = nowIso;
    db.run('UPDATE memory_profiles SET last_active_at = ?, preferences = ? WHERE phone = ?', [nowIso, JSON.stringify(preferences), phone]);
    saveDb();
  } catch (err) {
    console.error('[SessionManager] Failed to record conversation activity:', err);
  }
}

/**
 * Compatibility boundary for older callers. No polling, external push, deep
 * link generation, session reset, or channel fee analytics occurs here.
 */
export async function checkAndTriggerKeepAlives(): Promise<void> {
  return;
}

/**
 * Kept as a no-op compatibility export so legacy composition code cannot
 * accidentally start an unsupported external-channel scheduler.
 */
export function startSessionManagerScheduler(_intervalMs: number = 60_000): void {
  console.info('[SessionManager] External-channel session scheduler is disabled; use the internal notification queue when configured.');
}

export function stopSessionManagerScheduler(): void {
  return;
}
