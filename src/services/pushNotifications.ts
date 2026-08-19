import { getDb, saveDb } from '../database.js';
import { persistCoordinatorEvent } from './coordinatorStore.js';
import { getProfile } from './memoryProfile.js';
import { getFirebaseFcmReadiness, sendFirebaseFcmMessage } from './firebaseCloudMessaging.js';
async function ensureNotificationTable() {
    const db = await getDb();
    db.run(`CREATE TABLE IF NOT EXISTS internal_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        status TEXT NOT NULL DEFAULT 'unread',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at TEXT,
        last_attempt_at TEXT,
        dead_lettered_at TEXT
    )`);
    const columns = new Set((db.exec('PRAGMA table_info(internal_notifications)')[0]?.values || []).map((row: any[]) => String(row[1])));
    if (!columns.has('delivery_state')) db.run(`ALTER TABLE internal_notifications ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'queued'`);
    if (!columns.has('provider_reference')) db.run(`ALTER TABLE internal_notifications ADD COLUMN provider_reference TEXT`);
    if (!columns.has('failure_reason')) db.run(`ALTER TABLE internal_notifications ADD COLUMN failure_reason TEXT`);
    if (!columns.has('attempt_count')) db.run(`ALTER TABLE internal_notifications ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0`);
    if (!columns.has('max_attempts')) db.run(`ALTER TABLE internal_notifications ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3`);
    if (!columns.has('next_attempt_at')) db.run(`ALTER TABLE internal_notifications ADD COLUMN next_attempt_at TEXT`);
    if (!columns.has('last_attempt_at')) db.run(`ALTER TABLE internal_notifications ADD COLUMN last_attempt_at TEXT`);
    if (!columns.has('dead_lettered_at')) db.run(`ALTER TABLE internal_notifications ADD COLUMN dead_lettered_at TEXT`);
    if (!columns.has('context_id')) db.run(`ALTER TABLE internal_notifications ADD COLUMN context_id TEXT`);
    if (!columns.has('conversation_id')) db.run(`ALTER TABLE internal_notifications ADD COLUMN conversation_id TEXT`);
    if (!columns.has('available_action')) db.run(`ALTER TABLE internal_notifications ADD COLUMN available_action TEXT`);
    if (!columns.has('surface')) db.run(`ALTER TABLE internal_notifications ADD COLUMN surface TEXT`);
    if (!columns.has('canonical_action')) db.run(`ALTER TABLE internal_notifications ADD COLUMN canonical_action TEXT`);
    if (!columns.has('object_type')) db.run(`ALTER TABLE internal_notifications ADD COLUMN object_type TEXT`);
    if (!columns.has('object_id')) db.run(`ALTER TABLE internal_notifications ADD COLUMN object_id TEXT`);
    if (!columns.has('owner_scope')) db.run(`ALTER TABLE internal_notifications ADD COLUMN owner_scope TEXT`);
    if (!columns.has('idempotency_key')) db.run(`ALTER TABLE internal_notifications ADD COLUMN idempotency_key TEXT`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_internal_notifications_phone_status ON internal_notifications(phone, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_internal_notifications_delivery_state ON internal_notifications(delivery_state)`);
    return db;
}

function maxNotificationQueue(): number {
    const configured = Number(process.env.KURUKOO_NOTIFICATION_MAX_QUEUE || 10000);
    return Number.isSafeInteger(configured) && configured > 0 ? Math.min(configured, 1_000_000) : 10000;
}

export interface NotificationContext {
    contextId?: string;
    conversationId?: string;
    availableAction?: string;
    canonicalAction?: string;
    objectType?: string;
    objectId?: string;
    ownerScope?: string;
    idempotencyKey?: string;
    surface?: string;
}

function contextLink(link: string | undefined, context?: NotificationContext): string | null {
    if (!link && !context?.conversationId && !context?.contextId) return null;
    if (!context) return link || null;
    if (link && /^https?:\/\//i.test(link)) return link;
    const url = new URL(link || '/chat', 'https://kurukoo.internal');
    if (context.conversationId) url.searchParams.set('conversationId', context.conversationId);
    if (context.contextId) url.searchParams.set('contextId', context.contextId);
    if (context.availableAction) url.searchParams.set('action', context.availableAction);
    if (context.canonicalAction) url.searchParams.set('canonicalAction', context.canonicalAction);
    if (context.objectType) url.searchParams.set('objectType', context.objectType);
    if (context.objectId) url.searchParams.set('objectId', context.objectId);
    return `${url.pathname}${url.search}${url.hash}`;
}

export async function sendFcmPush(phone: string, title: string, body: string, link?: string, context?: NotificationContext): Promise<boolean> {
    const db = await ensureNotificationTable();
    const clickLink = contextLink(link, context);
    let notificationId = 0;
    try {
        const duplicate = db.exec(`SELECT id FROM internal_notifications WHERE phone = ? AND title = ? AND body = ? AND COALESCE(link, '') = COALESCE(?, '') AND datetime(created_at) > datetime('now', '-10 minutes') LIMIT 1`, [phone, title, body, clickLink]);
        if (duplicate[0]?.values?.length) return false;
        const pending = db.exec(`SELECT COUNT(*) FROM internal_notifications WHERE delivery_state IN ('queued', 'accepted', 'sent', 'failed')`);
        const pendingCount = Number(pending[0]?.values?.[0]?.[0] || 0);
        if (pendingCount >= maxNotificationQueue()) {
            console.error(`[Push] Internal notification queue cap reached (${maxNotificationQueue()}); notification was not enqueued.`);
            return false;
        }
        db.run(
            `INSERT INTO internal_notifications (phone, title, body, link, status, delivery_state, context_id, conversation_id, available_action, canonical_action, object_type, object_id, owner_scope, idempotency_key, surface) VALUES (?, ?, ?, ?, 'unread', 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [phone, title, body, clickLink, context?.contextId || null, context?.conversationId || null, context?.availableAction || null, context?.canonicalAction || null, context?.objectType || null, context?.objectId || null, context?.ownerScope || phone, context?.idempotencyKey || null, context?.surface || null],
        );
        notificationId = Number(db.exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0] || 0);
        saveDb();
        if (notificationId) await persistCoordinatorEvent({
            id: `notification:${notificationId}:queued`, type: 'notification.action_required', occurredAt: new Date().toISOString(), producer: 'pushNotifications', correlationId: `notification:${notificationId}`, ownerPhone: phone.startsWith('anon_') ? undefined : phone,
            payload: { notificationId, title: title.slice(0, 160), link: clickLink, contextId: context?.contextId, conversationId: context?.conversationId, availableAction: context?.availableAction, canonicalAction: context?.canonicalAction, objectType: context?.objectType, objectId: context?.objectId, ownerScope: context?.ownerScope || phone, idempotencyKey: context?.idempotencyKey, surface: context?.surface, deliveryState: 'queued' },
            sensitivity: phone.startsWith('anon_') ? 'public' : 'personal', provenance: { source: 'canonical_service', sourceId: String(notificationId), evidenceLevel: 'persisted_state' }, policy: { autonomousAllowed: false, confirmationRequired: 'none' }, schemaVersion: 1,
        });
    } catch (error) {
        console.error('[Push] Failed to store internal notification:', error);
    }

    const profile = await getProfile(phone, 'pushNotifications').catch(() => null) as any;
    const deviceToken = profile?.fcm_token ? String(profile.fcm_token).trim() : '';
    if (!deviceToken) {
        console.warn('[Push] FCM device token is not registered; notification remains in internal queue.');
        return false;
    }
    const providerResult = await sendFirebaseFcmMessage({ token: deviceToken, title, body, link: clickLink || undefined });
    if (notificationId) {
        if (providerResult.accepted) {
            await transitionNotificationDelivery(notificationId, 'accepted', phone, providerResult.providerReference);
            return true;
        }
        if (providerResult.attempted) {
            await transitionNotificationDelivery(notificationId, 'failed', phone, undefined, providerResult.failureReason);
        }
    }
    console.warn(`[Push] FCM was not accepted; internal queue retained (${providerResult.failureReason || 'not_configured'}).`);
    return false;
}

export async function transitionNotificationDelivery(notificationId: number, deliveryState: 'queued' | 'accepted' | 'sent' | 'delivered' | 'failed' | 'suppressed' | 'dead_letter', phone?: string, providerReference?: string, failureReason?: string): Promise<boolean> {
    const db = await ensureNotificationTable();
    const ownerClause = phone ? ' AND phone = ?' : '';
    const row = db.exec(`SELECT delivery_state FROM internal_notifications WHERE id = ?${ownerClause}`, phone ? [notificationId, phone] : [notificationId])[0]?.values?.[0] as any[] | undefined;
    if (!row) return false;
    const current = String(row[0] || 'queued');
    const terminal = new Set(['delivered', 'suppressed', 'dead_letter']);
    if (terminal.has(current)) return current === deliveryState;
    db.run(`UPDATE internal_notifications SET delivery_state=?, provider_reference=?, failure_reason=?, dead_lettered_at=CASE WHEN ?='dead_letter' THEN COALESCE(dead_lettered_at, CURRENT_TIMESTAMP) ELSE dead_lettered_at END WHERE id=?${ownerClause}`, [deliveryState, providerReference || null, failureReason || null, deliveryState, notificationId, ...(phone ? [phone] : [])]);
    const updated = db.getRowsModified() > 0;
    if (updated) {
      saveDb();
      if (['failed', 'dead_letter', 'delivered', 'suppressed'].includes(deliveryState)) await persistCoordinatorEvent({ id: `notification:${notificationId}:${deliveryState}:${Date.now()}`, type: 'notification.action_required', occurredAt: new Date().toISOString(), producer: 'pushNotifications', correlationId: `notification:${notificationId}`, ownerPhone: phone && !phone.startsWith('anon_') ? phone : undefined, payload: { notificationId, deliveryState, providerReference: providerReference || undefined, failureReason: failureReason || undefined }, sensitivity: phone?.startsWith('anon_') ? 'public' : 'personal', provenance: { source: 'canonical_service', sourceId: String(notificationId), evidenceLevel: 'persisted_state' }, policy: { autonomousAllowed: false, confirmationRequired: 'none' }, schemaVersion: 1 });
    }
    return updated;
}

export async function recordNotificationAttempt(notificationId: number, failureReason?: string, phone?: string): Promise<'queued' | 'dead_letter' | 'terminal' | 'missing'> {
    const db = await ensureNotificationTable();
    const ownerClause = phone ? ' AND phone = ?' : '';
    const row = db.exec(`SELECT attempt_count, max_attempts, delivery_state FROM internal_notifications WHERE id = ?${ownerClause}`, phone ? [notificationId, phone] : [notificationId])[0]?.values?.[0] as any[] | undefined;
    if (!row) return 'missing';
    const current = String(row[2] || 'queued');
    if (['delivered', 'suppressed'].includes(current)) return 'terminal';
    if (current === 'dead_letter') return 'dead_letter';
    const attempts = Number(row[0] || 0) + 1;
    const maxAttempts = Math.max(1, Number(row[1] || 3));
    const terminal = attempts >= maxAttempts;
    const nextAttemptAt = terminal ? null : new Date(Date.now() + Math.min(60 * 60_000, 5_000 * (2 ** Math.min(attempts - 1, 6)))).toISOString();
    db.run(`UPDATE internal_notifications SET attempt_count=?, last_attempt_at=CURRENT_TIMESTAMP, next_attempt_at=?, delivery_state=?, failure_reason=?, dead_lettered_at=CASE WHEN ?='dead_letter' THEN CURRENT_TIMESTAMP ELSE dead_lettered_at END WHERE id=?${ownerClause}`, [attempts, nextAttemptAt, terminal ? 'dead_letter' : 'queued', failureReason || null, terminal ? 'dead_letter' : 'queued', notificationId, ...(phone ? [phone] : [])]);
    saveDb();
    return terminal ? 'dead_letter' : 'queued';
}

export async function listQueuedNotifications(limit = 50): Promise<Array<{ id: number; phone: string; title: string; body: string; link?: string; attempt_count: number; max_attempts: number; next_attempt_at?: string; delivery_state: string }>> {
    const db = await ensureNotificationTable();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));
    const stmt = db.prepare(`SELECT id, phone, title, body, link, attempt_count, max_attempts, next_attempt_at, delivery_state FROM internal_notifications WHERE delivery_state='queued' AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now')) ORDER BY id ASC LIMIT ?`);
    stmt.bind([safeLimit]);
    const rows: Array<{ id: number; phone: string; title: string; body: string; link?: string; attempt_count: number; max_attempts: number; next_attempt_at?: string; delivery_state: string }> = [];
    while (stmt.step()) { const row = stmt.getAsObject() as any; rows.push({ id: Number(row.id), phone: String(row.phone), title: String(row.title), body: String(row.body), link: row.link ? String(row.link) : undefined, attempt_count: Number(row.attempt_count || 0), max_attempts: Number(row.max_attempts || 3), next_attempt_at: row.next_attempt_at ? String(row.next_attempt_at) : undefined, delivery_state: String(row.delivery_state) }); }
    stmt.free();
    return rows;
}

export async function getNotificationQueueStats(): Promise<{ total: number; queued: number; accepted: number; sent: number; delivered: number; failed: number; suppressed: number; deadLetter: number; oldestQueuedAt?: string }> {
    const db = await ensureNotificationTable();
    const counts = db.exec(`SELECT delivery_state, COUNT(*) AS count FROM internal_notifications GROUP BY delivery_state`)[0]?.values || [];
    const stateCounts: Record<string, number> = {};
    for (const row of counts) stateCounts[String(row[0] || 'queued')] = Number(row[1] || 0);
    const oldest = db.exec(`SELECT MIN(created_at) FROM internal_notifications WHERE delivery_state = 'queued'`)[0]?.values?.[0]?.[0];
    return { total: Object.values(stateCounts).reduce((sum, value) => sum + value, 0), queued: stateCounts.queued || 0, accepted: stateCounts.accepted || 0, sent: stateCounts.sent || 0, delivered: stateCounts.delivered || 0, failed: stateCounts.failed || 0, suppressed: stateCounts.suppressed || 0, deadLetter: stateCounts.dead_letter || 0, oldestQueuedAt: oldest ? String(oldest) : undefined };
}

export async function getInternalNotifications(phone: string, limit = 20): Promise<Array<{ id: number; title: string; body: string; link: string; status: string; delivery_state: string; provider_reference?: string; failure_reason?: string; context_id?: string; conversation_id?: string; available_action?: string; surface?: string; created_at: string }>> {
    const db = await ensureNotificationTable();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
    const stmt = db.prepare(`SELECT notification.* FROM internal_notifications notification INNER JOIN (SELECT phone, title, body, COALESCE(link, '') AS link_key, MAX(id) AS latest_id FROM internal_notifications WHERE phone = ? GROUP BY phone, title, body, COALESCE(link, '')) latest ON latest.latest_id = notification.id WHERE notification.phone = ? ORDER BY notification.id DESC LIMIT ?`);
    stmt.bind([phone, phone, safeLimit]);
    const results: Array<{ id: number; title: string; body: string; link: string; status: string; delivery_state: string; provider_reference?: string; failure_reason?: string; context_id?: string; conversation_id?: string; available_action?: string; surface?: string; created_at: string }> = [];
    while (stmt.step()) { const row = stmt.getAsObject() as any; results.push({ id: Number(row.id), title: String(row.title), body: String(row.body), link: String(row.link || '/chat'), status: String(row.status || 'unread'), delivery_state: String(row.delivery_state || 'queued'), provider_reference: row.provider_reference ? String(row.provider_reference) : undefined, failure_reason: row.failure_reason ? String(row.failure_reason) : undefined, context_id: row.context_id ? String(row.context_id) : undefined, conversation_id: row.conversation_id ? String(row.conversation_id) : undefined, available_action: row.available_action ? String(row.available_action) : undefined, surface: row.surface ? String(row.surface) : undefined, created_at: String(row.created_at || '') }); }
    stmt.free();
    return results;
}

export async function getInternalNotificationById(phoneOrId: string | number, idOrPhone: number | string): Promise<{ id: number; title: string; body: string; link: string; status: string; delivery_state: string; provider_reference?: string; failure_reason?: string; context_id?: string; conversation_id?: string; available_action?: string; canonical_action?: string; object_type?: string; object_id?: string; owner_scope?: string; surface?: string; created_at: string } | null> {
    const phone = typeof phoneOrId === 'string' ? phoneOrId : String(idOrPhone);
    const id = Number(typeof phoneOrId === 'number' ? phoneOrId : idOrPhone);
    const db = await ensureNotificationTable();
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const row = db.exec(`SELECT id, title, body, link, status, delivery_state, provider_reference, failure_reason, context_id, conversation_id, available_action, canonical_action, object_type, object_id, owner_scope, surface, created_at FROM internal_notifications WHERE id = ? AND phone = ? LIMIT 1`, [id, phone])[0]?.values?.[0] as any[] | undefined;
    if (!row) return null;
    return { id: Number(row[0]), title: String(row[1]), body: String(row[2]), link: String(row[3] || '/chat'), status: String(row[4] || 'unread'), delivery_state: String(row[5] || 'queued'), provider_reference: row[6] ? String(row[6]) : undefined, failure_reason: row[7] ? String(row[7]) : undefined, context_id: row[8] ? String(row[8]) : undefined, conversation_id: row[9] ? String(row[9]) : undefined, available_action: row[10] ? String(row[10]) : undefined, canonical_action: row[11] ? String(row[11]) : undefined, object_type: row[12] ? String(row[12]) : undefined, object_id: row[13] ? String(row[13]) : undefined, owner_scope: row[14] ? String(row[14]) : undefined, surface: row[15] ? String(row[15]) : undefined, created_at: String(row[16] || '') };
}

export async function markNotificationRead(phoneOrId: string | number, idOrPhone: number | string): Promise<boolean> {
    const phone = typeof phoneOrId === 'string' ? phoneOrId : String(idOrPhone);
    const id = Number(typeof phoneOrId === 'number' ? phoneOrId : idOrPhone);
    const db = await ensureNotificationTable();
    if (!Number.isSafeInteger(id) || id <= 0 || !phone) return false;
    db.run(`UPDATE internal_notifications SET status='read' WHERE id = ? AND phone = ?`, [id, phone]);
    const updated = db.getRowsModified() > 0;
    if (updated) saveDb();
    return updated;
}

export function isFcmConfigured(): boolean {
    return getFirebaseFcmReadiness().configured;
}

async function sendSingleFcmMessage(phone: string, title: string, body: string, link?: string): Promise<{ accepted: boolean; providerReference?: string; failureReason?: string }> {
    const profile = await getProfile(phone, 'pushNotifications.fcmDrain').catch(() => null) as any;
    const token = profile?.fcm_token ? String(profile.fcm_token).trim() : '';
    if (!token) return { accepted: false, failureReason: 'device_token_missing' };
    return sendFirebaseFcmMessage({ token, title, body, link });
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
