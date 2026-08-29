/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb, saveDb } from '../database.js';
import { freezeEscrowForOrder, refundEscrow, releaseEscrow } from './escrow.js';
import { getAllowedEconomicTransitions, getEconomicRequest, transitionEconomicRequest } from './skillFlows.js';
import { recordDisputeFault } from './trustScore.js';
import { reversePointsForMarker } from './pointsEngine.js';

export interface DisputeOpenResult {
    disputeId: number;
    escrowFrozen: boolean;
    economicRequestId: string | null;
}

export interface DisputeResolutionResult {
    disputeId: number;
    resolution: 'release' | 'refund';
    escrowUpdated: boolean;
    economicRequestId: string | null;
    orderStatus: string | null;
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

async function getDispute(disputeId: number): Promise<{ id: number; phone: string; orderId: string | null; status: string; resolution: string | null } | null> {
    const db = await getDb();
    const stmt = db.prepare(`SELECT id, phone, order_id, status, resolution FROM disputes WHERE id = ? LIMIT 1`);
    stmt.bind([disputeId]);
    let row: any = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    if (!row) return null;
    return {
        id: Number(row.id),
        phone: String(row.phone || ''),
        orderId: row.order_id == null ? null : String(row.order_id),
        status: String(row.status || ''),
        resolution: row.resolution == null ? null : String(row.resolution),
    };
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

export async function resolveDisputeWithEconomicLifecycle(disputeId: number, resolution: 'release' | 'refund', faultParty?: 'buyer' | 'provider'): Promise<DisputeResolutionResult> {
    const dispute = await getDispute(disputeId);
    if (!dispute) throw new Error('Dispute not found');
    if (!['open', 'escalated'].includes(dispute.status) && dispute.status !== 'resolved') throw new Error(`Dispute cannot be resolved from status ${dispute.status}`);

    const orderId = dispute.orderId;
    const linkedEconomicRequestId = orderId ? await findLinkedEconomicRequestId(orderId) : null;
    const db = await getDb();

    let escrowUpdated = false;
    let orderStatus: string | null = null;
    if (orderId) {
        const escrowStmt = db.prepare(`SELECT id, status FROM escrow WHERE order_id = ? AND status IN ('held', 'disputed') ORDER BY id DESC LIMIT 1`);
        escrowStmt.bind([orderId]);
        let escrowId: number | null = null;
        if (escrowStmt.step()) escrowId = Number(escrowStmt.getAsObject().id);
        escrowStmt.free();

        if (escrowId) {
            escrowUpdated = resolution === 'release'
                ? await releaseEscrow(escrowId, { force: true })
                : await refundEscrow(escrowId);
            if (!escrowUpdated) throw new Error('Escrow could not be updated for this dispute');
        }

        orderStatus = resolution === 'release' ? 'completed' : 'refunded';
        db.run(`UPDATE orders SET status = ? WHERE id = ?`, [orderStatus, orderId]);
    }

    if (linkedEconomicRequestId) {
        const linkedRequest = await getEconomicRequest(linkedEconomicRequestId);
        if (linkedRequest && linkedRequest.status === 'disputed') {
            const target = resolution === 'release' ? 'completed' : 'cancelled';
            if (getAllowedEconomicTransitions(linkedRequest.status).includes(target)) {
                await transitionEconomicRequest(linkedEconomicRequestId, target, {
                    fulfillment: {
                        ...(linkedRequest.fulfillment || {}),
                        dispute_resolved_at: new Date().toISOString(),
                        dispute_resolution: resolution,
                    },
                });
            }
        }
    }

    db.run(`UPDATE disputes SET status = 'resolved', resolution = ? WHERE id = ?`, [
        resolution === 'release' ? 'Admin resolution: escrow released.' : 'Admin resolution: escrow refunded.',
        disputeId,
    ]);
    saveDb();

    // Trust-score recalculation after dispute resolution (Blueprint §15.1).
    // When the admin explicitly declares a fault party it takes priority;
    // otherwise, release (escrow to provider) implicates the buyer, and
    // refund (escrow to buyer) implicates the provider.
    let effectiveFaultParty: 'buyer' | 'provider' | undefined = faultParty;
    if (!effectiveFaultParty) {
      effectiveFaultParty = resolution === 'release' ? 'buyer' : 'provider';
    }
    let faultPhone = dispute.phone;
    if (effectiveFaultParty === 'provider' && orderId) {
      const providerStmt = db.prepare('SELECT provider_phone FROM orders WHERE id = ? LIMIT 1');
      providerStmt.bind([orderId]);
      const row = providerStmt.step() ? providerStmt.getAsObject() as Record<string, unknown> : null;
      providerStmt.free();
      if (row) faultPhone = String((row.provider_phone as string) || dispute.phone || '');
    }
    if (faultPhone) {
      try {
        await recordDisputeFault(disputeId, effectiveFaultParty, faultPhone);
      } catch (err) {
        // Trust-score update is a secondary concern; dispute resolution must not fail.
        console.error('[Dispute] trust score recalculation failed:', err);
      }
    }

    // Points reversal: when a refund invalidates a completed outcome, any
    // Points awarded for that outcome's escrow release must be reversed so
    // invalid events never retain rewards. Secondary concern — never blocks
    // dispute resolution.
    if (resolution === 'refund' && orderId && faultPhone) {
      try {
        const escrowIdStmt = db.prepare('SELECT id FROM escrow WHERE order_id = ? ORDER BY id DESC LIMIT 1');
        escrowIdStmt.bind([orderId]);
        if (escrowIdStmt.step()) {
          const escrowId = String((escrowIdStmt.getAsObject() as any).id);
          escrowIdStmt.free();
          await reversePointsForMarker(faultPhone, `escrow_release:${escrowId}`, 'Points reversal: dispute refund invalidated this outcome');
        } else {
          escrowIdStmt.free();
        }
      } catch (err) {
        console.error('[Dispute] points reversal failed:', err);
      }
    }

    return { disputeId, resolution, escrowUpdated, economicRequestId: linkedEconomicRequestId, orderStatus };
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
