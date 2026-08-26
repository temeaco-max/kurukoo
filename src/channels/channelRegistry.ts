import { handleWhatsAppWebhook } from './whatsapp.js';
import { handleTelegramWebhook } from './telegram.js';
import { handleSmsWebhook } from './sms.js';
import { handleEmailWebhook } from './email.js';
import { handleIvrWebhook } from './ivr.js';
import { handleUssdRequest } from '../ussd/menus.js';
import { hasConfiguredSecret } from '../services/providerCapabilities.js';

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
        const { phoneNumber, text } = body || {};
        if (!phoneNumber || typeof phoneNumber !== 'string') return { status: 'ignored' };
        const response = await handleUssdRequest(phoneNumber, typeof text === 'string' ? text : '', { sessionId: typeof body?.sessionId === 'string' ? body.sessionId : undefined, serviceCode: typeof body?.serviceCode === 'string' ? body.serviceCode : undefined });
        return { status: 'success', response };
    }
};

export type ChannelName = keyof typeof channelRegistry;

/** Whether an adapter has the credentials required to make a truthful public availability claim. */
export function isChannelConfigured(channel: string | undefined): boolean {
    const isReal = (val: string | undefined) => hasConfiguredSecret(val);
    switch (String(channel || '').toLowerCase()) {
        case 'web': return true;
        case 'whatsapp': return isReal(process.env.WHATSAPP_TOKEN) && isReal(process.env.WHATSAPP_PHONE_NUMBER_ID) && isReal(process.env.WHATSAPP_VERIFY_TOKEN) && isReal(process.env.WHATSAPP_APP_SECRET);
        case 'telegram': return isReal(process.env.TELEGRAM_BOT_TOKEN) && isReal(process.env.TELEGRAM_WEBHOOK_SECRET);
        case 'sms': return isReal(process.env.AFRICASTALKING_API_KEY) && isReal(process.env.AFRICASTALKING_USERNAME);
        case 'ussd': return isReal(process.env.AFRICASTALKING_API_KEY) && isReal(process.env.AFRICASTALKING_USERNAME);
        default: return false;
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
