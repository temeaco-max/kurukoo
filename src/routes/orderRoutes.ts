/**
 * Order / delivery routes — JWT identity only.
 * Mounted by wire-security-routes.mjs / index composition.
 * Identity is always derived from the authenticated session; never from
 * a client-supplied phone.
 */
import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { DeliveryAuthorizationError, DeliveryStateError, updateDeliveryStatus } from '../services/deliveryService.js';
import { finalizeOrder } from '../services/orderFinalizer.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

/** List the authenticated user's past orders */
router.get('/orders', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC`);
    stmt.bind([phone]);
    const orders: any[] = [];
    while (stmt.step()) orders.push(stmt.getAsObject());
    stmt.free();
    res.json(orders);
  } catch (err: any) {
    console.error('[OrderRoutes] Error retrieving orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Get a single order owned by the authenticated user */
router.get('/orders/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const orderId = req.params.id;
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM orders WHERE id = ? AND phone = ?`);
    stmt.bind([orderId, phone]);
    let order: any = null;
    if (stmt.step()) order = stmt.getAsObject();
    stmt.free();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err: any) {
    console.error('[OrderRoutes] Error fetching order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Create an order via the shared order finalizer (lead/order/booking) */
router.post('/orders', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const { orderType, skill, details } = req.body || {};
  if (!orderType || !skill) {
    return res.status(400).json({ error: 'orderType and skill are required' });
  }
  try {
    const result = await finalizeOrder(phone, orderType, { skill, ...(details || {}) });
    res.status(201).json(result);
  } catch (err: any) {
    console.error('[OrderRoutes] Error creating order:', err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

/** Update delivery status — provider-driven, validated transition */
router.post('/orders/:id/delivery-status', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const orderId = req.params.id;
  const { status, message } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status is required' });
  try {
    await updateDeliveryStatus(orderId, String(status), phone, message ? String(message) : undefined);
    res.json({ success: true, message: `Order ${orderId} updated to ${status}.` });
  } catch (err: any) {
    if (err instanceof DeliveryAuthorizationError) return res.status(403).json({ error: err.message });
    if (err instanceof DeliveryStateError) return res.status(err.statusCode).json({ error: err.message });
    console.error('[OrderRoutes] Error updating delivery status:', err);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

/** Delivery status lookup for the authenticated user's order */
router.get('/delivery/status', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const orderId = typeof req.query.order_id === 'string' ? req.query.order_id : undefined;
  if (!orderId) return res.status(400).json({ error: 'order_id is required' });
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT id, status, message, updated_at FROM orders WHERE id = ? AND phone = ?`);
    stmt.bind([orderId, phone]);
    let order: any = null;
    if (stmt.step()) order = stmt.getAsObject();
    stmt.free();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ status: order.status, message: order.message || null, updatedAt: order.updated_at });
  } catch (err: any) {
    console.error('[OrderRoutes] Error fetching delivery status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { router as orderRoutes };