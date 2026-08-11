import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import fs from 'fs';
import { getRobotsTxt, getLlmsTxt, getSitemapIndex, getChildSitemap, getSeoPage, getFaqForPage, matchRedirect } from './services/seoService.js';

// Development/test defaults only. Production must not silently select sandbox.
if (process.env.NODE_ENV !== 'production' && !process.env.KURUKOO_PAY_PROVIDER) process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
if (!process.env.CREDIT_ECONOMY_ENABLED) process.env.CREDIT_ECONOMY_ENABLED = 'true';
console.log(`[Kurukoo Startup] Environment initialized. PORT=${process.env.PORT || 3000}, Pay Provider=${process.env.KURUKOO_PAY_PROVIDER || 'unconfigured'}`);

/**
 * Transitional legacy boundary.
 *
 * Canonical product routes live under src/routes/* and are mounted by
 * src/index.ts. This module now owns only genuinely transitional page/SEO
 * infrastructure; do not add new business APIs here.
 */
export function registerLegacyRoutes(app: express.Application) {
    app.set('trust proxy', 1);
    app.use(express.urlencoded({ extended: true }));
    app.set('view engine', 'ejs');
    app.set('views', path.join(process.cwd(), 'views'));

    app.use(async (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/webhook') || req.path.startsWith('/ussd') || req.path.includes('.')) return next();
        try {
            const redirect = await matchRedirect(req.path);
            if (redirect) return res.redirect(redirect.status_code, redirect.to_url);
        } catch (error) {
            console.error('SEO redirect middleware error:', error);
        }
        next();
    });

    app.get('/robots.txt', async (_req, res) => {
        try { res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(await getRobotsTxt()); }
        catch (error) { console.error('robots.txt error:', error); res.status(500).send('Error generating robots.txt'); }
    });

    app.get('/llms.txt', async (_req, res) => {
        try { res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(await getLlmsTxt()); }
        catch (error) { console.error('llms.txt error:', error); res.status(500).send('Error generating llms.txt'); }
    });

    app.get('/*.md', async (req, res, next) => {
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

    app.get('/sitemap.xml', async (_req, res) => {
        try { res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(await getSitemapIndex()); }
        catch (error) { console.error('Sitemap index error:', error); res.status(500).send('Error generating sitemap index'); }
    });
    for (const type of ['pages', 'categories', 'blog', 'programmatic']) {
        app.get(`/sitemap-${type}.xml`, async (_req, res) => {
            try { res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(await getChildSitemap(type)); }
            catch (error) { console.error(`sitemap-${type} error:`, error); res.status(500).send('Error'); }
        });
    }

    app.use(express.static(path.join(process.cwd(), 'public')));
    app.get('/admin', (_req, res) => res.redirect('/admin/login.html'));
    app.get('/admin/', (_req, res) => res.redirect('/admin/login.html'));
    app.get('/admin/:page', (req, res, next) => {
        const page = req.params.page;
        if (!page.endsWith('.html')) {
            const filePath = path.join(process.cwd(), 'public', 'admin', `${page}.html`);
            if (fs.existsSync(filePath)) return res.sendFile(filePath);
        }
        next();
    });
}

async function fetchSeoData(pathname: string): Promise<any> {
    try { return { seo: await getSeoPage(pathname), faqs: await getFaqForPage(pathname) }; }
    catch { return { seo: null, faqs: [] }; }
}
