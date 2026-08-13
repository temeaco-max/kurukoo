import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { agentRuntimeStatus, cancelAgentGoal, getAgentGoal, goalTimeline, listAgentGoalEvents, listAgentGoals } from '../services/agentRuntime.js';
import { assignAgentNetworkCandidate, listAgentNetworkCandidates, listRequestAgentAssignments } from '../services/agentNetwork.js';

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

router.get('/network/candidates', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  if (!requestId) return res.status(400).json({ error: 'requestId is required' });
  try { res.json({ success: true, candidates: await listAgentNetworkCandidates({ requestId, ownerPhone: owner }) }); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : 'Agent network candidates are unavailable' }); }
});

router.get('/network/assignments', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  if (!requestId) return res.status(400).json({ error: 'requestId is required' });
  try { res.json({ success: true, assignments: await listRequestAgentAssignments({ requestId, ownerPhone: owner }) }); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : 'Agent assignments are unavailable' }); }
});

router.post('/network/assignments', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : '';
  const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId.trim() : '';
  if (!requestId || !agentId) return res.status(400).json({ error: 'requestId and agentId are required' });
  try {
    const assignment = await assignAgentNetworkCandidate({ requestId, ownerPhone: owner, agentId });
    res.status(201).json({ success: true, assignment, message: 'Software-agent selection was recorded for internal coordination. No autonomous work, payment, dispatch, or fulfilment has started.' });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Agent assignment is unavailable' }); }
});

router.get('/timeline', authenticateUser, async (req: AuthRequest, res) => {
  const owner = phone(req); if (!owner) return res.status(401).json({ error: 'Authentication required' });
  const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
  res.json({ success: true, ...(await goalTimeline(owner, conversationId)) });
});

export default router;
