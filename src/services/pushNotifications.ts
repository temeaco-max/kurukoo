import { getDb } from '../database.js';
import { generateWhatsAppDeepLink } from '../utils/whatsappLinks.js';

export { generateWhatsAppDeepLink };

export async function sendFcmPush(phone: string, title: string, body: string, link?: string): Promise<boolean> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT fcm_token FROM memory_profiles WHERE phone = ?`);
    stmt.bind([phone]);
    if (!stmt.step()) {
        stmt.free();
        return false;
    }
    const token = stmt.getAsObject().fcm_token;
    stmt.free();

    if (!token) return false;
    
    const clickLink = link || generateWhatsAppDeepLink();
    void clickLink;
    void title;
    void body;
    void token;

    // A stored device token is not evidence of delivery. Until a real FCM adapter
    // is configured, callers must treat this as an unsent notification and use
    // their documented fallback path instead of recording a simulated success.
    console.warn('[Push] FCM delivery adapter is not configured; notification was not sent.');
    return false;
}
