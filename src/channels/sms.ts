import { BaseChannelHandler, ChannelReplyResult } from './baseChannelService.js';

class SmsHandler extends BaseChannelHandler {
    get channelName(): string { return 'sms'; }

    protected parseMessage(body: any, _headers: Record<string, any>): { phone: string; text: string; meta?: Record<string, any> } | null {
        const rawPhone = body?.From || body?.from || body?.phoneNumber || '';
        const text = body?.Body || body?.text || body?.message || '';
        if (!rawPhone || !String(text).trim()) return null;
        const phone = String(rawPhone).trim();
        const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        const providerEventId = String(body?.id || body?.messageId || body?.message_id || '').trim();
        return {
            phone: normalizedPhone,
            text: String(text).trim(),
            meta: {
                providerEventId: providerEventId || undefined,
                // The configured provider's current inbound format does not supply a signed payload contract here.
                verificationState: 'not_supported',
            },
        };
    }

    protected async sendReply(phone: string, reply: string): Promise<ChannelReplyResult> {
        const apiKey = process.env.AFRICASTALKING_API_KEY;
        const username = process.env.AFRICASTALKING_USERNAME;
        const sender = process.env.AFRICASTALKING_SENDER_ID;
        if (!apiKey || !username || apiKey.toLowerCase() === 'stub' || username.toLowerCase() === 'stub') {
            console.warn('[SMS] Outbound delivery is not configured; the canonical conversation was persisted internally.');
            return { state: 'not_configured', errorCode: 'sms_adapter_not_configured' };
        }

        const body = new URLSearchParams({
            username,
            to: phone,
            message: reply.slice(0, 918),
            ...(sender ? { from: sender } : {}),
        });
        let response: Response;
        try {
            response = await fetch('https://api.africastalking.com/version1/messaging', {
                method: 'POST',
                headers: {
                    apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body,
            });
        } catch (error) {
            return {
                state: 'failed',
                errorCode: error instanceof Error ? `network:${error.message.slice(0, 120)}` : 'sms_network_error',
            };
        }
        const payload = await response.json().catch(() => ({})) as any;
        const recipient = payload?.SMSMessageData?.Recipients?.[0] || {};
        const providerReference = String(recipient?.messageId || recipient?.message_id || '').trim();
        const providerStatus = String(recipient?.status || '').toLowerCase();
        if (!response.ok || ['rejected', 'failed', 'expired', 'absentsubscriber', 'donotdisturbrejection'].includes(providerStatus)) {
            return {
                state: 'failed',
                providerReference: providerReference || undefined,
                errorCode: String(recipient?.status || `http_${response.status}`).slice(0, 160),
                metadata: { provider_status: recipient?.status || null },
            };
        }
        return {
            // A successful send response is provider acceptance, not recipient delivery.
            state: 'accepted',
            providerReference: providerReference || undefined,
            metadata: { provider_status: recipient?.status || null },
        };
    }
}

const smsHandlerInstance = new SmsHandler();

export async function handleSmsWebhook(body: any): Promise<{ status: string; response?: string; conversationId?: string; deliveryState?: string }> {
    const res = await smsHandlerInstance.handleWebhook(body, {});
    return { status: res.status, response: res.response, conversationId: res.conversationId, deliveryState: res.deliveryState };
}
