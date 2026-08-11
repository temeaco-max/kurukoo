import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import fs from 'fs';
import { generateReferralCode, trackReferral, claimReferral } from './services/referralService.js';
import {
    getRobotsTxt, getLlmsTxt, getSitemapIndex, getChildSitemap,
    getSeoPage, getFaqForPage, matchRedirect,
} from './services/seoService.js';

// Development/test defaults only. Production must not silently select sandbox.
if (process.env.NODE_ENV !== 'production' && !process.env.KURUKOO_PAY_PROVIDER) process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
if (!process.env.CREDIT_ECONOMY_ENABLED) process.env.CREDIT_ECONOMY_ENABLED = 'true';
console.log(`[Kurukoo Startup] Environment initialized. PORT=${process.env.PORT || 3000}, Pay Provider=${process.env.KURUKOO_PAY_PROVIDER || 'unconfigured'}`);

export function registerLegacyRoutes(app: express.Application) {
    app.set('trust proxy', 1);

    // Keep parsing/static/view concerns that have not yet moved to dedicated
    // route modules. Canonical chat/channel/economic routes are mounted by
    // src/index.ts and are intentionally not duplicated here.
    app.use('/api/chat/attachments', express.json({ limit: process.env.CHAT_ATTACHMENT_BODY_LIMIT || '35mb' }));
    app.use(express.json());
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

    // Referral endpoints remain here until the dedicated referral router is
    // extracted. New platform features must not be added to this legacy group.
    app.post('/api/referral/code', async (req, res) => {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Missing phone' });
        res.json({ success: true, code: await generateReferralCode(phone) });
    });
    app.post('/api/referral/claim', async (req, res) => {
        const { phone, referral_code } = req.body;
        if (!phone || !referral_code) return res.status(400).json({ error: 'Missing data' });
        try {
            const { findReferrerByCode } = await import('./services/referralService.js');
            const referrer = await findReferrerByCode(referral_code.trim().toUpperCase());
            if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
            if (referrer === phone) return res.status(400).json({ error: 'You cannot refer yourself' });
            await trackReferral(referrer, phone, referral_code.trim().toUpperCase());
            res.json({ success: true, message: 'Referral registered successfully.' });
        } catch { res.status(500).json({ error: 'Failed to register referral code' }); }
    });
    app.post('/api/referral/share-reward', async (req, res) => {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Missing phone' });
        try { const { awardShareReward } = await import('./services/referralService.js'); res.json({ success: true, rewarded: await awardShareReward(phone) }); }
        catch { res.status(500).json({ error: 'Failed to award sharing reward' }); }
    });
    app.post('/api/referral/resolve', async (req, res) => {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing code' });
        try { const { findReferrerByCode } = await import('./services/referralService.js'); const phone = await findReferrerByCode(code.trim().toUpperCase()); res.json(phone ? { success: true, phone } : { success: false, error: 'Invalid referral code' }); }
        catch { res.status(500).json({ error: 'Failed to resolve referral code' }); }
    });
    app.get('/api/referral/stats/:phone', async (req, res) => {
        const { phone } = req.params;
        if (!phone) return res.status(400).json({ error: 'Missing phone' });
        try { const { getReferralStats } = await import('./services/referralService.js'); res.json({ success: true, stats: await getReferralStats(phone) }); }
        catch { res.status(500).json({ error: 'Failed to get referral stats' }); }
    });
    app.post('/api/referral/track', async (req, res) => {
        const { referrer_phone, referred_phone, referral_code } = req.body;
        if (!referrer_phone || !referred_phone || !referral_code) return res.status(400).json({ error: 'Missing data' });
        try { await trackReferral(referrer_phone, referred_phone, referral_code); res.json({ success: true }); }
        catch { res.status(500).json({ error: 'Failed to track referral' }); }
    });
    app.post('/api/referral/claim-reward', async (req, res) => {
        const { phone, referral_code } = req.body;
        if (!phone || !referral_code) return res.status(400).json({ error: 'Missing data' });
        try { res.json({ success: true, result: await claimReferral(phone, referral_code) }); }
        catch { res.status(500).json({ error: 'Failed to claim referral reward' }); }
    });
}

async function fetchSeoData(pathname: string): Promise<any> {
    try { return { seo: await getSeoPage(pathname), faqs: await getFaqForPage(pathname) }; }
    catch { return { seo: null, faqs: [] }; }
}
