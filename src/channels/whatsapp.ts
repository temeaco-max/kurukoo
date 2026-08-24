import crypto from 'crypto';
import { getDb, saveDb } from '../database.js';
import { updateSessionInteraction } from '../services/sessionManager.js';
import { recordChannelEvidence } from '../services/progressiveTrustService.js';
import { claimInboundWebhook } from '../services/channelWebhookDeduplication.js';

export function verifyWhatsAppSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV === 'production') return false;
        return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = signatureHeader.slice('sha256='.length);
    const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(digest, 'hex'));
    } catch { return false; }
}

async function sendWhatsAppRequest(phone: string, payload: Record<string, unknown>, phoneNumberId?: string): Promise<{ id?: string; error?: string }> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) return { error: 'whatsapp_not_configured' };
    const recipient = phone.replace(/^\+/, '');
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', ...payload, to: recipient }),
            });
            const data = await res.json().catch(() => ({})) as any;
            if (res.ok) return { id: data?.messages?.[0]?.id };
            const retryable = res.status === 429 || res.status >= 500;
            if (!retryable) return { error: String(data?.error?.message || `whatsapp_http_${res.status}`) };
        } catch (error) {
            if (attempt === 2) return { error: error instanceof Error ? error.message : 'whatsapp_network_error' };
        }
        await new Promise(resolve => setTimeout(resolve, 250 * (2 ** attempt)));
    }
    return { error: 'whatsapp_delivery_failed' };
}

async function sendWhatsAppTypingIndicator(phone: string, status: 'typing' | 'stopped', phoneNumberId?: string): Promise<void> {
    await sendWhatsAppRequest(phone, { status }, phoneNumberId);
}

async function sendWhatsAppMessage(phone: string, text: string, phoneNumberId?: string): Promise<{ id?: string; error?: string }> {
    return sendWhatsAppRequest(phone, {
        recipient_type: 'individual',
        type: 'text',
        text: { body: text },
    }, phoneNumberId);
}

export async function handleWhatsAppWebhook(body: any, signature: string, rawBody?: string | Buffer): Promise<{ status: string; [key: string]: any }> {
    try {
        if (rawBody !== undefined) {
            if (!verifyWhatsAppSignature(rawBody, signature || '')) return { status: 'error', error: 'invalid_signature' };
        } else if (process.env.NODE_ENV === 'production') {
            return { status: 'error', error: 'raw_body_required' };
        }

        const value = body?.entry?.[0]?.changes?.[0]?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        const statuses = value?.statuses;
        if (Array.isArray(statuses) && statuses.length) {
            const db = await getDb();
            for (const st of statuses) {
                const wamid = st.id;
                const statusVal = st.status;
                const recipientId = st.recipient_id ? `+${st.recipient_id}` : (st.recipient ? `+${st.recipient}` : null);
                if (wamid) db.run(`UPDATE messages SET status = ? WHERE whatsapp_msg_id = ?`, [statusVal, wamid]);
                if (recipientId && statusVal === 'read') db.run(`UPDATE messages SET status = 'read' WHERE phone = ? AND sender = 'assistant' AND status != 'read'`, [recipientId]);
            }
            saveDb();
            return { status: 'success', processed: 'statuses' };
        }

        const messages = value?.messages;
        if (!Array.isArray(messages) || !messages.length) return { status: 'ignored' };
        const msg = messages[0];
        const phone = msg.from ? `+${msg.from}` : '';
        const text = msg.text?.body || msg.button?.text || '';
        const sourceRef = String(msg.id || '').trim();
        if (!phone || !text.trim() || !sourceRef) return { status: 'ignored' };

        const dedupe = await claimInboundWebhook({ channel: 'whatsapp', sourceRef, phone });
        if (dedupe.duplicate) return { status: 'success', duplicate: true };

        await recordChannelEvidence({
            phone,
            channel: 'whatsapp',
            evidenceType: 'verified_meta_webhook_inbound',
            externalSubject: sourceRef,
            sourceRef,
            consented: true,
        });
        await sendWhatsAppTypingIndicator(phone, 'typing', phoneNumberId);
        await updateSessionInteraction(phone);
        const { processCanonicalChatTurn } = await import('../services/canonicalChatTurnService.js');
        const turn = await processCanonicalChatTurn({ phone, message: text, channel: 'whatsapp', attachment: msg.image || msg.document || msg.video });
        const delivery = await sendWhatsAppMessage(phone, turn.reply, phoneNumberId);
        if (!delivery.id) {
            await sendWhatsAppTypingIndicator(phone, 'stopped', phoneNumberId);
            return { status: 'error', error: delivery.error || 'whatsapp_delivery_failed', conversationId: turn.conversationId };
        }

        const db = await getDb();
        db.run(`UPDATE messages SET whatsapp_msg_id = ?, status = 'sent' WHERE id = (SELECT MAX(id) FROM messages WHERE phone = ? AND sender = 'assistant')`, [delivery.id, phone]);
        saveDb();
        await sendWhatsAppTypingIndicator(phone, 'stopped', phoneNumberId);
        return { status: 'success', conversationId: turn.conversationId, response: turn.reply, cardData: turn.cardData, whatsappMessageId: delivery.id };
    } catch (e) {
        console.error('WhatsApp webhook error:', e);
        return { status: 'error' };
    }
}
