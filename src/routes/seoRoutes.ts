import express, { Router } from 'express';
import { getRobotsTxt, getLlmsTxt, getSitemapIndex, getChildSitemap, getSeoPage, getFaqForPage, matchRedirect } from '../services/seoService.js';

async function fetchSeoData(pathname: string) {
  try {
    return { seo: await getSeoPage(pathname), faqs: await getFaqForPage(pathname) };
  } catch {
    return { seo: null, faqs: [] };
  }
}

/** Public SEO/discovery endpoints. No business APIs belong here. */
export function createSeoRouter(): Router {
  const router = express.Router();

  router.use(async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/webhook') || req.path.startsWith('/ussd') || req.path.includes('.')) return next();
    try {
      const redirect = await matchRedirect(req.path);
      if (redirect) return res.redirect(redirect.status_code, redirect.to_url);
    } catch (error) {
      console.error('SEO redirect middleware error:', error);
    }
    next();
  });

  router.get('/robots.txt', async (_req, res) => {
    try { res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(await getRobotsTxt()); }
    catch (error) { console.error('robots.txt error:', error); res.status(500).send('Error generating robots.txt'); }
  });

  router.get('/llms.txt', async (_req, res) => {
    try { res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(await getLlmsTxt()); }
    catch (error) { console.error('llms.txt error:', error); res.status(500).send('Error generating llms.txt'); }
  });

  router.get('/*.md', async (req, res, next) => {
    try {
      const rawPath = req.path.slice(0, -3);
      if (rawPath === '/llms') return next();
      const seoData = await fetchSeoData(rawPath);
      const title = seoData.seo?.title || 'Kurukoo Page';
      const description = seoData.seo?.meta_description || '';
      const faqs = seoData.faqs || [];
      let mdContent = `# ${title}\n\n${description}\n\n`;
      if (faqs.length) {
        mdContent += '## Frequently Asked Questions\n\n';
        for (const faq of faqs) mdContent += `### ${faq.question}\n${faq.answer}\n\n`;
      }
      mdContent += `\n---\n*Source: https://kurukoo.com${rawPath}*`;
      res.type('text/markdown').set('Cache-Control', 'public, max-age=3600').send(mdContent);
    } catch { next(); }
  });

  router.get('/sitemap.xml', async (_req, res) => {
    try { res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(await getSitemapIndex()); }
    catch (error) { console.error('Sitemap index error:', error); res.status(500).send('Error generating sitemap index'); }
  });

  for (const type of ['pages', 'categories', 'blog', 'programmatic']) {
    router.get(`/sitemap-${type}.xml`, async (_req, res) => {
      try { res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(await getChildSitemap(type)); }
      catch (error) { console.error(`sitemap-${type} error:`, error); res.status(500).send('Error'); }
    });
  }

  return router;
}

export default createSeoRouter();
