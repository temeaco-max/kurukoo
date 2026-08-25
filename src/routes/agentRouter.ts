import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { agentRuntimeStatus, cancelAgentGoal, getAgentGoal, goalTimeline, listAgentGoalEvents, listAgentGoals, listAgentWorkerRuns, pauseAgentGoal, resumeAgentGoal } from '../services/agentRuntime.js';
import { listAgentExecutionTrace } from '../services/agentExecutionTrace.js';
import { buildAgentBrief, enqueueAgentBriefNotification } from '../services/agentBriefService.js';
import { attachAgentGoalDependency, getAgentEconomicRequestLink, listAgentGoalDependencies, refreshAgentGoalDependencies } from '../services/agentEconomicRequestOrchestrator.js';
import { getAgentGoalContinuation } from '../services/agentGoalContinuation.js';

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
  const [economicLink, dependencies] = await Promise.all([
    getAgentEconomicRequestLink(owner, goal.id),
    listAgentGoalDependencies(owner, goal.id),
  ]);
  res.json({ success: true, goal, events: await listAgentGoalEvents(owner, goal.id), economicLink, dependencies });
});

router.get('/goals/:id/trace', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await getAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const parsed = Number(req.query.limit || 50);
  res.json({ success: true, trace: await listAgentExecutionTrace(owner, goal.id, Number.isFinite(parsed) ? parsed : 50) });
});

router.get('/goals/:id/economic-request', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await getAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, link: await getAgentEconomicRequestLink(owner, goal.id) });
});

router.get('/goals/:id/dependencies', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await getAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, dependencies: await refreshAgentGoalDependencies(owner, goal.id) });
});

router.get('/goals/:id/continuation', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const continuation = await getAgentGoalContinuation(owner, String(req.params.id || ''));
  if (!continuation) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true, continuation });
});

router.post('/goals/:id/dependencies', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const goal = await getAgentGoal(owner, String(req.params.id || ''));
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  try {
    const dependency = await attachAgentGoalDependency({
      phone: owner,
      parentGoalId: goal.id,
      skill: String(req.body?.skill || ''),
      purpose: String(req.body?.purpose || ''),
      economicRequestId: req.body?.economicRequestId ? String(req.body.economicRequestId) : undefined,
      blockedBy: req.body?.blockedBy ? String(req.body.blockedBy) : undefined,
    });
    res.status(201).json({ success: true, dependency });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to attach goal dependency';
    res.status(400).json({ error: message });
  }
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
