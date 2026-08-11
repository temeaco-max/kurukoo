import { getDb, saveDb } from '../database.js';

const STATUS_ORDER = ['escrow_held', 'driver_assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];
const TERMINAL_STATUSES = new Set(['cancelled', 'refunded', 'completed']);

export class DeliveryAuthorizationError extends Error {
    readonly statusCode = 403;
}

export class DeliveryStateError extends Error {
    readonly statusCode = 409;
}

/**
 * Delivery is an external operational workflow. Kurukoo must never invent a
 * driver, ETA, pickup, transit or delivery confirmation. Provider webhooks or
 * an authenticated operator call update the order state.
 */
export async function startDeliveryStatusService() {
    console.log('[Delivery Service] Initialized provider-driven delivery status listener. No simulated progression is enabled.');
}

export async function progressActiveOrders() {
    // Retained for backwards compatibility with older schedulers. It is
    // intentionally a no-op: real delivery providers must push status events.
    return;
}

function validTransition(current: string, next: string): boolean {
    if (current === next) return true;
    if (TERMINAL_STATUSES.has(current)) return false;
    if (TERMINAL_STATUSES.has(next)) return true;
    const currentIndex = STATUS_ORDER.indexOf(current);
    const nextIndex = STATUS_ORDER.indexOf(next);
    return currentIndex >= 0 && nextIndex === currentIndex + 1;
}

export async function updateDeliveryStatus(orderId: string, status: string, actorPhone: string, messageText?: string, database?: any) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) throw new DeliveryStateError('Delivery status is required');
    if (!actorPhone) throw new DeliveryAuthorizationError('Authenticated provider identity is required');

    const db = database || await getDb();
    const stmt = db.prepare(`SELECT * FROM orders WHERE id = ?`);
    let order: any = null;
    if (stmt.step()) order = stmt.getAsObject();
    stmt.free();
    if (!order) throw new DeliveryStateError(`Order ${orderId} not found`);
    if (!order.provider_phone) {
        throw new DeliveryStateError('Order has no assigned provider; delivery status cannot be changed');
    }
    if (String(order.provider_phone) !== actorPhone) {
        throw new DeliveryAuthorizationError('Only the assigned provider can update delivery status');
    }
    if (!validTransition(String(order.status), normalized)) {
        throw new DeliveryStateError(`Invalid delivery transition: ${order.status} -> ${normalized}`);
    }

    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [normalized, orderId]);
    const text = messageText && messageText.trim()
        ? messageText.trim().slice(0, 1_000)
        : `🚚 Delivery update for order #${orderId}: ${normalized.replace(/_/g, ' ')}.`;
    db.run(`INSERT INTO messages (phone, sender, content, channel, status) VALUES (?, 'assistant', ?, 'pwa', 'read')`, [order.phone, text]);
    db.run(`INSERT INTO audit_logs (action, details) VALUES (?, ?)`, [
        'delivery_status_updated',
        JSON.stringify({ orderId, phone: order.phone, oldStatus: order.status, newStatus: normalized, source: 'provider' })
    ]);
    if (!database) saveDb();

    const whatsappToken = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (whatsappToken && phoneId && order.phone) {
        try {
            const recipient = String(order.phone).replace(/^\+/, '');
            const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: recipient,
                    type: 'text',
                    text: { body: text }
                })
            });
            if (!response.ok) console.warn(`[Delivery Service] WhatsApp notification rejected with ${response.status}`);
        } catch (err) {
            console.warn('[Delivery Service] WhatsApp notification failed:', err instanceof Error ? err.message : err);
        }
    }

    return { success: true, orderId, status: normalized };
}
