import { getDb, saveDb } from '../database.js';
import { addPoints } from './pointsEngine.js';
import { getCommission } from './commissionService.js';
import { processDirectPayment } from './directWallet.js';
import { createEconomicRequest, getEconomicCategory } from './skillFlows.js';

export async function getLeadCharge(orderType: string): Promise<number> {
    const ot = orderType.toLowerCase();
    if (ot.includes('okada') || ot.includes('keke') || ot.includes('car') || ot.includes('taxi') || ot.includes('ride')) return await getCommission('provider_lead_ride');
    if (ot.includes('bicycle') || ot.includes('delivery')) return await getCommission('provider_lead_delivery');
    if (ot.includes('hawker') || ot.includes('food')) return await getCommission('provider_lead_food');
    if (ot.includes('barrow') || ot.includes('truck')) return await getCommission('provider_lead_truck');
    return await getCommission('provider_lead_professional');
}

/**
 * Finalise an economic transaction only when the caller has supplied an
 * explicit execution context. Chat intent detection intentionally lands in
 * `awaiting_confirmation`; it must never silently select a provider, charge a
 * wallet, lock escrow, or mark fulfilment complete merely because a user sent
 * an intent message.
 */
export async function finalizeOrder(buyerPhone: string, arg2: string = '', arg3: any = {}, arg4?: any): Promise<{ success: boolean; message: string; orderId?: string }> {
    let providerPhone = '';
    let orderType = '';
    let details: { skill?: string; amount?: number; bookingMode?: string; idempotencyKey?: string } = {};
    const db = await getDb();
    const creditEconomyEnabled = process.env.CREDIT_ECONOMY_ENABLED !== 'false';

    if (arg4 !== undefined) {
        providerPhone = arg2;
        orderType = arg3;
        details = arg4 || {};
    } else {
        details = arg3 || {};
        orderType = details.skill || arg2 || 'general_service';

        if (orderType === 'universal_vendor_order') {
            const idempotencyKey = details.idempotencyKey || `vendor:${buyerPhone}:${Date.now()}`;
            const existing = db.prepare('SELECT id, status FROM orders WHERE idempotency_key = ?');
            existing.bind([idempotencyKey]);
            if (existing.step()) {
                const row = existing.getAsObject(); existing.free();
                return { success: true, message: `Vendor order is already awaiting confirmation. Status: ${row.status}`, orderId: row.id as string };
            }
            existing.free();
            const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            db.run(`INSERT INTO orders (id, phone, order_type, provider_phone, amount, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)`, [orderId, buyerPhone, orderType, null, 0, 'awaiting_confirmation', idempotencyKey]);
            db.run(`INSERT INTO audit_logs (action, details) VALUES (?, ?)`, ['vendor_order_started', JSON.stringify({ orderId, buyerPhone, next: 'confirm_item_quantity_location' })]);
            saveDb();
            return { success: true, message: 'Vendor order started. Confirm the item, quantity and delivery location before escrow is locked.', orderId };
        }

        // Non-economic chat skills (balance, radar, life-admin, general AI)
        // should never become fake orders merely because the chat router uses a
        // common result shape.
        const economicCategory = getEconomicCategory(orderType);
        if (!economicCategory) return { success: true, message: '' };

        const hasExplicitExecution = arg4 !== undefined || !!details.bookingMode || (typeof details.amount === 'number' && details.amount > 0);
        if (!hasExplicitExecution) {
            const idempotencyKey = details.idempotencyKey || `request:${buyerPhone}:${orderType}`;
            const existing = db.prepare('SELECT id, status FROM orders WHERE idempotency_key = ? LIMIT 1');
            existing.bind([idempotencyKey]);
            if (existing.step()) {
                const row = existing.getAsObject(); existing.free();
                return { success: true, message: `Your ${orderType.replace(/_/g, ' ')} request is already awaiting confirmation.`, orderId: row.id as string };
            }
            existing.free();
            const orderId = `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            db.run(`INSERT INTO orders (id, phone, order_type, provider_phone, amount, status, idempotency_key) VALUES (?, ?, ?, NULL, 0, 'awaiting_confirmation', ?)`, [orderId, buyerPhone, orderType, idempotencyKey]);
            await createEconomicRequest({ id: orderId, phone: buyerPhone, skill: orderType, requirements: {} });
            db.run(`INSERT INTO audit_logs (action, details) VALUES (?, ?)`, ['economic_request_started', JSON.stringify({ orderId, buyerPhone, orderType, category: economicCategory, next: 'capture_requirements_and_confirm' })]);
            saveDb();
            return { success: true, message: 'Request started. I’ll collect the missing details and show you the provider, price and terms before anything is committed.', orderId };
        }

        const idempotencyKey = details.idempotencyKey || null;
        if (idempotencyKey) {
            const existing = db.prepare('SELECT id, status FROM orders WHERE idempotency_key = ?');
            existing.bind([idempotencyKey]);
            if (existing.step()) {
                const row = existing.getAsObject(); existing.free();
                return { success: true, message: `Order is already in progress. Status: ${row.status}`, orderId: row.id as string };
            }
            existing.free();
        }

        const stmt = db.prepare(`SELECT s.phone, ps.status, ps.leads_this_month, ps.tier FROM skills s JOIN memory_profiles m ON s.phone = m.phone LEFT JOIN provider_subscriptions ps ON s.phone = ps.phone WHERE s.skill = ? AND s.is_available = 1 AND ps.status = 'active' LIMIT 1`);
        stmt.bind([orderType]);
        let found = false;
        if (stmt.step()) {
            const row = stmt.getAsObject();
            const limit = row.tier === 'Plus' ? 100 : (row.tier === 'Business' ? 1000 : 30);
            if ((row.leads_this_month as number) < limit) { providerPhone = row.phone as string; found = true; }
        }
        stmt.free();
        if (!found) {
            const fallbackStmt = db.prepare(`SELECT s.phone FROM skills s LEFT JOIN provider_subscriptions ps ON s.phone = ps.phone WHERE s.is_available = 1 AND ps.status = 'active' LIMIT 1`);
            if (fallbackStmt.step()) providerPhone = fallbackStmt.getAsObject().phone as string;
            fallbackStmt.free();
        }
    }

    const idempotencyKey = details.idempotencyKey || null;
    if (idempotencyKey) {
        const checkStmt = db.prepare(`SELECT id, status FROM orders WHERE idempotency_key = ?`);
        checkStmt.bind([idempotencyKey]);
        if (checkStmt.step()) {
            const existing = checkStmt.getAsObject(); checkStmt.free();
            return { success: true, message: `Order retrieved from cache (idempotent). Status: ${existing.status}`, orderId: existing.id as string };
        }
        checkStmt.free();
    }

    const clientStmt = db.prepare(`SELECT subscription_tier FROM memory_profiles WHERE phone = ?`);
    clientStmt.bind([buyerPhone]);
    let clientTier = 'Base';
    if (clientStmt.step()) clientTier = clientStmt.getAsObject().subscription_tier as string;
    clientStmt.free();

    if (!providerPhone) return { success: false, message: 'No verified provider is currently available. Your request can remain deferred for re-matching.' };

    if (arg4 !== undefined) {
        const provSubStmt = db.prepare(`SELECT tier, status, leads_this_month FROM provider_subscriptions WHERE phone = ?`);
        provSubStmt.bind([providerPhone]);
        if (provSubStmt.step()) {
            const row = provSubStmt.getAsObject();
            const limit = row.tier === 'Plus' ? 100 : (row.tier === 'Business' ? 1000 : 30);
            if (row.status !== 'active' || (row.leads_this_month as number) >= limit) { provSubStmt.free(); return { success: false, message: 'Provider subscription inactive or leads exhausted.' }; }
        } else { provSubStmt.free(); return { success: false, message: 'Provider subscription inactive.' }; }
        provSubStmt.free();
    }

    const isInstant = details.bookingMode === 'instant' || !details.bookingMode;
    const orderId = `ord_${Math.floor(Math.random() * 1000000)}`;
    const jobAmount = details.amount || 0;

    db.run(`UPDATE provider_subscriptions SET leads_this_month = leads_this_month + 1 WHERE phone = ?`, [providerPhone]);

    if (!creditEconomyEnabled) {
        if (jobAmount > 0) {
            const paid = await processDirectPayment(buyerPhone, providerPhone, jobAmount);
            if (!paid) {
                db.run(`UPDATE provider_subscriptions SET leads_this_month = leads_this_month - 1 WHERE phone = ?`, [providerPhone]);
                return { success: false, message: 'Fulfillment failed due to direct payment error.' };
            }
        }
    } else if (!isInstant && jobAmount > 0) {
        const escrowDeducted = await processDirectPayment(buyerPhone, 'ESCROW', jobAmount);
        // This legacy finalizer does not receive a trusted payment reference.
        // Even if an adapter later reports a debit, it must hand off through the
        // Economic Request payment flow before a ledger can be created.
        db.run(`UPDATE provider_subscriptions SET leads_this_month = leads_this_month - 1 WHERE phone = ?`, [providerPhone]);
        saveDb();
        if (!escrowDeducted) {
            return { success: false, message: `Verified payment is required before escrow can be created. Required: ₦${jobAmount}.` };
        }
        return { success: false, message: 'Payment reference verification must complete through the Economic Request flow before escrow can be created.' };
    }

    db.run(`INSERT INTO orders (id, phone, order_type, provider_phone, amount, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)`, [orderId, buyerPhone, orderType, providerPhone, jobAmount, isInstant ? 'completed' : 'escrow_held', idempotencyKey]);
    db.run(`INSERT INTO audit_logs (action, details) VALUES (?, ?)`, ['order_finalized', JSON.stringify({ orderId, buyerPhone, providerPhone, orderType, isInstant, clientTier })]);
    saveDb();
    return { success: true, message: `Matched successfully with verified provider.${isInstant ? ' Match complete.' : ' Escrow payment secured.'}`, orderId };
}
