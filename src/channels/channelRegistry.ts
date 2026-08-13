import { handleWhatsAppWebhook } from './whatsapp.js';
import { handleTelegramWebhook } from './telegram.js';
import { handleSmsWebhook } from './sms.js';
import { handleEmailWebhook } from './email.js';
import { handleIvrWebhook } from './ivr.js';
import { handleUssdRequest } from '../ussd/menus.js';

export interface ChannelHandlerResult {
    status: string;
    response?: string;
    contentType?: string;
    conversationId?: string;
    [key: string]: any;
}

/**
 * Transport registry. Channels are adapters only: identity, conversation,
 * memory, intent and economic actions remain in the shared platform layer.
 */
export const channelRegistry = {
    whatsapp: async (body: any, headers: Record<string, any>, rawBody?: string | Buffer): Promise<ChannelHandlerResult> => {
        const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'] || '';
        return await handleWhatsAppWebhook(body, String(signature), rawBody);
    },
    telegram: async (body: any, headers: Record<string, any>): Promise<ChannelHandlerResult> => {
        const secretToken = headers['x-telegram-bot-api-secret-token'] || '';
        return await handleTelegramWebhook(body, secretToken);
    },
    sms: async (body: any, _headers: Record<string, any>): Promise<ChannelHandlerResult> => {
        return await handleSmsWebhook(body);
    },
    email: async (body: any, headers: Record<string, any>, rawBody?: string | Buffer): Promise<ChannelHandlerResult> => {
        return await handleEmailWebhook(body, headers, rawBody?.toString());
    },
    ivr: async (body: any, headers: Record<string, any>): Promise<ChannelHandlerResult> => {
        return await handleIvrWebhook(body, headers);
    },
    ussd: async (body: any, _headers: Record<string, any>): Promise<ChannelHandlerResult> => {
        const { phoneNumber, text, sessionId, serviceCode } = body || {};
        if (!phoneNumber || typeof phoneNumber !== 'string') return { status: 'ignored' };
        const response = await handleUssdRequest(phoneNumber, typeof text === 'string' ? text : '', typeof sessionId === 'string' ? sessionId : undefined, typeof serviceCode === 'string' ? serviceCode : undefined);
        return { status: 'success', response };
    }
};

export type ChannelName = keyof typeof channelRegistry;

/**
 * Public channel availability requires more than send credentials. It must have
 * the callback/receipt prerequisites needed for Kurukoo to state the channel is
 * operational without claiming a delivery that cannot be observed.
 */
export function isChannelConfigured(channel: string | undefined): boolean {
    switch (String(channel || '').toLowerCase()) {
        case 'web':
            return true;
        case 'whatsapp':
            return Boolean(
                process.env.WHATSAPP_TOKEN
                && process.env.WHATSAPP_PHONE_NUMBER_ID
                && process.env.WHATSAPP_APP_SECRET
                && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
            );
        case 'telegram':
            return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
        case 'sms':
            return Boolean(
                process.env.AFRICASTALKING_API_KEY
                && process.env.AFRICASTALKING_USERNAME
                && process.env.AFRICASTALKING_SMS_DELIVERY_REPORTS_ENABLED === 'true'
                && process.env.AFRICASTALKING_WEBHOOK_TOKEN,
            );
        case 'ussd':
            return Boolean(
                process.env.AFRICASTALKING_API_KEY
                && process.env.AFRICASTALKING_USERNAME
                && process.env.AFRICASTALKING_USSD_SERVICE_CODE
                && process.env.AFRICASTALKING_WEBHOOK_TOKEN
                && process.env.KURUKOO_USSD_ENABLED === 'true',
            );
        default:
            return false;
    }
}

export async function dispatchWebhook(
    channel: ChannelName,
    body: any,
    headers: Record<string, any>,
    rawBody?: string | Buffer
): Promise<ChannelHandlerResult> {
    const handler = channelRegistry[channel];
    if (channel === 'whatsapp' || channel === 'email') {
        return await (handler as typeof channelRegistry.whatsapp)(body, headers, rawBody);
    }
    return await handler(body, headers);
}
