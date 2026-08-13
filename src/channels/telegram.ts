import { BaseChannelHandler, ChannelReplyResult } from './baseChannelService.js';

class TelegramHandler extends BaseChannelHandler {
    get channelName(): string { return 'telegram'; }

    protected async sendTelegramChatAction(chatId: number | string, action = 'typing'): Promise<void> {
        try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (!token) return;
            await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, action }),
            });
        } catch (error) { console.warn('[Telegram ChatAction] Failed:', error); }
    }

    protected async onStart(meta: any): Promise<void> {
        if (meta?.chatId) await this.sendTelegramChatAction(meta.chatId, 'typing');
    }

    protected parseMessage(body: any, headers: Record<string, any>): { phone: string; text: string; meta?: Record<string, any> } | null {
        const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const secretToken = headers['x-telegram-bot-api-secret-token'];
        if (configuredSecret && secretToken !== configuredSecret) return null;

        const message = body?.message || body?.edited_message;
        if (!message || !message.text) return null;
        const chatId = message.chat?.id;
        const userId = message.from?.id;
        const phone = userId ? `tg_${userId}` : (chatId ? `tg_${chatId}` : '');
        if (!phone) return null;
        return {
            phone,
            text: message.text,
            meta: {
                chatId,
                providerEventId: body?.update_id == null ? undefined : `telegram:${body.update_id}`,
                verificationState: configuredSecret ? 'verified' : 'not_verified',
            },
        };
    }

    protected async sendReply(_phone: string, reply: string, meta?: any): Promise<ChannelReplyResult> {
        const chatId = meta?.chatId;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token || !chatId) return { state: 'not_configured', errorCode: 'telegram_adapter_not_configured' };
        try {
            const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'Markdown' }),
            });
            const payload = await response.json().catch(() => ({})) as any;
            if (!response.ok || payload?.ok === false) {
                return { state: 'failed', errorCode: String(payload?.description || `http_${response.status}`).slice(0, 160) };
            }
            return {
                state: 'accepted',
                providerReference: payload?.result?.message_id == null ? undefined : String(payload.result.message_id),
            };
        } catch (error) {
            return { state: 'failed', errorCode: error instanceof Error ? error.message.slice(0, 160) : 'telegram_network_error' };
        }
    }
}

const telegramHandlerInstance = new TelegramHandler();

export async function handleTelegramWebhook(body: any, secretToken?: string): Promise<{ status: string }> {
    return await telegramHandlerInstance.handleWebhook(body, { 'x-telegram-bot-api-secret-token': secretToken });
}
