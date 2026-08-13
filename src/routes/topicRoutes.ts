import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { topicMutationRateLimit, topicReportRateLimit } from '../middleware/rateLimit.js';
import {
  closeTopicReport,
  createReply,
  createTopic,
  createTopicDraft,
  findTopicDuplicateCandidates,
  getTopicChatContext,
  createTopicReport,
  getPublicTopic,
  getTopicForOwner,
  getTopicTaxonomy,
  listPublicTopics,
  linkTopicResource,
  listSubmittedReplies,
  listSubmittedTopics,
  listTopicReports,
  listTopicsForOwner,
  moderateReply,
  moderateTopic,
  removeTopic,
  updateTopic,
} from '../services/topicService.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function id(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9-]{20,64}$/i.test(value) ? value : null;
}

/**
 * The Topic boundary only owns durable shared-content lifecycle.
 * It never creates a provider, action, payment, execution, or Points event.
 */
router.get('/topics/taxonomy', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json(getTopicTaxonomy());
});

router.get('/topics', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ topics: await listPublicTopics(req.query) });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load Topics' });
  }
});

router.get('/topics/suggestions', async (req, res) => {
  try {
    const candidates = await findTopicDuplicateCandidates({ title: req.query.title, category: req.query.category });
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json({ candidates });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to find Topic candidates' }); }
});

router.get('/topics/:slug', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const topic = await getPublicTopic(String(req.params.slug || ''));
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json({ topic });
  } catch {
    res.status(500).json({ error: 'Unable to load Topic' });
  }
});

router.get('/topics/:slug/chat-context', async (req, res) => {
  try {
    const topic = await getTopicChatContext(String(req.params.slug || ''));
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({ topic });
  } catch { return res.status(500).json({ error: 'Unable to load Topic context' }); }
});

router.get('/topics/mine/list', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try { res.json({ topics: await listTopicsForOwner(phone) }); }
  catch { res.status(500).json({ error: 'Unable to load your Topics' }); }
});

router.get('/topics/mine/:id', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const topicId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try {
    const topic = await getTopicForOwner(topicId, phone);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json({ topic });
  } catch { res.status(500).json({ error: 'Unable to load Topic' }); }
});

router.post('/topics/drafts', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try { res.status(201).json({ topic: await createTopicDraft(phone, req.body || {}) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save Topic draft' }); }
});

router.post('/topics', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const topic = await createTopic(phone, req.body || {}, req.header('Idempotency-Key'));
    res.status((topic as any)?.idempotent ? 200 : 201).json({ topic });
  }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create Topic' }); }
});

router.put('/topics/:id', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const topicId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try { res.json({ topic: await updateTopic(phone, topicId, req.body || {}) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to update Topic'; res.status(message === 'Topic not found' ? 404 : message.includes('ownership') ? 403 : 400).json({ error: message }); }
});

router.delete('/topics/:id', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const topicId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try { res.json(await removeTopic(phone, topicId)); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to remove Topic'; res.status(message === 'Topic not found' ? 404 : message.includes('ownership') ? 403 : 400).json({ error: message }); }
});

router.post('/topics/:id/replies', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const topicId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try { res.status(201).json({ reply: await createReply(phone, topicId, req.body || {}) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to submit reply'; res.status(message.includes('available only') ? 409 : 400).json({ error: message }); }
});

router.post('/topics/:id/report', authenticateUser, topicReportRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const topicId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try { const report = await createTopicReport(phone, 'topic', topicId, req.body?.reason, req.body?.detail); res.status((report as any).idempotent ? 200 : 201).json({ report }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to submit report' }); }
});

router.post('/topics/replies/:id/report', authenticateUser, topicReportRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const replyId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!replyId) return res.status(400).json({ error: 'A valid reply id is required' });
  try { const report = await createTopicReport(phone, 'reply', replyId, req.body?.reason, req.body?.detail); res.status((report as any).idempotent ? 200 : 201).json({ report }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to submit report' }); }
});

router.post('/admin/topics/:id/resources', authenticateAdmin, async (req: AuthRequest, res) => {
  const topicId = id(req.params.id); if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  const adminIdentity = String(req.user?.phone || req.user?.username || 'admin');
  try { return res.status(201).json({ resource: await linkTopicResource(topicId, req.body?.resourceSlug, adminIdentity) }); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to link editorial resource' }); }
});

router.get('/admin/topics/submitted', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ topics: await listSubmittedTopics() }); }
  catch { res.status(500).json({ error: 'Unable to load Topic moderation queue' }); }
});

router.post('/admin/topics/:id/moderate', authenticateAdmin, async (req: AuthRequest, res) => {
  const topicId = id(req.params.id); if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try { res.json({ topic: await moderateTopic(topicId, req.body || {}) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to moderate Topic'; res.status(message === 'Topic not found' ? 404 : 400).json({ error: message }); }
});

router.get('/admin/topics/replies/submitted', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ replies: await listSubmittedReplies() }); }
  catch { res.status(500).json({ error: 'Unable to load reply moderation queue' }); }
});

router.post('/admin/topics/replies/:id/moderate', authenticateAdmin, async (req: AuthRequest, res) => {
  const replyId = id(req.params.id); if (!replyId) return res.status(400).json({ error: 'A valid reply id is required' });
  try { res.json({ reply: await moderateReply(replyId, req.body || {}) }); }
  catch (error) { const message = error instanceof Error ? error.message : 'Unable to moderate reply'; res.status(message === 'Reply not found' ? 404 : 400).json({ error: message }); }
});

router.get('/admin/topics/reports', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ reports: await listTopicReports() }); }
  catch { res.status(500).json({ error: 'Unable to load Topic reports' }); }
});

router.post('/admin/topics/reports/:id/close', authenticateAdmin, async (req: AuthRequest, res) => {
  const reportId = id(req.params.id); if (!reportId) return res.status(400).json({ error: 'A valid report id is required' });
  try { res.json({ report: await closeTopicReport(reportId, req.body?.note) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to close Topic report' }); }
});

export default router;
