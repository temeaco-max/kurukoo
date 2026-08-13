import { getDb, saveDb } from '../database.js';
import { deleteChatAttachmentsForOwner } from './chatAttachmentService.js';

export async function purgeExpiredData(): Promise<{ messagesDeleted: number; tempSessionsDeleted: number; pulseLocationsDeleted: number }> {
    const db = await getDb();
    
    // 1. Messages older than 12 months (365 days)
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    db.run(`DELETE FROM messages WHERE created_at < ?`, [twelveMonthsAgo]);
    const messagesDeleted = db.getRowsModified();

    // 2. Temp sessions older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(`DELETE FROM temp_sessions WHERE created_at < ?`, [sevenDaysAgo]);
    const tempSessionsDeleted = db.getRowsModified();

    // 3. Pulse sessions location data older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.run(`DELETE FROM pulse_sessions WHERE expires_at < ? OR (expires_at IS NULL AND id IN (SELECT id FROM pulse_sessions WHERE id NOT IN (SELECT id FROM pulse_sessions ORDER BY id DESC LIMIT 100)))`, [thirtyDaysAgo]);
    const pulseLocationsDeleted = db.getRowsModified();

    // Also purge audit logs older than 30 days
    db.run(`DELETE FROM audit_logs WHERE created_at < ?`, [thirtyDaysAgo]);

    saveDb();

    console.log(`Data retention purge completed. Messages: ${messagesDeleted}, Temp sessions: ${tempSessionsDeleted}, Pulse locations: ${pulseLocationsDeleted} deleted.`);

    return { messagesDeleted, tempSessionsDeleted, pulseLocationsDeleted };
}

export async function exportUserData(phone: string): Promise<any> {
    const db = await getDb();
    const result: any = { phone };
    
    const profileStmt = db.prepare(`SELECT * FROM memory_profiles WHERE phone = ?`);
    profileStmt.bind([phone]);
    if (profileStmt.step()) {
        result.profile = profileStmt.getAsObject();
    }
    profileStmt.free();
    
    const skillsStmt = db.prepare(`SELECT * FROM skills WHERE phone = ?`);
    skillsStmt.bind([phone]);
    result.skills = [];
    while (skillsStmt.step()) {
        result.skills.push(skillsStmt.getAsObject());
    }
    skillsStmt.free();
    
    const ordersStmt = db.prepare(`SELECT * FROM orders WHERE phone = ? OR provider_phone = ?`);
    ordersStmt.bind([phone, phone]);
    result.orders = [];
    while (ordersStmt.step()) {
        result.orders.push(ordersStmt.getAsObject());
    }
    ordersStmt.free();

    return result;
}

export async function deleteUserData(phone: string): Promise<void> {
    const db = await getDb();
    
    // Attachment records and private bytes are owned by the chat attachment service.
    // Remove them before profile deletion so a failed file operation leaves the account intact for retry.
    await deleteChatAttachmentsForOwner(phone);

    // Hard delete personal data
    db.run(`DELETE FROM memory_profiles WHERE phone = ?`, [phone]);
    db.run(`DELETE FROM skills WHERE phone = ?`, [phone]);
    
    // Anonymize orders
    db.run(`UPDATE orders SET phone = 'ANONYMOUS', provider_phone = 'ANONYMOUS' WHERE phone = ? OR provider_phone = ?`, [phone, phone]);
    
    // Delete profile access logs
    db.run(`DELETE FROM profile_access_log WHERE phone = ?`, [phone]);
    
    saveDb();
    console.log('[DATA RETENTION] Deleted user data for an authenticated account.');
}
