import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { agentRuntimeStatus, cancelAgentGoal, getAgentGoal, goalTimeline, listAgentGoalEvents, listAgentGoals, listAgentWorkerRuns, pauseAgentGoal, resumeAgentGoal } from '../services/agentRuntime.js';
import { buildAgentBrief, enqueueAgentBriefNotification } from '../services/agentBriefService.js';

const router = Router();

function phone(req: AuthRequest): string | null { return req.user?.phone ? String(req.user.phone) : null; }

router.get('/status', authenticateAdmin, (_req, res) => res.json({ success: true, runtime: agentRuntimeStatus() }));

router.get('/runs', authenticateAdmin, async (req, res) => {
  const parsed = Number(req.query.limit || 20);
  res.json({ success: true, runs: await listAgentWorkerRuns(Number.isFinite(parsed) ? parsed : 20) });
});

router.get('/brief', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  try {
    const brief = await buildAgentBrief(owner);
    const { ownerPhone: _ownerPhone, ...publicBrief } = brief;
    res.json({ success: true, brief: publicBrief });
  } catch (error) {
    console.error('[Agent] brief generation failed:', error);
    res.status(500).json({ error: 'Unable to prepare your Kurukoo brief' });
  }
});

router.post('/brief/notify', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  try {
    const brief = await buildAgentBrief(owner);
    const delivery = await enqueueAgentBriefNotification(owner, brief);
    const { ownerPhone: _ownerPhone, ...publicBrief } = brief;
    res.json({ success: true, brief: publicBrief, delivery });
  } catch (error) {
    console.error('[Agent] brief notification fallback failed:', error);
    res.status(500).json({ error: 'Unable to prepare your Kurukoo brief notification' });
  }
});

router.get('/goals', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  res.json({ success: true, goals: await listAgentGoals(owner, req.query.includeClosed === 'true') });
});

router.get('/goals/:id', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await getAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, goal, events: await listAgentGoalEvents(owner, goal.id) });
});

router.post('/goals/:id/pause', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await pauseAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, goal });
});

router.post('/goals/:id/resume', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await resumeAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, goal });
});

router.post('/goals/:id/cancel', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await cancelAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, goal });
});

router.get('/timeline', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
  res.json({ success: true, ...(await goalTimeline(owner, conversationId)) });
});

export default router;
