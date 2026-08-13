import { BaseChannelHandler, ChannelReplyResult } from './baseChannelService.js';
import { sendSmsTransport } from './outboundTransports.js';

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
                // Africa's Talking inbound callback does not expose a signed-payload contract.
                verificationState: 'not_supported',
            },
        };
    }

    protected async sendReply(phone: string, reply: string): Promise<ChannelReplyResult> {
        return sendSmsTransport(phone, reply);
    }
}

const smsHandlerInstance = new SmsHandler();

export async function handleSmsWebhook(body: any): Promise<{ status: string; response?: string; conversationId?: string; deliveryState?: string }> {
    const res = await smsHandlerInstance.handleWebhook(body, {});
    return { status: res.status, response: res.response, conversationId: res.conversationId, deliveryState: res.deliveryState };
}
