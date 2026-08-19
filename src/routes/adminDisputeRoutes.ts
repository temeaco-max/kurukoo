import { Router } from 'express';
import { authenticateAdmin, type AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';
import { escalateDispute, resolveDispute, resolveDisputeWithEconomicLifecycle } from '../services/disputeResolution.js';

const router = Router();

router.post('/disputes/resolve', authenticateAdmin, async (req: AuthRequest, res) => {
  const disputeId = Number(req.body?.disputeId);
  const action = String(req.body?.action || '');
  if (!Number.isInteger(disputeId) || disputeId <= 0) return res.status(400).json({ success: false, error: 'A valid disputeId is required.' });
  if (!['release', 'refund'].includes(action)) return res.status(400).json({ success: false, error: 'Action must be release or refund.' });

  try {
    const result = await resolveDisputeWithEconomicLifecycle(disputeId, action as 'release' | 'refund');
    const db = await getDb();
    const dispute = db.exec('SELECT phone, order_id FROM disputes WHERE id = ? LIMIT 1', [disputeId])[0]?.values?.[0];
    if (dispute) {
      const message = `[Admin Dispute Resolution] Your dispute #${disputeId} regarding Order #${dispute[1] || 'N/A'} has been resolved. The held escrow fund was ${action === 'release' ? 'released to the provider' : 'refunded back to your wallet'}.`;
      db.run(`INSERT INTO messages (phone, sender, content, channel) VALUES (?, 'assistant', ?, 'pwa')`, [dispute[0], message]);
      saveDb();
    }
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Unable to resolve dispute.' });
  }
});

router.post('/disputes/escalate', authenticateAdmin, async (req: AuthRequest, res) => {
  const disputeId = Number(req.body?.disputeId);
  if (!Number.isInteger(disputeId) || disputeId <= 0) return res.status(400).json({ success: false, error: 'A valid disputeId is required.' });

  try {
    const db = await getDb();
    const row = db.exec('SELECT phone, status FROM disputes WHERE id = ? LIMIT 1', [disputeId])?.[0]?.values?.[0];
    if (!row) return res.status(404).json({ success: false, error: 'Dispute not found.' });
    if (!['open', 'escalated'].includes(String(row[1] || ''))) return res.status(409).json({ success: false, error: `Dispute cannot be escalated from status ${row[1] || 'unknown'}.` });

    await escalateDispute(disputeId);
    const message = `[Admin Dispute Escalation] Your dispute #${disputeId} has been escalated for secondary review.`;
    db.run(`INSERT INTO messages (phone, sender, content, channel) VALUES (?, 'assistant', ?, 'pwa')`, [row[0], message]);
    saveDb();
    return res.json({ success: true, disputeId, status: 'escalated' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unable to escalate dispute.' });
  }
});

router.post('/tickets/reply', authenticateAdmin, async (req: AuthRequest, res) => {
  const disputeId = Number(req.body?.disputeId);
  const replyMessage = String(req.body?.replyMessage || '').trim();
  if (!Number.isInteger(disputeId) || disputeId <= 0 || !replyMessage) return res.status(400).json({ success: false, error: 'A valid disputeId and replyMessage are required.' });

  try {
    const db = await getDb();
    const dispute = db.exec('SELECT phone, order_id FROM disputes WHERE id = ? LIMIT 1', [disputeId])?.[0]?.values?.[0];
    if (!dispute) return res.status(404).json({ success: false, error: 'Ticket/Dispute not found.' });

    await resolveDispute(disputeId, replyMessage);
    const message = `[Admin Support Reply] Regarding Ticket #${disputeId}: ${replyMessage}`;
    db.run(`INSERT INTO messages (phone, sender, content, channel) VALUES (?, 'assistant', ?, 'pwa')`, [dispute[0], message]);
    saveDb();
    return res.json({ success: true, disputeId, status: 'resolved', message: 'Ticket resolved and reply sent.' });
  } catch (error) {
    return res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Unable to reply and resolve ticket.' });
  }
});

export default router;
