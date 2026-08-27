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

router.get('/notifications/summary', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const notifications = await getInternalNotifications(phoneFromRequest(req), 100);
    const unread = notifications.filter((notification: any) => !notification.read && !notification.read_at);
    const actionable = unread.filter((notification: any) => {
      const text = `${notification.title || ''} ${notification.body || ''}`.toLowerCase();
      return Boolean(notification.link) || /action|confirm|approve|quote|update|ready|complete|waiting|needs|request|task|booking|order/.test(text);
    });
    res.json({
      success: true,
      unreadCount: unread.length,
      actionableCount: actionable.length,
      latest: unread.slice(0, 5),
      returnToChatPrompt: unread.length > 0
        ? actionable.length > 0
          ? 'Welcome back. You have updates that may need your attention. Would you like an update?'
          : 'Welcome back. You have updates from Kurukoo. Would you like an update?'
        : null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to load notification summary' });
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

