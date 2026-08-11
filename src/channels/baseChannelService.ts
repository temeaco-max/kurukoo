import { routeIntent } from '../services/intentRouter.js';
import { appendChatMessage } from '../services/chatConversationService.js';

export interface ChannelWebhookResult {
    status: string;
    response?: string;
    conversationId?: string;
    [key: string]: any;
}

export abstract class BaseChannelHandler {
    abstract get channelName(): string;

    protected async onStart(_meta: any): Promise<void> {}

    protected abstract parseMessage(body: any, headers: Record<string, any>): { phone: string; text: string; meta?: any } | null;

    protected abstract sendReply(phone: string, reply: string, meta?: any): Promise<void>;

    protected async onComplete(_meta: any): Promise<void> {}

    public async handleWebhook(body: any, headers: Record<string, any>): Promise<ChannelWebhookResult> {
        try {
            const parsed = this.parseMessage(body, headers);
            if (!parsed || !parsed.phone || !parsed.text.trim()) return { status: 'ignored' };

            const { phone, text, meta } = parsed;
            await this.onStart(meta);

            // All channels share the same conversation ledger and Memory Profile identity.
            const userMessage = await appendChatMessage({
                phone,
                sender: 'user',
                content: text,
                channel: this.channelName,
                metadata: { channel: this.channelName, inbound: true, ...meta }
            });

            const routing = await routeIntent(text, phone);
            const reply = `${routing.reply}`;

            await appendChatMessage({
                phone,
                sender: 'assistant',
                content: reply,
                channel: this.channelName,
                conversationId: userMessage.conversationId,
                cardData: routing.cardData,
                metadata: { channel: this.channelName, outbound: true }
            });

            await this.sendReply(phone, reply, meta);
            await this.onComplete(meta);

            return { status: 'success', response: reply, conversationId: userMessage.conversationId };
        } catch (e) {
            console.error(`[${this.channelName} Webhook] Error:`, e);
            return { status: 'error' };
        }
    }
}
