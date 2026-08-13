import { getDb } from '../database.js';
import { appendChatMessage } from '../services/chatConversationService.js';

/**
 * USSD is a short, deterministic menu adapter. It never represents provider
 * dispatch, payment, emergency delivery, or external notification as complete.
 */
export async function handleUssdRequest(phoneNumber: string, text: string): Promise<string> {
    const phone = String(phoneNumber || '').trim();
    if (!phone) return 'END Unable to identify your Kurukoo account. Please try again.';

    const db = await getDb();
    const parts = text ? text.split('*') : [];
    const level = parts.length;

    const stmt = db.prepare(`SELECT id, title, options FROM service_categories ORDER BY id ASC`);
    const categories: any[] = [];
    while (stmt.step()) {
        const category = stmt.getAsObject();
        try { category.options = JSON.parse(category.options as string); } catch { category.options = []; }
        categories.push(category);
    }
    stmt.free();

    let response = '';
    if (!text) {
        let menu = 'CON Welcome to Kurukoo\n';
        categories.forEach((category, index) => { menu += `${index + 1}. ${category.title}\n`; });
        menu += `${categories.length + 1}. Check Points\n${categories.length + 2}. Emergency information`;
        response = menu;
    } else {
        const mainSelection = Number.parseInt(parts[0], 10);
        if (mainSelection > 0 && mainSelection <= categories.length) {
            const category = categories[mainSelection - 1];
            if (level === 1) {
                let submenu = `CON Select an option for ${category.title}:\n`;
                (category.options as string[]).forEach((option, index) => { submenu += `${index + 1}. ${option}\n`; });
                response = submenu.trim();
            } else {
                response = `END Your ${category.title} selection has been saved in this Kurukoo conversation. Continue in Kurukoo chat to describe your need and review any available options.`;
            }
        } else if (mainSelection === categories.length + 1) {
            const pointsStmt = db.prepare(`SELECT COALESCE(points_balance, 0) as points FROM memory_profiles WHERE phone = ?`);
            pointsStmt.bind([phone]);
            let balance = 0;
            if (pointsStmt.step()) balance = Number(pointsStmt.getAsObject().points || 0);
            pointsStmt.free();
            response = `END Your Kurukoo balance is ${balance} Points. Points are not cash or a payment confirmation.`;
        } else if (mainSelection === categories.length + 2) {
            response = 'END Kurukoo does not contact emergency services or trusted contacts through this menu. Contact local emergency services directly using the number appropriate to your location.';
        } else {
            response = 'END Invalid selection. Please try again.';
        }
    }

    const conversation = await appendChatMessage({
        phone,
        sender: 'user',
        content: text || 'HOME',
        channel: 'ussd',
        metadata: { channel: 'ussd', inbound: true, external_dispatch: 'not_claimed' },
    });
    await appendChatMessage({
        phone,
        sender: 'assistant',
        content: response,
        channel: 'ussd',
        conversationId: conversation.conversationId,
        metadata: { channel: 'ussd', outbound: true, external_delivery: 'not_claimed' },
    });

    return response;
}
