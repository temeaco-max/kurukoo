import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { agentRuntimeStatus, cancelAgentGoal, getAgentGoal, goalTimeline, listAgentGoalEvents, listAgentGoals } from '../services/agentRuntime.js';

const router = Router();

function phone(req: AuthRequest): string | null { return req.user?.phone ? String(req.user.phone) : null; }

router.get('/status', (_req, res) => res.json({ success: true, runtime: agentRuntimeStatus() }));

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
