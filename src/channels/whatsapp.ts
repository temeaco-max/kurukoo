import crypto from 'node:crypto';
import { getDb, saveDb } from '../database.js';
import { routeIntent } from '../services/intentRouter.js';
import { appendChatMessage } from '../services/chatConversationService.js';
import { updateSessionInteraction } from '../services/sessionManager.js';
import { recordChannelUsage } from '../services/channelUsageService.js';
import {
    claimInboundChannelEvent,
    createCommunicationDelivery,
    DeliveryState,
    updateCommunicationDelivery,
    updateDeliveryByProviderReference,
} from '../services/communicationDelivery.js';

/** Verify Meta X-Hub-Signature-256 against the unmodified request bytes. */
export function verifyWhatsAppSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV === 'production') return false;
        console.warn('[WhatsApp] App secret is absent; webhook signature verification is available only for non-production development.');
        return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = signatureHeader.slice('sha256='.length);
    const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    try {
        const expectedBuffer = Buffer.from(expected, 'hex');
        const digestBuffer = Buffer.from(digest, 'hex');
        return expectedBuffer.length === digestBuffer.length && crypto.timingSafeEqual(expectedBuffer, digestBuffer);
    } catch {
        return false;
    }
}

interface WhatsAppSendResult {
    state: Extract<DeliveryState, 'accepted' | 'failed' | 'not_configured'>;
    providerReference?: string;
    errorCode?: string;
}

async function sendWhatsAppTypingIndicator(phone: string, status: 'typing' | 'stopped', phoneNumberId?: string): Promise<void> {
    try {
        const token = process.env.WHATSAPP_TOKEN;
        const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!token || !phoneId) return;
        const recipient = phone.replace(/^\+/, '');
        await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', status, to: recipient }),
        });
    } catch (error) { console.warn(`[WhatsApp Typing] Failed to send ${status} status:`, error); }
}

async function sendWhatsAppMessage(phone: string, text: string, phoneNumberId?: string): Promise<WhatsAppSendResult> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) return { state: 'not_configured', errorCode: 'whatsapp_adapter_not_configured' };
    try {
        const recipient = phone.replace(/^\+/, '');
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, type: 'text', text: { body: text } }),
        });
        const payload = await response.json().catch(() => ({})) as any;
        const providerReference = payload?.messages?.[0]?.id ? String(payload.messages[0].id) : undefined;
        if (!response.ok || !providerReference) {
            return {
                state: 'failed',
                errorCode: String(payload?.error?.message || `http_${response.status}`).slice(0, 160),
                providerReference,
            };
        }
        // Meta has accepted the request. Delivery and read evidence arrives by webhook later.
        return { state: 'accepted', providerReference };
    } catch (error) {
        return { state: 'failed', errorCode: error instanceof Error ? error.message.slice(0, 160) : 'whatsapp_network_error' };
    }
}

function normalizeReceiptState(value: unknown): DeliveryState | undefined {
    const status = String(value || '').toLowerCase();
    if (status === 'sent') return 'sent';
    if (status === 'delivered') return 'delivered';
    if (status === 'read') return 'read';
    if (status === 'failed') return 'failed';
    return undefined;
}

async function processStatusWebhook(statusEvent: any): Promise<void> {
    const providerReference = String(statusEvent?.id || '').trim();
    const state = normalizeReceiptState(statusEvent?.status);
    if (!providerReference || !state) return;
    await updateDeliveryByProviderReference({
        channel: 'whatsapp',
        providerReference,
        state,
        errorCode: state === 'failed' ? String(statusEvent?.errors?.[0]?.title || statusEvent?.errors?.[0]?.code || 'whatsapp_delivery_failed') : undefined,
        metadata: { provider_status: statusEvent?.status || null },
    });
    const db = await getDb();
    db.run(`UPDATE messages SET status = ? WHERE whatsapp_msg_id = ?`, [state, providerReference]);
    saveDb();
}

async function processInboundWhatsAppMessage(message: any, phoneNumberId?: string): Promise<{ processed: boolean; conversationId?: string; deliveryState?: DeliveryState }> {
    const phone = message?.from ? `+${message.from}` : '';
    const text = String(message?.text?.body || message?.button?.text || '').trim();
    const providerEventId = String(message?.id || '').trim();
    if (!phone || !text || !providerEventId) return { processed: false };

    const inboundEvent = await claimInboundChannelEvent({
        channel: 'whatsapp',
        providerEventId,
        payload: message,
        verificationState: 'verified',
        phone,
        metadata: { channel: 'whatsapp', inbound: true, whatsapp_message_id: providerEventId },
    });
    if (inboundEvent.duplicate) return { processed: false, deliveryState: inboundEvent.delivery?.state };

    await sendWhatsAppTypingIndicator(phone, 'typing', phoneNumberId);
    await updateSessionInteraction(phone);
    const userMessage = await appendChatMessage({
        phone,
        sender: 'user',
        content: text,
        channel: 'whatsapp',
        metadata: { channel: 'whatsapp', inbound: true, whatsapp_message_id: providerEventId },
    });
    if (inboundEvent.delivery) {
        await updateCommunicationDelivery({ id: inboundEvent.delivery.id, state: 'accepted', messageId: userMessage.id });
    }
    await recordChannelUsage({
        phone,
        channel: 'whatsapp',
        direction: 'inbound',
        conversationId: userMessage.conversationId,
        metadata: { source: 'whatsapp_webhook', delivery: 'accepted' },
    });

    const routing = await routeIntent(text, phone);
    const reply = `${routing.reply}`;
    const outbound = await createCommunicationDelivery({
        phone,
        channel: 'whatsapp',
        direction: 'outbound',
        purpose: 'conversation_reply',
        state: 'queued',
        metadata: { source: 'whatsapp_webhook' },
    });
    const assistantMessage = await appendChatMessage({
        phone,
        sender: 'assistant',
        content: reply,
        channel: 'whatsapp',
        conversationId: userMessage.conversationId,
        cardData: routing.cardData,
        metadata: {
            channel: 'whatsapp',
            outbound: true,
            communication_delivery_id: outbound.id,
            delivery_state: 'queued',
        },
    });
    const result = await sendWhatsAppMessage(phone, reply, phoneNumberId);
    const delivery = await updateCommunicationDelivery({
        id: outbound.id,
        state: result.state,
        messageId: assistantMessage.id,
        providerReference: result.providerReference,
        errorCode: result.errorCode,
    });
    if (result.providerReference) {
        const db = await getDb();
        db.run(`UPDATE messages SET whatsapp_msg_id = ?, status = ? WHERE id = ?`, [result.providerReference, delivery?.state || result.state, assistantMessage.id]);
        saveDb();
    } else {
        const db = await getDb();
        db.run(`UPDATE messages SET status = ? WHERE id = ?`, [delivery?.state || result.state, assistantMessage.id]);
        saveDb();
    }
    await recordChannelUsage({
        phone,
        channel: 'whatsapp',
        direction: 'outbound',
        providerReference: result.providerReference,
        conversationId: userMessage.conversationId,
        metadata: { source: 'whatsapp_webhook', delivery: delivery?.state || result.state, external_delivery_confirmed: false },
    });
    await sendWhatsAppTypingIndicator(phone, 'stopped', phoneNumberId);
    return { processed: true, conversationId: userMessage.conversationId, deliveryState: delivery?.state || result.state };
}

export async function handleWhatsAppWebhook(body: any, signature: string, rawBody?: string | Buffer): Promise<{ status: string; [key: string]: any }> {
    try {
        if (rawBody === undefined) return { status: 'error', error: 'raw_body_required' };
        const verified = verifyWhatsAppSignature(rawBody, signature || '');
        if (!verified) return { status: 'error', error: 'invalid_signature' };

        const values = (Array.isArray(body?.entry) ? body.entry : [])
            .flatMap((entry: any) => Array.isArray(entry?.changes) ? entry.changes : [])
            .map((change: any) => change?.value)
            .filter(Boolean);
        if (!values.length) return { status: 'ignored' };

        let processed = 0;
        let duplicate = 0;
        let lastConversationId: string | undefined;
        let lastDeliveryState: DeliveryState | undefined;
        for (const value of values) {
            for (const statusEvent of Array.isArray(value?.statuses) ? value.statuses : []) await processStatusWebhook(statusEvent);
            const phoneNumberId = value?.metadata?.phone_number_id;
            for (const message of Array.isArray(value?.messages) ? value.messages : []) {
                const result = await processInboundWhatsAppMessage(message, phoneNumberId);
                if (result.processed) processed += 1; else duplicate += 1;
                lastConversationId = result.conversationId || lastConversationId;
                lastDeliveryState = result.deliveryState || lastDeliveryState;
            }
        }
        return { status: 'success', processed, duplicate, conversationId: lastConversationId, deliveryState: lastDeliveryState };
    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        return { status: 'error' };
    }
}
