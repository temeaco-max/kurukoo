import { getDb, saveDb } from '../database.js';
import { getProfile, updateProfile } from './memoryProfile.js';
import { ensureCanonicalFulfilmentSchema } from './canonicalFulfilmentService.js';
import { getCanonicalStore } from './canonicalStore.js';

/** Move guest-owned conversational state to the verified phone exactly once. */
export async function migrateGuestSessionToAccount(guestPhone: string, userPhone: string): Promise<void> {
  const guest = String(guestPhone || '').trim();
  const user = String(userPhone || '').trim();
  // Guest anon_* and provisional email em_* subjects may merge into a proven phone only.
  if ((!guest.startsWith('anon_') && !guest.startsWith('em_')) || !user || guest === user) return;
  if (user.startsWith('em_') || user.startsWith('anon_')) return; // never migrate onto a provisional/guest target

  const db = await getDb();
  const tableRows = db.exec(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tables = new Set((tableRows[0]?.values || []).map((row: unknown[]) => String(row[0])));
  if (tables.has('chat_conversations')) db.run('UPDATE chat_conversations SET phone=? WHERE phone=?', [user, guest]);
  if (tables.has('messages')) db.run('UPDATE messages SET phone=? WHERE phone=?', [user, guest]);
  // These systems are still canonical when present, but migration must not
  // require them for a QR-originated chat that has not created an Economic Request.
  if (tables.has('economic_requests')) db.run('UPDATE economic_requests SET phone=? WHERE phone=?', [user, guest]);
  if (tables.has('orders')) db.run('UPDATE orders SET phone=? WHERE phone=?', [user, guest]);

  // Fulfilment is a canonical projection of the same request, so its owner
  // must migrate with the request before the authenticated continuation resumes.
  await ensureCanonicalFulfilmentSchema();
  const canonicalStore = await getCanonicalStore();
  await canonicalStore.run('UPDATE fulfilments SET owner_phone=? WHERE owner_phone=?', [user, guest]);
  await canonicalStore.run('UPDATE fulfilment_offers SET owner_phone=? WHERE owner_phone=?', [user, guest]);
  await canonicalStore.run('UPDATE provider_inquiries SET owner_phone=? WHERE owner_phone=?', [user, guest]);

  // Memory Profile owns encrypted preference encoding. Reuse it here so a
  // guest-to-account migration preserves existing account preferences rather
  // than attempting to parse ciphertext and overwriting the profile on failure.
  const profile = await getProfile(user, 'guest_session_migration');
  await updateProfile(user, 'guest_session_migration', {
    preferences: {
      ...(profile?.preferences || {}),
      onboarding_complete: true,
      onboarding_step: 'done',
    },
  });
  saveDb();
}
