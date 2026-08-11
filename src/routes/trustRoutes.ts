/**
 * Trust boundary: disputes, scam reports, escrow.
 * Identity is derived from the authenticated session. Resource ownership is
 * checked before reading or mutating user-owned disputes and escrow records.
 */
import { Router } from 'express';
import { authenticateUser, authenticateAdmin, AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';
import {
  createDispute,
  getDisputeStatus,
  resolveDispute,
  escalateDispute,
} from '../services/disputeResolution.js';
import { releaseEscrow, refundEscrow } from '../services/escrow.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

async function getDisputeOwner(disputeId: number): Promise<string | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT phone FROM disputes WHERE id = ?`);
  stmt.bind([disputeId]);
  let phone: string | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    phone = row?.phone ? String(row.phone) : null;
  }
  stmt.free();
  return phone;
}

async function getEscrowParties(escrowId: number): Promise<{ buyer: string; provider: string } | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT buyer_phone, provider_phone FROM escrow WHERE id = ?`);
  stmt.bind([escrowId]);
  let parties: { buyer: string; provider: string } | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    if (row?.buyer_phone && row?.provider_phone) {
      parties = { buyer: String(row.buyer_phone), provider: String(row.provider_phone) };
    }
  }
  stmt.free();
  return parties;
}

router.post('/dispute/create', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const order_id = req.body?.order_id || req.body?.orderId;
  const reason = req.body?.reason;
  if (!order_id || !reason) return res.status(400).json({ error: 'Missing order_id or reason' });
  try {
    const disputeId = await createDispute(phone, String(order_id), String(reason));
    res.json({ success: true, disputeId, message: 'Dispute submitted successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

router.post('/disputes', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const order_id = req.body?.order_id || req.body?.orderId;
  const reason = req.body?.reason;
  if (!order_id || !reason) return res.status(400).json({ error: 'Missing order_id or reason' });
  try {
    const disputeId = await createDispute(phone, String(order_id), String(reason));
    res.json({ success: true, disputeId, message: 'Dispute submitted successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

router.post('/scam_reports', authenticateUser, async (req: AuthRequest, res) => {
  const reporter = sessionPhone(req);
  if (!reporter) return res.status(401).json({ error: 'Authentication required' });
  const reported_phone = req.body?.reported_phone;
  const description = req.body?.description;
  if (!reported_phone || !description) return res.status(400).json({ error: 'Missing reported_phone or description' });
  try {
    const db = await getDb();
    db.run(
      `INSERT INTO scam_reports (reporter_phone, reported_phone, description, status) VALUES (?, ?, ?, 'pending')`,
      [reporter, String(reported_phone), String(description)]
    );
    saveDb();
    res.json({ success: true, message: 'Scam report submitted successfully.' });
  } catch (e) {
    console.error('Failed to submit scam report:', e);
    res.status(500).json({ error: 'Failed to submit scam report' });
  }
});

router.get('/dispute/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const disputeId = parseInt(req.params.id, 10);
  if (isNaN(disputeId)) return res.status(400).json({ error: 'Invalid dispute ID' });
  try {
    const owner = await getDisputeOwner(disputeId);
    if (!owner) return res.status(404).json({ error: 'Dispute not found' });
    if (owner !== phone) return res.status(403).json({ error: 'Forbidden: not dispute owner' });
    const status = await getDisputeStatus(disputeId);
    res.json({ success: true, disputeId, status });
  } catch {
    res.status(500).json({ error: 'Failed to fetch dispute status' });
  }
});

router.post('/dispute/:id/resolve', authenticateAdmin, async (req: AuthRequest, res) => {
  const disputeId = parseInt(req.params.id, 10);
  const resolution = req.body?.resolution;
  if (isNaN(disputeId) || !resolution) return res.status(400).json({ error: 'Missing disputeId or resolution' });
  try {
    await resolveDispute(disputeId, String(resolution));
    res.json({ success: true, message: 'Dispute resolved successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

router.post('/dispute/:id/escalate', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const disputeId = parseInt(req.params.id, 10);
  if (isNaN(disputeId)) return res.status(400).json({ error: 'Invalid dispute ID' });
  try {
    const owner = await getDisputeOwner(disputeId);
    if (!owner) return res.status(404).json({ error: 'Dispute not found' });
    if (owner !== phone) return res.status(403).json({ error: 'Forbidden: not dispute owner' });
    await escalateDispute(disputeId);
    res.json({ success: true, message: 'Dispute escalated to admin review.' });
  } catch {
    res.status(500).json({ error: 'Failed to escalate dispute' });
  }
});

/**
 * Direct client escrow creation is deliberately disabled. The shared Economic
 * Request flow creates an internal ledger only after verified payment evidence
 * and a confirmed quote have been attached by a trusted payment adapter.
 */
router.post('/escrow/create', authenticateUser, async (_req: AuthRequest, res) => {
  res.status(409).json({
    error: 'Direct escrow creation is disabled; use the verified Economic Request payment flow.',
    payment_required: true,
  });
});

router.post('/escrow/release', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const escrowId = parseInt(String(req.body?.escrow_id || ''), 10);
  if (!Number.isInteger(escrowId)) return res.status(400).json({ error: 'escrow_id is required' });
  try {
    const parties = await getEscrowParties(escrowId);
    if (!parties) return res.status(404).json({ error: 'Escrow not found' });
    if (parties.buyer !== phone) return res.status(403).json({ error: 'Forbidden: only the buyer can release escrow' });
    const success = await releaseEscrow(escrowId);
    res.json({ success, message: success ? 'Escrow released to provider.' : 'Escrow is not eligible for release.' });
  } catch {
    res.status(500).json({ error: 'Failed to release escrow' });
  }
});

router.post('/escrow/refund', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const escrowId = parseInt(String(req.body?.escrow_id || ''), 10);
  if (!Number.isInteger(escrowId)) return res.status(400).json({ error: 'escrow_id is required' });
  try {
    const parties = await getEscrowParties(escrowId);
    if (!parties) return res.status(404).json({ error: 'Escrow not found' });
    if (parties.buyer !== phone && parties.provider !== phone) {
      return res.status(403).json({ error: 'Forbidden: escrow party required' });
    }
    const success = await refundEscrow(escrowId);
    res.json({ success, message: success ? 'Escrow refunded to buyer.' : 'Escrow is not eligible for refund.' });
  } catch {
    res.status(500).json({ error: 'Failed to refund escrow' });
  }
});

export default router;
