import { getDb, saveDb } from '../database.js';
import { freezeEscrowForOrder } from './escrow.js';
import { getAllowedEconomicTransitions, getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';

export interface DisputeOpenResult {
    disputeId: number;
    escrowFrozen: boolean;
    economicRequestId: string | null;
}

async function findLinkedEconomicRequestId(orderId: string): Promise<string | null> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT id FROM economic_requests WHERE fulfillment_json LIKE ? ORDER BY updated_at DESC LIMIT 1`);
    stmt.bind([`%${orderId}%`]);
    let requestId: string | null = null;
    if (stmt.step()) requestId = String(stmt.getAsObject().id);
    stmt.free();
    return requestId;
}

export async function createDispute(phone: string, orderId: string, reason: string): Promise<DisputeOpenResult> {
    const cleanPhone = String(phone || '').trim();
    const cleanOrderId = String(orderId || '').trim();
    const cleanReason = String(reason || '').trim();
    if (!cleanPhone || !cleanOrderId || !cleanReason) throw new Error('Dispute buyer, order, and reason are required');

    const db = await getDb();
    const orderStmt = db.prepare(`SELECT phone FROM orders WHERE id = ? LIMIT 1`);
    orderStmt.bind([cleanOrderId]);
    const order = orderStmt.step() ? orderStmt.getAsObject() as { phone?: unknown } : null;
    orderStmt.free();
    if (!order) throw new Error('Order not found');
    if (String(order.phone || '') !== cleanPhone) throw new Error('Only the order buyer can open a dispute');

    const existingStmt = db.prepare(`SELECT id FROM disputes WHERE phone = ? AND order_id = ? AND status IN ('open', 'escalated') ORDER BY id DESC LIMIT 1`);
    existingStmt.bind([cleanPhone, cleanOrderId]);
    if (existingStmt.step()) {
        const disputeId = Number(existingStmt.getAsObject().id);
        existingStmt.free();
        return { disputeId, escrowFrozen: true, economicRequestId: await findLinkedEconomicRequestId(cleanOrderId) };
    }
    existingStmt.free();

    const linkedRequestId = await findLinkedEconomicRequestId(cleanOrderId);
    let linkedRequest: Awaited<ReturnType<typeof getEconomicRequest>> = null;
    if (linkedRequestId) {
        linkedRequest = await getEconomicRequest(linkedRequestId);
        if (!linkedRequest || linkedRequest.phone !== cleanPhone) throw new Error('Linked economic request ownership mismatch');
        if (linkedRequest.status !== 'disputed' && !getAllowedEconomicTransitions(linkedRequest.status).includes('disputed')) {
            throw new Error(`Invalid economic request transition: ${linkedRequest.status} -> disputed`);
        }
    }

    const escrowFrozen = await freezeEscrowForOrder(cleanOrderId, cleanReason);
    if (!escrowFrozen) throw new Error('No held escrow is available to freeze for this order');

    if (linkedRequestId && linkedRequest && linkedRequest.status !== 'disputed') {
        await transitionEconomicRequest(linkedRequestId, 'disputed', {
            fulfillment: {
                ...(linkedRequest.fulfillment || {}),
                dispute_requested_at: new Date().toISOString(),
                dispute_reason: cleanReason,
            },
        });
    }

    db.run(
        `INSERT INTO disputes (phone, order_id, reason, status, type) VALUES (?, ?, ?, 'open', 'dispute')`,
        [cleanPhone, cleanOrderId, cleanReason]
    );
    const result = db.exec(`SELECT last_insert_rowid() AS id`);
    const disputeId = Number(result[0]?.values[0]?.[0]);
    saveDb();
    return { disputeId, escrowFrozen, economicRequestId: linkedRequestId };
}

export async function resolveDispute(disputeId: number, resolution: string): Promise<void> {
    const db = await getDb();
    db.run(`UPDATE disputes SET status = 'resolved', resolution = ? WHERE id = ?`, [resolution, disputeId]);
    saveDb();
}

export async function escalateDispute(disputeId: number): Promise<void> {
    const db = await getDb();
    db.run(`UPDATE disputes SET status = 'escalated' WHERE id = ?`, [disputeId]);
    saveDb();
}

export async function getDisputeStatus(disputeId: number): Promise<string | null> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT status FROM disputes WHERE id = ?`);
    stmt.bind([disputeId]);
    let status: string | null = null;
    if (stmt.step()) status = String(stmt.getAsObject().status);
    stmt.free();
    return status;
}
