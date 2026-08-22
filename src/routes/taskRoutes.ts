/**
 * Work boundary: appointments + micro-tasks.
 * Identity comes from the authenticated session; task ownership is enforced
 * by the underlying task service.
 */
import { Router } from 'express';
import { authenticateAdmin, authenticateUser, AuthRequest } from '../middleware/auth.js';
import { bookAppointment } from '../services/appointmentService.js';
import { createTopicVerificationTask, getAvailableTasks, acceptTask, completeTask, moderateTopicVerificationTask, TaskStateConflictError } from '../services/microTasks.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function taskStateError(res: any, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof TaskStateConflictError ? error.statusCode : 500;
  res.status(status).json({ error: message || fallback });
}

router.post('/admin/tasks/topic-verification', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const task = await createTopicVerificationTask({ topicId: String(req.body?.topicId || ''), verificationKind: String(req.body?.verificationKind || ''), creditsReward: Number(req.body?.creditsReward) });
    res.status(201).json({ task: { ...task, sourceType: 'topic', sourceId: String((task as any)?.source_id || req.body?.topicId) } });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create Topic verification task' }); }
});

router.post('/admin/tasks/:id/moderate', authenticateAdmin, async (req: AuthRequest, res) => {
  const taskId = positiveInteger(req.params.id);
  if (!taskId) return res.status(400).json({ error: 'A positive task id is required' });
  try {
    const task = await moderateTopicVerificationTask(taskId, String(req.user?.phone || req.user?.username || 'admin'), String(req.body?.decision || ''), req.body?.note);
    res.json({ task });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to moderate task' }); }
});

router.post('/appointments/book', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && String(req.body.phone) !== phone) {
    return res.status(403).json({ error: 'Forbidden: phone must match session' });
  }
  const providerPhone = typeof req.body?.provider_phone === 'string' ? req.body.provider_phone.trim() : '';
  const slotTime = typeof req.body?.slot_time === 'string' ? req.body.slot_time.trim() : '';
  if (!providerPhone || !slotTime || providerPhone === phone) {
    return res.status(400).json({ error: 'A valid provider_phone and slot_time are required' });
  }
  const parsedSlot = Date.parse(slotTime);
  if (!Number.isFinite(parsedSlot) || parsedSlot <= Date.now()) {
    return res.status(400).json({ error: 'slot_time must be a valid future date/time' });
  }
  try {
    const appointmentId = await bookAppointment(phone, providerPhone, slotTime);
    res.json({ success: true, appointmentId, message: 'Appointment booked successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

router.get('/tasks', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.query?.phone && String(req.query.phone) !== phone) {
    return res.status(403).json({ error: 'Forbidden: phone must match session' });
  }
  try {
    const tasks = await getAvailableTasks(phone);
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks/accept', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && String(req.body.phone) !== phone) {
    return res.status(403).json({ error: 'Forbidden: phone must match session' });
  }
  const taskId = positiveInteger(req.body?.taskId ?? req.body?.task_id);
  if (!taskId) return res.status(400).json({ error: 'A positive taskId is required' });
  try {
    const task = await acceptTask(phone, taskId);
    res.json({ success: true, task });
  } catch (error) {
    taskStateError(res, error, 'Failed to accept task');
  }
});

router.post('/tasks/complete', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && String(req.body.phone) !== phone) {
    return res.status(403).json({ error: 'Forbidden: phone must match session' });
  }
  const taskId = positiveInteger(req.body?.taskId ?? req.body?.task_id);
  if (!taskId) return res.status(400).json({ error: 'A positive taskId is required' });
  const result = typeof req.body?.result === 'string' ? req.body.result : '';
  try {
    const response = await completeTask(phone, taskId, result);
    res.status((response as any).sourceType === 'topic' ? 201 : 200).json(response);
  } catch (error) {
    taskStateError(res, error, 'Failed to complete task');
  }
});

export default router;
