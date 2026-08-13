import { getDb, saveDb } from '../database.js';
import { appendChatMessage } from '../services/chatConversationService.js';
import { claimInboundChannelEvent, claimProviderCallbackEvent } from '../services/communicationDelivery.js';

/**
 * USSD is a short, deterministic menu adapter. It never represents provider
 * dispatch, payment, emergency delivery, or external notification as complete.
 */
export async function handleUssdRequest(phoneNumber: string, text: string, sessionId?: string, serviceCode?: string): Promise<string> {
    const phone = String(phoneNumber || '').trim();
    const normalizedSessionId = String(sessionId || '').trim();
    const input = String(text || '');
    if (!phone) return 'END Unable to identify your Kurukoo account. Please try again.';

    const db = await getDb();
    let deliveryId: string | undefined;
    if (normalizedSessionId) {
        const existing = db.prepare(`SELECT response_text FROM ussd_interactions WHERE session_id = ? AND input_text = ? LIMIT 1`);
        existing.bind([normalizedSessionId, input]);
        const priorResponse = existing.step() ? String(existing.getAsObject().response_text || '') : '';
        existing.free();
        if (priorResponse) return priorResponse;
        const inbound = await claimInboundChannelEvent({
            channel: 'ussd',
            providerEventId: `${normalizedSessionId}:${input}`,
            payload: { phoneNumber: phone, text: input, sessionId: normalizedSessionId, serviceCode: serviceCode || null },
            verificationState: 'not_supported',
            phone,
            purpose: 'ussd_interaction',
            metadata: { channel: 'ussd', session_id: normalizedSessionId, external_dispatch: 'not_claimed' },
        });
        if (inbound.duplicate) return 'END This USSD step was already received. Please start a new session if you need to continue.';
        deliveryId = inbound.delivery?.id;
    }

    const parts = input ? input.split('*') : [];
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
    if (!input) {
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
        content: input || 'HOME',
        channel: 'ussd',
        metadata: { channel: 'ussd', inbound: true, session_id: normalizedSessionId || undefined, external_dispatch: 'not_claimed' },
    });
    await appendChatMessage({
        phone,
        sender: 'assistant',
        content: response,
        channel: 'ussd',
        conversationId: conversation.conversationId,
        metadata: { channel: 'ussd', outbound: true, session_id: normalizedSessionId || undefined, external_delivery: 'not_claimed' },
    });
    if (normalizedSessionId) {
        db.run(`INSERT INTO ussd_interactions (session_id, input_text, phone, service_code, response_text, communication_delivery_id)
          VALUES (?, ?, ?, ?, ?, ?)`, [normalizedSessionId, input, phone, serviceCode || null, response, deliveryId || null]);
        saveDb();
    }
    return response;
}

export async function recordUssdSessionOutcome(body: any): Promise<{ status: 'success' | 'ignored' | 'duplicate' }> {
    const sessionId = String(body?.sessionId || body?.session_id || '').trim();
    if (!sessionId) return { status: 'ignored' };
    const callback = await claimProviderCallbackEvent({
        channel: 'ussd',
        callbackType: 'session_outcome',
        providerEventId: `${sessionId}:${String(body?.status || '')}:${String(body?.date || '')}`,
        payload: body,
        verificationState: 'not_supported',
    });
    if (callback.duplicate) return { status: 'duplicate' };
    const db = await getDb();
    db.run(`INSERT INTO ussd_session_outcomes (session_id, phone, service_code, provider_status, network_code, duration_ms, hops_count, error_message, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET provider_status=excluded.provider_status, network_code=excluded.network_code, duration_ms=excluded.duration_ms, hops_count=excluded.hops_count, error_message=excluded.error_message, metadata_json=excluded.metadata_json, received_at=CURRENT_TIMESTAMP`, [
        sessionId,
        String(body?.phoneNumber || body?.phone || '') || null,
        String(body?.serviceCode || '') || null,
        String(body?.status || 'Unknown'),
        String(body?.networkCode || '') || null,
        Number.isFinite(Number(body?.durationInMillis)) ? Number(body.durationInMillis) : null,
        Number.isFinite(Number(body?.hopsCount)) ? Number(body.hopsCount) : null,
        String(body?.errorMessage || '') || null,
        JSON.stringify({ cost: body?.cost || null, input: body?.input || null, last_app_response: body?.lastAppResponse || null }),
    ]);
    saveDb();
    return { status: 'success' };
}
