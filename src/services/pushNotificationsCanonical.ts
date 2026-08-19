import {
  getInternalNotificationById as getLegacyInternalNotificationById,
  markNotificationRead as markLegacyNotificationRead,
  listQueuedNotifications,
  transitionNotificationDelivery,
  recordNotificationAttempt,
  isFcmConfigured,
} from './pushNotifications.js';
import { getProfile } from './memoryProfile.js';
import { sendFirebaseFcmMessage } from './firebaseCloudMessaging.js';
import { getDb, saveDb } from '../database.js';

export async function getInternalNotificationById(notificationId: number, phone: string) {
  return getLegacyInternalNotificationById(phone, notificationId);
}

export async function markNotificationRead(notificationId: number, phone: string): Promise<boolean> {
  return markLegacyNotificationRead(phone, notificationId);
}

async function sendSingleFcmMessage(phone: string, title: string, body: string, link?: string): Promise<{ accepted: boolean; providerReference?: string; failureReason?: string }> {
  const profile = await getProfile(phone, 'pushNotifications.fcmCanonical').catch(() => null) as any;
  const token = profile?.fcm_token ? String(profile.fcm_token).trim() : '';
  if (!token) return { accepted: false, failureReason: 'device_token_missing' };
  const result = await sendFirebaseFcmMessage({ token, title, body, link });
  return {
    accepted: Boolean((result as any).accepted),
    providerReference: (result as any).providerReference,
    failureReason: (result as any).failureReason,
  };
}

async function invalidateStoredFcmToken(phone: string): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE memory_profiles SET fcm_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`, [phone]);
  if (db.getRowsModified() > 0) saveDb();
}

export async function drainFcmQueue(limit = 50): Promise<{ sent: number; retried: number; none: number; invalidTokens: number }> {
  const outcome = { sent: 0, retried: 0, none: 0, invalidTokens: 0 };
  if (!isFcmConfigured()) return outcome;
  const rows = await listQueuedNotifications(Math.max(1, Math.min(100, Math.floor(Number(limit) || 50))));
  for (const row of rows) {
    const result = await sendSingleFcmMessage(row.phone, row.title, row.body, row.link);
    if (result.accepted) {
      await transitionNotificationDelivery(row.id, 'accepted', row.phone, result.providerReference);
      outcome.sent += 1;
    } else if (result.failureReason === 'device_token_unregistered') {
      await invalidateStoredFcmToken(row.phone);
      await transitionNotificationDelivery(row.id, 'dead_letter', row.phone, undefined, result.failureReason);
      outcome.invalidTokens += 1;
      outcome.none += 1;
    } else {
      const state = await recordNotificationAttempt(row.id, result.failureReason || 'fcm_delivery_failed', row.phone);
      outcome[state === 'dead_letter' ? 'none' : 'retried'] += 1;
    }
  }
  return outcome;
}