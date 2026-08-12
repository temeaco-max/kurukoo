import { getDb, saveDb } from '../database.js';
async function ensureNotificationTable() {
    const db = await getDb();
    db.run(`CREATE TABLE IF NOT EXISTS internal_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        status TEXT NOT NULL DEFAULT 'unread',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_internal_notifications_phone_status ON internal_notifications(phone, status)`);
    return db;
}

export async function sendFcmPush(phone: string, title: string, body: string, link?: string): Promise<boolean> {
    const db = await ensureNotificationTable();
    const clickLink = link || null;

    // Persist an internal inbox notification even when no external adapter is configured.
    // This is a durable fallback, not evidence that an external delivery occurred.
    try {
        db.run(
            `INSERT INTO internal_notifications (phone, title, body, link, status) VALUES (?, ?, ?, ?, 'unread')`,
            [phone, title, body, clickLink],
        );
        saveDb();
    } catch (error) {
        console.error('[Push] Failed to store internal notification:', error);
    }

    console.warn('[Push] FCM delivery adapter is not configured; notification stored in internal queue.');
    return false;
}

export async function getInternalNotifications(phone: string, limit = 20): Promise<Array<{ id: number; title: string; body: string; link: string; status: string; created_at: string }>> {
    const db = await ensureNotificationTable();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
    const stmt = db.prepare(`SELECT id, title, body, link, status, created_at FROM internal_notifications WHERE phone = ? ORDER BY id DESC LIMIT ?`);
    stmt.bind([phone, safeLimit]);
    const results: Array<{ id: number; title: string; body: string; link: string; status: string; created_at: string }> = [];
    while (stmt.step()) results.push(stmt.getAsObject() as any);
    stmt.free();
    return results;
}

export async function markNotificationRead(notificationId: number, phone: string): Promise<boolean> {
    const db = await ensureNotificationTable();
    try {
        db.run(`UPDATE internal_notifications SET status = 'read' WHERE id = ? AND phone = ?`, [notificationId, phone]);
        const updated = db.getRowsModified() > 0;
        if (updated) saveDb();
        return updated;
    } catch {
        return false;
    }
}
