import { getDb, saveDb } from '../database.js';

/** Move guest-owned conversational state to the verified phone exactly once. */
export async function migrateGuestSessionToAccount(guestPhone: string, userPhone: string): Promise<void> {
  const guest = String(guestPhone || '').trim();
  const user = String(userPhone || '').trim();
  if (!guest.startsWith('anon_') || !user) return;

  const db = await getDb();
  const tableRows = db.exec(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tables = new Set((tableRows[0]?.values || []).map((row: unknown[]) => String(row[0])));
  if (tables.has('chat_conversations')) db.run('UPDATE chat_conversations SET phone=? WHERE phone=?', [user, guest]);
  if (tables.has('messages')) db.run('UPDATE messages SET phone=? WHERE phone=?', [user, guest]);
  // These systems are still canonical when present, but migration must not
  // require them for a QR-originated chat that has not created an Economic Request.
  if (tables.has('economic_requests')) db.run('UPDATE economic_requests SET phone=? WHERE phone=?', [user, guest]);
  if (tables.has('orders')) db.run('UPDATE orders SET phone=? WHERE phone=?', [user, guest]);

  const profileStatement = db.prepare('SELECT preferences FROM memory_profiles WHERE phone=?');
  profileStatement.bind([user]);
  let preferences: Record<string, unknown> = {};
  if (profileStatement.step()) {
    const profile = profileStatement.getAsObject() as { preferences?: string };
    try { preferences = profile.preferences ? JSON.parse(profile.preferences) : {}; } catch { preferences = {}; }
  }
  profileStatement.free();
  preferences.onboarding_complete = true;
  preferences.onboarding_step = 'done';
  db.run('UPDATE memory_profiles SET preferences=?, updated_at=CURRENT_TIMESTAMP WHERE phone=?', [JSON.stringify(preferences), user]);
  saveDb();
}
