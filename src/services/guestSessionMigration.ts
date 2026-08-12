import { getDb, saveDb } from '../database.js';

/** Move guest-owned conversational state to the verified phone exactly once. */
export async function migrateGuestSessionToAccount(guestPhone: string, userPhone: string): Promise<void> {
  const guest = String(guestPhone || '').trim();
  const user = String(userPhone || '').trim();
  if (!guest.startsWith('anon_') || !user) return;

  const db = await getDb();
  db.run('UPDATE chat_conversations SET phone=? WHERE phone=?', [user, guest]);
  db.run('UPDATE messages SET phone=? WHERE phone=?', [user, guest]);
  db.run('UPDATE economic_requests SET phone=? WHERE phone=?', [user, guest]);
  db.run('UPDATE orders SET phone=? WHERE phone=?', [user, guest]);

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
