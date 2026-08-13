import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { getInternalNotifications, markNotificationRead } from '../services/pushNotifications.js';
import { listCommunicationConsents, recordCommunicationConsent } from '../services/communicationOutbox.js';
import { actOnOpportunity, dismissOpportunity, getOpportunitiesForFeed } from '../services/opportunityEngine.js';

const router = Router();

function phoneFromRequest(req: AuthRequest): string {
  return String(req.user?.phone || '');
}

router.get('/notifications', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const notifications = await getInternalNotifications(phoneFromRequest(req), limit);
    res.json({ success: true, notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to load notifications' });
  }
});

router.get('/notifications/preferences', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFromRequest(req);
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  try {
    res.json({ success: true, preferences: await listCommunicationConsents(phone) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to load communication preferences' });
  }
});

router.put('/notifications/preferences/:channel', authenticateUser, async (req: AuthRequest, res) => {
  const phone = phoneFromRequest(req);
  const channel = String(req.params.channel || '').trim().toLowerCase();
  const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim().toLowerCase() : 'all';
  const consent = req.body?.consent;
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
  if (!['sms', 'whatsapp', 'telegram'].includes(channel)) return res.status(400).json({ success: false, error: 'Unsupported external communication channel' });
  if (!['granted', 'denied'].includes(consent)) return res.status(400).json({ success: false, error: 'consent must be granted or denied' });
  if (!/^[a-z0-9_:-]{1,64}$/.test(purpose)) return res.status(400).json({ success: false, error: 'Invalid communication purpose' });
  try {
    await recordCommunicationConsent({
      phone,
      channel,
      purpose,
      state: consent,
      source: 'account_setting',
      expiresAt: typeof req.body?.expiresAt === 'string' && req.body.expiresAt.trim() ? req.body.expiresAt.trim() : undefined,
    });
    res.json({ success: true, channel, purpose, consent, message: consent === 'granted' ? 'External communication consent recorded. Delivery still depends on configured transport and provider receipts.' : 'External communication delivery is suppressed for this preference.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Unable to update communication preference' });
  }
});

router.get('/opportunities', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const phone = phoneFromRequest(req);
    if (!phone) return res.status(401).json({ success: false, error: 'Authenticated phone is required' });
    res.json({ success: true, opportunities: await getOpportunitiesForFeed(phone) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to load personalised suggestions' });
  }
});

router.post('/opportunities/:id/act', authenticateUser, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid opportunity id' });
  try {
    const result = await actOnOpportunity(id, phoneFromRequest(req));
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Unable to review suggestion' });
  }
});

router.post('/opportunities/:id/dismiss', authenticateUser, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid opportunity id' });
  try {
    const dismissed = await dismissOpportunity(id, phoneFromRequest(req));
    if (!dismissed) return res.status(404).json({ success: false, error: 'Suggestion not found or already dismissed' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Unable to dismiss suggestion' });
  }
});

router.post('/notifications/:id/read', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid notification id' });
    const updated = await markNotificationRead(id, phoneFromRequest(req));
    if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to mark notification read' });
  }
});

export default router;

