import { BaseChannelHandler } from './baseChannelService.js';

class SmsHandler extends BaseChannelHandler {
    get channelName(): string { return 'sms'; }

    protected parseMessage(body: any, _headers: Record<string, any>): { phone: string; text: string; meta?: any } | null {
        const rawPhone = body?.From || body?.from || body?.phoneNumber || '';
        const text = body?.Body || body?.text || body?.message || '';
        if (!rawPhone || !text.trim()) return null;
        const phone = String(rawPhone).trim();
        const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        return { phone: normalizedPhone, text: String(text).trim() };
    }

    protected async sendReply(phone: string, reply: string): Promise<void> {
        const apiKey = process.env.AFRICASTALKING_API_KEY;
        const username = process.env.AFRICASTALKING_USERNAME;
        const sender = process.env.AFRICASTALKING_SENDER_ID;
        if (!apiKey || !username || apiKey.toLowerCase() === 'stub' || username.toLowerCase() === 'stub') {
            console.warn('[SMS] Outbound delivery not configured; inbound conversation was persisted.');
            return;
        }

        const body = new URLSearchParams({
            username,
            to: phone,
            message: reply.slice(0, 918),
            ...(sender ? { from: sender } : {})
        });
        const response = await fetch('https://api.africastalking.com/version1/messaging', {
            method: 'POST',
            headers: {
                'apiKey': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`Africa's Talking SMS delivery failed (${response.status}): ${detail.slice(0, 300)}`);
        }
    }
}

const smsHandlerInstance = new SmsHandler();

export async function handleSmsWebhook(body: any): Promise<{ status: string; response?: string; conversationId?: string }> {
    const res = await smsHandlerInstance.handleWebhook(body, {});
    return { status: res.status, response: res.response, conversationId: res.conversationId };
}
