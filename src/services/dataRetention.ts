import { getDb, saveDb } from '../database.js';
import { deleteChatAttachmentsForOwner, listChatAttachmentMetadataForOwner } from './chatAttachmentService.js';
import { deleteAllChatHistoryForOwner, exportChatHistory, purgeExpiredChatMessages } from './chatConversationService.js';
import { deleteRemindersForOwner } from './reminderService.js';
import { deleteSafetyDataForOwner } from './safetyService.js';
import { deleteIntentionsForOwner } from './deferredRequestService.js';
import { deleteOpportunitiesForOwner } from './opportunityEngine.js';
import { anonymizeEconomicIdentityForOwner } from './skillFlows.js';

export async function purgeExpiredData(): Promise<{ messagesDeleted: number; tempSessionsDeleted: number; pulseLocationsDeleted: number }> {
    const db = await getDb();
    
    // 1. Messages older than 12 months (365 days), including their metadata and final attachment references.
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const messagesDeleted = await purgeExpiredChatMessages(twelveMonthsAgo, 1000);

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

    // Account export is a bounded owner-scoped snapshot. Chat and attachment owners
    // decide their own projection; private attachment bytes and storage paths remain unavailable here.
    const [messages, attachments] = await Promise.all([
        exportChatHistory(phone, 250),
        listChatAttachmentMetadataForOwner(phone, 250),
    ]);
    result.export_scope = {
        chat_messages: { included: messages.length, maximum: 250 },
        attachment_metadata: { included: attachments.length, maximum: 250, bytes_included: false, storage_paths_included: false },
    };
    result.chat = { messages };
    result.attachments = attachments;

    return result;
}

export async function deleteUserData(phone: string): Promise<void> {
    const db = await getDb();

    // Economic requests remain canonical lifecycle/audit records. Terminal records are
    // identity-anonymised; active request deletion fails before any other account state changes.
    await anonymizeEconomicIdentityForOwner(phone);
    
    // Conversation history owns message metadata and final-reference attachment cleanup.
    // Remove it first so an attachment still referenced by chat cannot outlive account deletion.
    await deleteAllChatHistoryForOwner(phone);

    // The attachment owner removes any uploaded-but-unreferenced records and private bytes.
    // Both operations run before profile deletion so a failed file operation leaves the account intact for retry.
    await deleteChatAttachmentsForOwner(phone);

    // Remove private workspace state only through each existing canonical owner.
    // Economic, payment, verification, trust, and compliance records are deliberately not deleted here.
    await deleteRemindersForOwner(phone);
    await deleteSafetyDataForOwner(phone);
    await deleteIntentionsForOwner(phone);
    await deleteOpportunitiesForOwner(phone);

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
