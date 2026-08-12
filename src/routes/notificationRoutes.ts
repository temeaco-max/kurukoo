import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { getInternalNotifications, markNotificationRead } from '../services/pushNotifications.js';

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

