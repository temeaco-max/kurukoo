/**
 * Work boundary: appointments + micro-tasks.
 * Identity comes from the authenticated session; task ownership is enforced
 * by the underlying task service.
 */
import { Router } from 'express';
import { authenticateAdmin, authenticateUser, AuthRequest } from '../middleware/auth.js';
import { bookAppointment } from '../services/appointmentService.js';
import { getAvailableTasks, getContributorTasks, getSubmittedTasks, acceptTask, completeTask, submitTaskEvidence, moderateTask, createTopicVerificationTask } from '../services/microTasks.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

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

router.get('/tasks/mine', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.query?.phone && String(req.query.phone) !== phone) return res.status(403).json({ error: 'Forbidden: phone must match session' });
  try { res.json({ success: true, tasks: await getContributorTasks(phone) }); }
  catch { res.status(500).json({ error: 'Failed to fetch contributor tasks' }); }
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
    const result = await acceptTask(phone, taskId);
    res.json(result);
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : 'Failed to accept task' });
  }
});

router.post('/tasks/evidence', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ error: 'Forbidden: phone must match session' });
  const taskId = positiveInteger(req.body?.taskId ?? req.body?.task_id);
  if (!taskId) return res.status(400).json({ error: 'A positive taskId is required' });
  try { res.status(201).json(await submitTaskEvidence(phone, taskId, req.body?.evidence)); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Failed to submit task evidence' }); }
});

router.post('/tasks/complete', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && String(req.body.phone) !== phone) {
    return res.status(403).json({ error: 'Forbidden: phone must match session' });
  }
  const taskId = positiveInteger(req.body?.taskId ?? req.body?.task_id);
  if (!taskId) return res.status(400).json({ error: 'A positive taskId is required' });
  const result = typeof req.body?.result === 'string' ? req.body.result.trim() : '';
  if (!result) return res.status(400).json({ error: 'A task evidence summary is required' });
  try {
    const response = await completeTask(phone, taskId, result);
    res.status(response.idempotent ? 200 : 201).json({ ...response, message: 'Evidence submitted for review. Points are awarded only after approval.' });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : 'Failed to submit task evidence' });
  }
});

router.post('/admin/tasks/topic-verification', authenticateAdmin, async (req: AuthRequest, res) => {
  const topicId = typeof req.body?.topicId === 'string' && /^[a-f0-9-]{20,64}$/i.test(req.body.topicId) ? req.body.topicId : null;
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try { return res.status(201).json(await createTopicVerificationTask({ topicId, verificationKind: req.body?.verificationKind, creditsReward: req.body?.creditsReward })); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create Topic verification task' }); }
});

router.get('/admin/tasks/submitted', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ success: true, tasks: await getSubmittedTasks() }); }
  catch { res.status(500).json({ error: 'Failed to fetch submitted task evidence' }); }
});

router.post('/admin/tasks/:taskId/moderate', authenticateAdmin, async (req: AuthRequest, res) => {
  const taskId = positiveInteger(req.params.taskId);
  const decision = req.body?.decision === 'approved' || req.body?.decision === 'rejected' ? req.body.decision : null;
  if (!taskId || !decision) return res.status(400).json({ error: 'A positive taskId and approved or rejected decision are required' });
  const moderatorPhone = String(req.user?.phone || req.user?.username || 'admin').slice(0, 128);
  try { res.json(await moderateTask({ taskId, moderatorPhone, decision, note: req.body?.note })); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Failed to moderate task evidence' }); }
});

export default router;
