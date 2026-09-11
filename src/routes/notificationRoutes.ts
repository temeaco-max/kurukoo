/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { getInternalNotifications, markNotificationRead } from '../services/pushNotifications.js';
import { listAgentGoals } from '../services/agentRuntime.js';
import { getAgentGoalContinuation } from '../services/agentGoalContinuation.js';

const router = Router();

function phoneFromRequest(req: AuthRequest): string {
  return String(req.user?.phone || '');
}

function clientNotification(notification: any) {
  const createdAt = notification.createdAt ?? notification.created_at ?? null;
  const read = Boolean(notification.read ?? notification.status === 'read');
  return {
    ...notification,
    read,
    readAt: notification.readAt ?? notification.read_at ?? (read ? createdAt : null),
    createdAt,
    deliveryState: notification.deliveryState ?? notification.delivery_state ?? null,
  };
}

router.get('/notifications', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const notifications = await getInternalNotifications(phoneFromRequest(req), limit);
    res.json({ success: true, notifications: notifications.map(clientNotification) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to load notifications' });
  }
});

router.get('/notifications/summary', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const ownerPhone = phoneFromRequest(req);
    const notifications = await getInternalNotifications(ownerPhone, 100);
    const goals = await listAgentGoals(ownerPhone);
    const activeWork = (await Promise.all(goals.slice(0, 5).map(async goal => getAgentGoalContinuation(ownerPhone, goal.id)))).filter(Boolean);
    const unread = notifications.filter((notification: any) => !notification.read && !notification.read_at && notification.status !== 'read');
    const actionable = unread.filter((notification: any) => {
      const text = `${notification.title || ''} ${notification.body || ''}`.toLowerCase();
      return Boolean(notification.link) || /action|confirm|approve|quote|update|ready|complete|waiting|needs|request|task|booking|order/.test(text);
    });
    res.json({
      success: true,
      unreadCount: unread.length,
      actionableCount: actionable.length,
      latest: unread.slice(0, 5).map(clientNotification),
      activeWork,
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
