/**
 * SEO Admin boundary — ChatGPT security audit extraction from index.ts §53.
 * Mounted at /api/admin/seo (via wire-security-routes).
 * Every route requires authenticateAdmin (several monolith handlers were open).
 * Reuses seoService only — no parallel SEO tables or settings stores.
 */
import { Router } from 'express';
import { authenticateAdmin, AuthRequest } from '../middleware/auth.js';
import {
  getSeoDashboard,
  getHealthScore,
  getSeoSettings,
  updateSeoSettings,
  getAllSeoPages,
  upsertSeoPage,
  deleteSeoPage,
  getAllFaqForPage,
  addFaq,
  updateFaq,
  deleteFaq,
  getKeywords,
  upsertKeyword,
  deleteKeyword,
  getRedirects,
  addRedirect,
  deleteRedirect,
  getSchemaTemplates,
  upsertSchemaTemplate,
  deleteSchemaTemplate,
  getInternalLinks,
  addInternalLink,
  updateInternalLink,
  deleteInternalLink,
  getBacklinks,
  addBacklink,
  updateBacklink,
  deleteBacklink,
  getContentCalendar,
  addContentCalendar,
  updateContentCalendar,
  deleteContentCalendar,
  getContentBriefs,
  addContentBrief,
  updateContentBrief,
  deleteContentBrief,
  get404Log,
  ignore404,
  generateAltTextForImage,
  generateFaqsForPageWithAI,
  generateContentBriefWithAI,
  runSeoAudit,
  getAuditResults,
  getRankings,
  getOrphanPages,
  getImageMeta,
  upsertImageMeta,
  deleteImageMeta,
} from '../services/seoService.js';

const router = Router();

// Dashboard / health
router.get('/dashboard', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getSeoDashboard());
  } catch (e) {
    console.error('SEO dashboard error:', e);
    res.status(500).json({ error: 'Failed to load SEO dashboard' });
  }
});

router.get('/health', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json({ score: await getHealthScore() });
  } catch (e) {
    console.error('SEO health error:', e);
    res.status(500).json({ error: 'Failed to load health score' });
  }
});

// Settings
router.get('/settings', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getSeoSettings());
  } catch (e) {
    console.error('SEO settings error:', e);
    res.status(500).json({ error: 'Failed to load SEO settings' });
  }
});

router.post('/settings', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await updateSeoSettings(req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO settings update error:', e);
    res.status(500).json({ error: 'Failed to save SEO settings' });
  }
});

// Pages
router.get('/pages', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getAllSeoPages());
  } catch (e) {
    console.error('SEO pages error:', e);
    res.status(500).json({ error: 'Failed to load SEO pages' });
  }
});

router.post('/pages', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await upsertSeoPage(req.body as any);
    res.json({ success: true });
  } catch (e) {
    console.error('SEO page save error:', e);
    res.status(500).json({ error: 'Failed to save SEO page' });
  }
});

router.delete('/pages', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteSeoPage(String(req.body?.url_path || ''));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO page delete error:', e);
    res.status(500).json({ error: 'Failed to delete SEO page' });
  }
});

// FAQs
router.get('/faqs', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const page = typeof req.query.url_path === 'string' ? req.query.url_path : '';
    res.json(await getAllFaqForPage(page));
  } catch (e) {
    console.error('SEO FAQs error:', e);
    res.status(500).json({ error: 'Failed to load FAQs' });
  }
});

router.post('/faqs', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await addFaq(
      String(b.page_url_path || ''),
      String(b.question || ''),
      String(b.answer || ''),
      Number(b.display_order) || 0
    );
    res.json({ success: true });
  } catch (e) {
    console.error('FAQ add error:', e);
    res.status(500).json({ error: 'Failed to add FAQ' });
  }
});

router.put('/faqs/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await updateFaq(Number(req.params.id), req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('FAQ update error:', e);
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

router.delete('/faqs/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteFaq(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('FAQ delete error:', e);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// Keywords
router.get('/keywords', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getKeywords());
  } catch (e) {
    console.error('SEO keywords error:', e);
    res.status(500).json({ error: 'Failed to load keywords' });
  }
});

router.post('/keywords', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await upsertKeyword(
      String(b.keyword || ''),
      String(b.locale || 'en'),
      String(b.country || 'ng'),
      Number(b.search_volume) || 0,
      Number(b.difficulty) || 0,
      !!b.tracked
    );
    res.json({ success: true });
  } catch (e) {
    console.error('SEO keyword save error:', e);
    res.status(500).json({ error: 'Failed to save keyword' });
  }
});

router.delete('/keywords/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteKeyword(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO keyword delete error:', e);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

// Redirects
router.get('/redirects', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getRedirects());
  } catch (e) {
    console.error('SEO redirects error:', e);
    res.status(500).json({ error: 'Failed to load redirects' });
  }
});

router.post('/redirects', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await addRedirect(
      String(b.from_url || b.from_pattern || ''),
      String(b.to_url || ''),
      Number(b.status_code) || 301,
      !!b.is_regex
    );
    res.json({ success: true });
  } catch (e) {
    console.error('SEO redirect add error:', e);
    res.status(500).json({ error: 'Failed to add redirect' });
  }
});

router.delete('/redirects/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteRedirect(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO redirect delete error:', e);
    res.status(500).json({ error: 'Failed to delete redirect' });
  }
});

// Schema templates
router.get('/schemas', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getSchemaTemplates());
  } catch (e) {
    console.error('SEO schema error:', e);
    res.status(500).json({ error: 'Failed to load schema templates' });
  }
});

router.post('/schemas', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await upsertSchemaTemplate(
      String(b.id || ''),
      String(b.name || ''),
      String(b.type || ''),
      String(b.template || '{}'),
      String(b.applies_to || '')
    );
    res.json({ success: true });
  } catch (e) {
    console.error('SEO schema save error:', e);
    res.status(500).json({ error: 'Failed to save schema template' });
  }
});

router.delete('/schemas/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteSchemaTemplate(String(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO schema delete error:', e);
    res.status(500).json({ error: 'Failed to delete schema template' });
  }
});

// Internal links
router.get('/internal-links', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getInternalLinks());
  } catch (e) {
    console.error('SEO internal links error:', e);
    res.status(500).json({ error: 'Failed to load internal links' });
  }
});

router.post('/internal-links', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await addInternalLink(String(b.source_url || ''), String(b.target_url || ''), String(b.anchor_text || ''));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO internal link add error:', e);
    res.status(500).json({ error: 'Failed to add internal link' });
  }
});

router.put('/internal-links/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await updateInternalLink(Number(req.params.id), req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO internal link update error:', e);
    res.status(500).json({ error: 'Failed to update internal link' });
  }
});

router.delete('/internal-links/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteInternalLink(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO internal link delete error:', e);
    res.status(500).json({ error: 'Failed to delete internal link' });
  }
});

// Backlinks
router.get('/backlinks', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getBacklinks());
  } catch (e) {
    console.error('SEO backlinks error:', e);
    res.status(500).json({ error: 'Failed to load backlinks' });
  }
});

router.post('/backlinks', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    await addBacklink(String(b.source_url || ''), String(b.target_url || ''), String(b.anchor_text || ''));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO backlink add error:', e);
    res.status(500).json({ error: 'Failed to add backlink' });
  }
});

router.put('/backlinks/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await updateBacklink(Number(req.params.id), req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO backlink update error:', e);
    res.status(500).json({ error: 'Failed to update backlink' });
  }
});

router.delete('/backlinks/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteBacklink(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO backlink delete error:', e);
    res.status(500).json({ error: 'Failed to delete backlink' });
  }
});

// Content calendar & briefs
router.get('/content-calendar', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getContentCalendar());
  } catch (e) {
    console.error('SEO content calendar error:', e);
    res.status(500).json({ error: 'Failed to load content calendar' });
  }
});

router.post('/content-calendar', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await addContentCalendar(req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO content calendar add error:', e);
    res.status(500).json({ error: 'Failed to add content calendar item' });
  }
});

router.put('/content-calendar/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await updateContentCalendar(Number(req.params.id), req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO content calendar update error:', e);
    res.status(500).json({ error: 'Failed to update content calendar item' });
  }
});

router.delete('/content-calendar/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteContentCalendar(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO content calendar delete error:', e);
    res.status(500).json({ error: 'Failed to delete content calendar item' });
  }
});

router.get('/content-briefs', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getContentBriefs());
  } catch (e) {
    console.error('SEO content briefs error:', e);
    res.status(500).json({ error: 'Failed to load content briefs' });
  }
});

router.post('/content-briefs', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await addContentBrief(req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO content brief add error:', e);
    res.status(500).json({ error: 'Failed to add content brief' });
  }
});

router.put('/content-briefs/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await updateContentBrief(Number(req.params.id), req.body || {});
    res.json({ success: true });
  } catch (e) {
    console.error('SEO content brief update error:', e);
    res.status(500).json({ error: 'Failed to update content brief' });
  }
});

router.delete('/content-briefs/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteContentBrief(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO content brief delete error:', e);
    res.status(500).json({ error: 'Failed to delete content brief' });
  }
});

// 404 log
router.get('/404-log', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await get404Log());
  } catch (e) {
    console.error('SEO 404 log error:', e);
    res.status(500).json({ error: 'Failed to load 404 log' });
  }
});

router.post('/404-log/ignore/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await ignore404(Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    console.error('SEO 404 ignore error:', e);
    res.status(500).json({ error: 'Failed to ignore 404 entry' });
  }
});

// AI generation helpers
router.post('/generate-alt-text', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { imagePath, context, existingAlt } = req.body || {};
    if (!imagePath) return res.status(400).json({ error: 'imagePath required' });
    const alt = await generateAltTextForImage(imagePath, context, existingAlt);
    res.json({ alt_text: alt, image_path: imagePath });
  } catch (e: any) {
    console.error('SEO alt-text generation error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate alt text' });
  }
});

router.post('/generate-faqs', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { urlPath, topicName } = req.body || {};
    if (!urlPath) return res.status(400).json({ error: 'urlPath required' });
    const faqs = await generateFaqsForPageWithAI(urlPath, topicName);
    res.json({ success: true, faqs });
  } catch (e: any) {
    console.error('SEO FAQ generation error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate FAQs' });
  }
});

router.post('/generate-brief', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { targetKeyword } = req.body || {};
    if (!targetKeyword) return res.status(400).json({ error: 'targetKeyword required' });
    const brief = await generateContentBriefWithAI(targetKeyword);
    res.json({ success: true, brief });
  } catch (e: any) {
    console.error('SEO brief generation error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate content brief' });
  }
});

router.post('/run-audit', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { urlPath } = req.body || {};
    const audit = await runSeoAudit(urlPath || '/');
    res.json(audit);
  } catch (e: any) {
    console.error('SEO audit run error:', e);
    res.status(500).json({ error: e.message || 'Failed to run SEO audit' });
  }
});

// Audits / rankings / orphans / image-meta
router.get('/audits', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getAuditResults());
  } catch (e: any) {
    console.error('SEO audits error:', e);
    res.status(500).json({ error: 'Failed to load audits' });
  }
});

router.get('/rankings', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getRankings());
  } catch (e: any) {
    console.error('SEO rankings error:', e);
    res.status(500).json({ error: 'Failed to load rankings' });
  }
});

router.get('/orphans', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getOrphanPages());
  } catch (e: any) {
    console.error('SEO orphans error:', e);
    res.status(500).json({ error: 'Failed to load orphan pages' });
  }
});

router.get('/image-meta', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const page = typeof req.query.page_url_path === 'string' ? String(req.query.page_url_path) : undefined;
    res.json(await getImageMeta(page));
  } catch (e: any) {
    console.error('SEO image meta error:', e);
    res.status(500).json({ error: 'Failed to load image metadata' });
  }
});

router.post('/image-meta/generate-alt', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { imagePath, context, existingAlt } = req.body || {};
    if (!imagePath) return res.status(400).json({ error: 'imagePath required' });
    const alt = await generateAltTextForImage(imagePath, context, existingAlt);
    res.json({ alt_text: alt, image_path: imagePath });
  } catch (e: any) {
    console.error('SEO alt-text generation error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate alt text' });
  }
});

router.post('/image-meta', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    if (!String(body.image_path || body.imagePath || '').trim()) return res.status(400).json({ error: 'image_path is required' });
    await upsertImageMeta(body);
    res.json({ success: true });
  } catch (e: any) {
    console.error('SEO image meta save error:', e);
    res.status(500).json({ error: 'Failed to save image metadata' });
  }
});

router.delete('/image-meta/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteImageMeta(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    console.error('SEO image meta delete error:', e);
    res.status(500).json({ error: 'Failed to delete image meta' });
  }
});

export default router;
