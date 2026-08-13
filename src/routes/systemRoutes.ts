/**
 * System documentation boundary. Health remains owned by healthRoutes.
 */
import { Router } from 'express';
import path from 'path';
import { getChildSitemap, getLlmsTxt, getRobotsTxt, getSitemapIndex } from '../services/seoService.js';

const router = Router();

router.get('/api/docs', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'api-docs.html'));
});

router.get('/robots.txt', async (_req, res, next) => {
  try { res.type('text/plain').send(await getRobotsTxt()); } catch (error) { next(error); }
});
router.get('/llms.txt', async (_req, res, next) => {
  try { res.type('text/plain').send(await getLlmsTxt()); } catch (error) { next(error); }
});
router.get('/sitemap.xml', async (_req, res, next) => {
  try { res.type('application/xml').send(await getSitemapIndex()); } catch (error) { next(error); }
});
router.get('/sitemap-:type.xml', async (req, res, next) => {
  const type = String(req.params.type || '');
  if (!['pages', 'categories', 'blog', 'topics'].includes(type)) return res.status(404).type('text/plain').send('Not found');
  try { return res.type('application/xml').send(await getChildSitemap(type)); } catch (error) { return next(error); }
});

export default router;
