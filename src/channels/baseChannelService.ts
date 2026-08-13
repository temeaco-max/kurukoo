import { routeIntent } from '../services/intentRouter.js';
import { appendChatMessage } from '../services/chatConversationService.js';
import { recordChannelUsage } from '../services/channelUsageService.js';
import {
    claimInboundChannelEvent,
    createCommunicationDelivery,
    DeliveryState,
    updateCommunicationDelivery,
} from '../services/communicationDelivery.js';

export interface ChannelWebhookResult {
    status: string;
    response?: string;
    conversationId?: string;
    deliveryState?: DeliveryState;
    [key: string]: any;
}

export interface ChannelReplyResult {
    state: Extract<DeliveryState, 'accepted' | 'submitted' | 'sent' | 'failed' | 'not_configured' | 'suppressed'>;
    providerReference?: string;
    errorCode?: string;
    metadata?: Record<string, unknown>;
}

export abstract class BaseChannelHandler {
    abstract get channelName(): string;

    protected async onStart(_meta: any): Promise<void> {}

    protected abstract parseMessage(body: any, headers: Record<string, any>): {
        phone: string;
        text: string;
        meta?: Record<string, any>;
    } | null;

    /** An adapter result is provider acceptance or an explicit non-delivery state, never assumed delivery. */
    protected abstract sendReply(phone: string, reply: string, meta?: any): Promise<ChannelReplyResult>;

    protected async onComplete(_meta: any): Promise<void> {}

    public async handleWebhook(body: any, headers: Record<string, any>): Promise<ChannelWebhookResult> {
        try {
            const parsed = this.parseMessage(body, headers);
            if (!parsed || !parsed.phone || !parsed.text.trim()) return { status: 'ignored' };

            const { phone, text, meta = {} } = parsed;
            const inboundEvent = await claimInboundChannelEvent({
                channel: this.channelName,
                providerEventId: typeof meta.providerEventId === 'string' ? meta.providerEventId : undefined,
                payload: body,
                verificationState: meta.verificationState === 'verified' || meta.verificationState === 'not_supported'
                    ? meta.verificationState
                    : 'not_verified',
                phone,
                metadata: { channel: this.channelName, inbound: true },
            });
            if (inboundEvent.duplicate) {
                return {
                    status: 'duplicate',
                    deliveryState: inboundEvent.delivery?.state,
                };
            }

            await this.onStart(meta);

            // Every transport writes to the same canonical conversation and Memory Profile identity.
            const userMessage = await appendChatMessage({
                phone,
                sender: 'user',
                content: text,
                channel: this.channelName,
                metadata: { channel: this.channelName, inbound: true, ...meta },
            });
            if (inboundEvent.delivery) {
                await updateCommunicationDelivery({
                    id: inboundEvent.delivery.id,
                    state: 'accepted',
                    messageId: userMessage.id,
                });
            }

            const routing = await routeIntent(text, phone);
            const reply = `${routing.reply}`;
            await recordChannelUsage({
                phone,
                channel: this.channelName,
                direction: 'inbound',
                units: 1,
                conversationId: userMessage.conversationId,
                metadata: { source: 'shared-channel-handler', delivery: 'accepted' },
            });

            const outboundDelivery = await createCommunicationDelivery({
                phone,
                channel: this.channelName,
                direction: 'outbound',
                purpose: 'conversation_reply',
                state: 'queued',
                metadata: { source: 'shared-channel-handler' },
            });
            const assistantMessage = await appendChatMessage({
                phone,
                sender: 'assistant',
                content: reply,
                channel: this.channelName,
                conversationId: userMessage.conversationId,
                cardData: routing.cardData,
                metadata: {
                    channel: this.channelName,
                    outbound: true,
                    communication_delivery_id: outboundDelivery.id,
                    delivery_state: 'queued',
                },
            });

            let adapterResult: ChannelReplyResult;
            try {
                adapterResult = await this.sendReply(phone, reply, meta);
            } catch (error) {
                adapterResult = {
                    state: 'failed',
                    errorCode: error instanceof Error ? error.message.slice(0, 160) : 'adapter_error',
                };
            }
            const delivery = await updateCommunicationDelivery({
                id: outboundDelivery.id,
                state: adapterResult.state,
                messageId: assistantMessage.id,
                providerReference: adapterResult.providerReference,
                errorCode: adapterResult.errorCode,
                metadata: adapterResult.metadata,
            });
            await recordChannelUsage({
                phone,
                channel: this.channelName,
                direction: 'outbound',
                units: 1,
                providerReference: adapterResult.providerReference,
                conversationId: userMessage.conversationId,
                metadata: {
                    source: 'shared-channel-handler',
                    delivery: delivery?.state || adapterResult.state,
                    external_delivery_confirmed: false,
                },
            });
            await this.onComplete(meta);

            return {
                status: 'success',
                response: reply,
                conversationId: userMessage.conversationId,
                deliveryState: delivery?.state || adapterResult.state,
            };
        } catch (error) {
            console.error(`[${this.channelName} Webhook] Error:`, error);
            return { status: 'error' };
        }
    }
}
