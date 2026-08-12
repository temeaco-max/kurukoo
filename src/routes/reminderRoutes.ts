import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { cancelReminder, createReminder, listReminders } from '../services/reminderService.js';

const router = Router();
router.use(authenticateUser);

function phoneFromRequest(req: AuthRequest): string {
  return String(req.user?.phone || '');
}

router.get('/reminders', async (req: AuthRequest, res) => {
  try {
    const phone = phoneFromRequest(req);
    const reminders = await listReminders(phone, String(req.query.includeCompleted || '') === 'true');
    res.json({ success: true, reminders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to load reminders' });
  }
});

router.post('/reminders', async (req: AuthRequest, res) => {
  try {
    const reminder = await createReminder(phoneFromRequest(req), {
      title: String(req.body?.title || ''),
      note: req.body?.note ? String(req.body.note) : undefined,
      dueAt: String(req.body?.dueAt || ''),
      recurrence: req.body?.recurrence ? String(req.body.recurrence) : null,
    });
    res.status(201).json({ success: true, reminder });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Unable to create reminder' });
  }
});

router.post('/reminders/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const cancelled = await cancelReminder(phoneFromRequest(req), String(req.params.id));
    if (!cancelled) return res.status(404).json({ success: false, error: 'Reminder not found or already resolved' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Unable to cancel reminder' });
  }
});

export default router;
