/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/*
 * Canonical page-content API. Serves the same content the EJS public pages
 * render (SEO metadata, JSON-LD schemas, FAQs, country experience, live
 * readiness and provider data) as JSON so the Kurukoo React frontend can
 * render identical content. Shares the same underlying services as the views.
 */
import express, { Router } from 'express';
import { fetchSeoData } from '../services/seoService.js';
import { getCountryExperience } from '../services/countryExperience.js';
import { getPilotReadiness } from '../services/pilotReadiness.js';
import { getExternalIntegrationReadiness } from '../services/externalIntegrationReadiness.js';
import { getDb } from '../database.js';
import { getAllResourceMetadata, getResourceBySlug } from '../services/contentManager.js';

export function createPageContentRouter(): Router {
  const router = express.Router();

  const sanitizePath = (raw: unknown): string => {
    const value = typeof raw === 'string' ? raw : '';
    if (!value.startsWith('/') || value.includes('..')) return '/';
    return value.split('?')[0].slice(0, 200);
  };

  /** GET /api/content/page?path=/about — SEO, schemas, FAQs and country experience for any public page. */
  router.get('/api/content/page', async (req, res, next) => {
    try {
      const pagePath = sanitizePath(req.query.path);
      const { seo, schemas, faqs } = await fetchSeoData(pagePath);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({
        path: pagePath,
        countryExperience: getCountryExperience(req.query.country),
        seo,
        schemas,
        faqs,
      });
    } catch (error) { next(error); }
  });

  /** GET /api/content/home — homepage content bundle. */
  router.get('/api/content/home', async (req, res, next) => {
    try {
      const { seo, schemas, faqs } = await fetchSeoData('/');
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json({
        path: '/',
        countryExperience: getCountryExperience(req.query.country),
        seo,
        schemas,
        faqs,
      });
    } catch (error) { next(error); }
  });

  /** GET /api/content/channels — live channel readiness (mirrors the /channels EJS page). */
  router.get('/api/content/channels', async (_req, res, next) => {
    try {
      const readiness = getPilotReadiness();
      const channels = readiness.categories?.CHANNELS ?? {};
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({
        channelStatuses: {
          web: channels.Web ?? null,
          whatsapp: channels.WhatsApp ?? null,
          telegram: channels.Telegram ?? null,
          sms: channels.SMS ?? null,
          ussd: channels.USSD ?? null,
          email: channels.Email ?? null,
          fcm: channels.FCM ?? null,
          voice: channels.Voice ?? null,
        },
        integrationReadiness: getExternalIntegrationReadiness(),
      });
    } catch (error) { next(error); }
  });

  /** GET /api/content/providers/:slug — public provider profile content. The /p/:providerSlug page is retired; this JSON contract is the owner. */
  router.get('/api/content/providers/:slug', async (req, res, next) => {
    try {
      const slug = String(req.params.slug || '').slice(0, 120);
      if (!slug || slug.includes('..')) return res.status(400).json({ error: 'Invalid provider slug' });
      const db = await getDb();
      const stmt = db.prepare("SELECT * FROM memory_profiles WHERE phone = ? OR lower(replace(replace(COALESCE(name, ''), ' ', '-'), '_', '-')) = lower(?) LIMIT 1");
      stmt.bind([slug, slug]);
      let profile: Record<string, unknown> | null = null;
      if (stmt.step()) profile = stmt.getAsObject();
      stmt.free();
      if (!profile) return res.status(404).json({ error: 'Provider not found' });
      const sStmt = db.prepare('SELECT * FROM skills WHERE phone = ?');
      sStmt.bind([String(profile.phone)]);
      const skills: Array<Record<string, unknown>> = [];
      while (sStmt.step()) skills.push(sStmt.getAsObject());
      sStmt.free();
      if (!skills.length) return res.status(404).json({ error: 'Provider not found' });
      const providerName = String(profile.name || 'Provider');
      const { seo, schemas, faqs } = await fetchSeoData(`/p/${slug}`, providerName);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({
        provider: {
          name: providerName,
          initials: providerName.charAt(0).toUpperCase(),
          location: String(profile.location || profile.primary_lga || 'Nigeria'),
          verified: profile.verified === 1,
          trustScore: Number(profile.trust_score) || 5,
          skills: skills.map((s) => ({
            skill: String(s.skill || ''),
            rating: Number(s.rating) || 5,
            jobsCompleted: Number(s.jobs_completed) || 0,
            hourlyRate: Number(s.hourly_rate) || 0,
          })),
        },
        countryExperience: getCountryExperience(profile.country),
        seo,
        schemas,
        faqs,
      });
    } catch (error) { next(error); }
  });

  /** GET /api/content/earn-map — /earn/:topic → explore category mapping (mirrors the /earn/:topic redirects). */
  router.get('/api/content/earn-map', async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      EARN_CATEGORY: {
        refer: 'money-circle',
        agents: 'professional-services',
        rides: 'transport',
        delivery: 'logistics',
        repairs: 'repairs',
        errands: 'errands-delivery',
        support: 'professional-services',
        build: 'workers',
        work: 'gigs',
        help: 'professional-services',
        sell: 'classifieds',
        promote: 'professional-services',
        contributor: 'gigs',
        tasks: 'gigs',
      },
    });
  });
/** GET /api/content/resources — public list of guides (mirrors the Resources page's latest-guides grid). */
  router.get('/api/content/resources', async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      const page = Number.parseInt(String(req.query.page || '1'), 10);
      const resources = await getAllResourceMetadata(Number.isFinite(page) ? page : 1, 20);
      res.json({ resources });
    } catch (error) { next(error); }
  });

  /** GET /api/content/resources/:slug — public single guide with rendered HTML body. */
  router.get('/api/content/resources/:slug', async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      const resource = await getResourceBySlug(String(req.params.slug || ''));
      if (!resource) return res.status(404).json({ error: 'Resource not found' });
      res.json({
        slug: resource.slug,
        title: resource.title,
        category: resource.category || 'Guide',
        body: resource.body ? getResourceBodyHtml(resource.body) : '',
        excerpt: resource.excerpt || '',
        updated_at: resource.updatedAt || null,
      });
    } catch (error) { next(error); }
  });

  return router;
}

function getResourceBodyHtml(markdown: string): string {
  return markdown
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('# ')) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
      if (trimmed.startsWith('## ')) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith('### ')) return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith('- ')) return `<ul>${trimmed.split('\n').map((line) => `<li>${escapeHtml(line.replace(/^-\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

export default createPageContentRouter();
