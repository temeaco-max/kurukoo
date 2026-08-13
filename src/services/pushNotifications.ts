import { getDb, saveDb } from '../database.js';
import {
    createCommunicationDelivery,
    updateCommunicationDelivery,
} from './communicationDelivery.js';

export interface InternalNotificationOptions {
    purpose?: string;
    aggregateType?: string;
    aggregateId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
}

async function ensureNotificationTable() {
    const db = await getDb();
    db.run(`CREATE TABLE IF NOT EXISTS internal_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        communication_delivery_id TEXT,
        status TEXT NOT NULL DEFAULT 'unread',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    const columns = db.exec(`PRAGMA table_info(internal_notifications)`);
    const names = new Set<string>((columns[0]?.values || []).map((row: unknown[]) => String(row[1])));
    if (!names.has('communication_delivery_id')) db.run(`ALTER TABLE internal_notifications ADD COLUMN communication_delivery_id TEXT`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_internal_notifications_phone_status ON internal_notifications(phone, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_internal_notifications_delivery ON internal_notifications(communication_delivery_id)`);
    return db;
}

/**
 * Persist a durable in-app notice through the canonical communication-delivery
 * ledger. This performs no external transport and records `queued` until the
 * recipient reads the notice in Kurukoo.
 */
export async function enqueueInternalNotification(
    phone: string,
    title: string,
    body: string,
    link?: string,
    options: InternalNotificationOptions = {},
): Promise<boolean> {
    const db = await ensureNotificationTable();
    try {
        const delivery = await createCommunicationDelivery({
            phone,
            channel: 'in_app',
            direction: 'outbound',
            purpose: options.purpose || 'internal_notification',
            aggregateType: options.aggregateType,
            aggregateId: options.aggregateId,
            idempotencyKey: options.idempotencyKey,
            state: 'queued',
            metadata: { ...(options.metadata || {}), external_delivery: 'not_claimed' },
        });
        if (options.idempotencyKey) {
            const existing = db.prepare(`SELECT id FROM internal_notifications WHERE communication_delivery_id = ? LIMIT 1`);
            existing.bind([delivery.id]);
            const alreadyQueued = existing.step();
            existing.free();
            if (alreadyQueued) return true;
        }
        db.run(
            `INSERT INTO internal_notifications (phone, title, body, link, communication_delivery_id, status) VALUES (?, ?, ?, ?, ?, 'unread')`,
            [phone, title, body, link || null, delivery.id],
        );
        saveDb();
        return true;
    } catch (error) {
        console.error('[Notifications] Failed to store internal notification:', error);
        return false;
    }
}

/**
 * External FCM delivery boundary. It first records an in-app notification and
 * returns false until a separately configured adapter records real acceptance
 * and receipt evidence.
 */
export async function sendFcmPush(phone: string, title: string, body: string, link?: string): Promise<boolean> {
    await enqueueInternalNotification(phone, title, body, link, { purpose: 'push_fallback' });
    console.warn('[Push] FCM delivery adapter is not configured; notification stored in the internal queue.');
    return false;
}

export async function getInternalNotifications(phone: string, limit = 20): Promise<Array<{ id: number; title: string; body: string; link: string; status: string; delivery_state: string; created_at: string }>> {
    const db = await ensureNotificationTable();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
    const stmt = db.prepare(`SELECT n.id, n.title, n.body, n.link, n.status, COALESCE(d.state, 'queued') AS delivery_state, n.created_at
        FROM internal_notifications n
        LEFT JOIN communication_deliveries d ON d.id = n.communication_delivery_id
        WHERE n.phone = ? ORDER BY n.id DESC LIMIT ?`);
    stmt.bind([phone, safeLimit]);
    const results: Array<{ id: number; title: string; body: string; link: string; status: string; delivery_state: string; created_at: string }> = [];
    while (stmt.step()) results.push(stmt.getAsObject() as any);
    stmt.free();
    return results;
}

export async function markNotificationRead(notificationId: number, phone: string): Promise<boolean> {
    const db = await ensureNotificationTable();
    try {
        const lookup = db.prepare(`SELECT communication_delivery_id FROM internal_notifications WHERE id = ? AND phone = ? LIMIT 1`);
        lookup.bind([notificationId, phone]);
        const deliveryId = lookup.step() ? String(lookup.getAsObject().communication_delivery_id || '') : '';
        lookup.free();
        db.run(`UPDATE internal_notifications SET status = 'read' WHERE id = ? AND phone = ?`, [notificationId, phone]);
        const updated = db.getRowsModified() > 0;
        if (updated && deliveryId) await updateCommunicationDelivery({ id: deliveryId, state: 'read' });
        if (updated) saveDb();
        return updated;
    } catch {
        return false;
    }
}
