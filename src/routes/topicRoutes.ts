/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { topicMutationRateLimit, topicReportRateLimit } from '../middleware/rateLimit.js';
import {
  closeTopicReport,
  createAgentTopicReply,
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
import { retrieveKnowledge } from '../services/knowledgeRetrievalService.js';
import {
  createTopicAdCampaign,
  ensureCommunityTopicSupport,
  getCategoryAdRates,
  getCommunityStats,
  getCommunityTaxonomy,
  getTopicAdInventory,
  seedCommunityWelcomeTopics,
  touchCommunityPresence,
} from '../services/communityTopicService.js';
import { setCommunityAdRate, setCommunityCategoryAds, setCommunitySubcategoryAds } from '../services/communityTopicAdminService.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function id(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9-]{20,64}$/i.test(value) ? value : null;
}

router.get('/topics/community/taxonomy', async (_req, res) => {
  try { res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600'); res.json({ categories: await getCommunityTaxonomy(false) }); }
  catch { res.status(500).json({ error: 'Unable to load Topic community taxonomy' }); }
});

router.get('/topics/community/stats', async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getCommunityStats()); }
  catch { res.status(500).json({ error: 'Unable to load community statistics' }); }
});

router.post('/topics/community/presence', async (req: AuthRequest, res) => {
  try { res.json(await touchCommunityPresence({ phone: sessionPhone(req), visitorId: typeof req.body?.visitorId === 'string' ? req.body.visitorId : null })); }
  catch { res.status(400).json({ error: 'Unable to update community presence' }); }
});

router.get('/topics/community/ads', async (req, res) => {
  try { res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120'); res.json({ inventory: await getTopicAdInventory(typeof req.query.category === 'string' ? req.query.category : undefined, typeof req.query.subcategory === 'string' ? req.query.subcategory : undefined) }); }
  catch { res.status(500).json({ error: 'Unable to load Topic advertising inventory' }); }
});

router.get('/topics/community/ad-rates', async (req, res) => {
  if (typeof req.query.category !== 'string') return res.status(400).json({ error: 'category is required' });
  try { res.json({ rates: await getCategoryAdRates(req.query.category, typeof req.query.subcategory === 'string' ? req.query.subcategory : undefined) }); }
  catch { res.status(500).json({ error: 'Unable to load Topic advertising rates' }); }
});

router.get('/topics/community/category/:categorySlug', async (req, res) => {
  try {
    const categories = await getCommunityTaxonomy(false);
    const category = categories.find((item) => item.slug === req.params.categorySlug);
    if (!category) return res.status(404).json({ error: 'Topic category not found' });
    const topics = await listPublicTopics({ category: category.slug, limit: 30 });
    const inventory = await getTopicAdInventory(category.slug);
    return res.json({ category, topics, inventory });
  } catch { return res.status(500).json({ error: 'Unable to load Topic category' }); }
});

router.post('/topics/community/ads', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try { return res.status(201).json(await createTopicAdCampaign(phone, req.body || {})); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to place Topic advert' }); }
});

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

router.get('/discover/community-context', async (req, res) => {
  try {
    const topics = await listPublicTopics(req.query);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      items: topics.map((topic: any) => ({
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        body: topic.body.slice(0, 1200),
        type: topic.type,
        category: topic.category,
        skills: topic.skills,
        city: topic.city,
        lga: topic.lga,
        replyCount: topic.replyCount,
        provenance: 'community_statement' as const,
        authorLabel: 'Community member',
      })),
    });
  } catch {
    res.status(500).json({ error: 'Unable to load community context' });
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
  try {
    const topic = await createTopicDraft(phone, req.body || {});
    res.status((topic as any)?.idempotent ? 200 : 201).json({ topic });
  }
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

router.post('/topics/:id/agent-replies', authenticateUser, topicMutationRateLimit, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); const topicId = id(req.params.id);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (!topicId) return res.status(400).json({ error: 'A valid Topic id is required' });
  try {
    const reply = await createAgentTopicReply({ agentId: String(req.body?.agentId || ''), ownerPhone: phone, topicId, task: String(req.body?.task || '') });
    res.status(201).json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit the agent reply';
    res.status(message.includes('available only') ? 409 : message.includes('Only the delegating') ? 403 : 400).json({ error: message });
  }
});

router.get('/knowledge/search', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const result = await retrieveKnowledge({ query: String(req.query?.q || ''), ownerPhone: phone });
    res.json({ success: true, ...result });
  } catch (error) { res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Knowledge search failed.' }); }
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

router.post('/admin/topics/community/seed-welcome-topics', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { await seedCommunityWelcomeTopics(); return res.status(201).json({ ok: true }); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to seed community Topics' }); }
});

router.patch('/admin/topics/community/categories/:slug/ads', authenticateAdmin, async (req: AuthRequest, res) => {
  try { return res.json(await setCommunityCategoryAds(String(req.params.slug), Boolean(req.body?.enabled))); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update category advertising' }); }
});

router.patch('/admin/topics/community/subcategories/:slug/ads', authenticateAdmin, async (req: AuthRequest, res) => {
  try { return res.json(await setCommunitySubcategoryAds(String(req.params.slug), Boolean(req.body?.enabled))); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update subcategory advertising' }); }
});

router.patch('/admin/topics/community/ad-rates', authenticateAdmin, async (req: AuthRequest, res) => {
  try { return res.json(await setCommunityAdRate(String(req.body?.categorySlug), req.body?.subcategorySlug ? String(req.body.subcategorySlug) : null, String(req.body?.slot), Number(req.body?.points), Boolean(req.body?.enabled))); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update Topic ad rate' }); }
});

export default router;
