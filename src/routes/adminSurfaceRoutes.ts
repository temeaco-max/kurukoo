/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import express from 'express';
import path from 'node:path';

const router = express.Router();

const pages: Record<string, string> = {
  '/': 'index.html',
  '/conversations': 'index.html',
  '/providers': 'index.html',
  '/economic': 'index.html',
  '/moderation': 'index.html',
  '/compliance': 'index.html',
  '/notifications': 'index.html',
  '/integrations': 'index.html',
  '/agents': 'ai-agents.html',
  '/users': 'users.html',
  '/pricing': 'pricing.html',
  '/referrals': 'referrals.html',
  '/commissions': 'commissions.html',
  '/partnerships': 'partnerships.html',
  '/scam': 'scam.html',
  '/social': 'social.html',
  '/creators': 'artists.html',
  '/celebrity': 'celebrity.html',
  '/analytics': 'analytics.html',
  '/revenue': 'revenue.html',
  '/marketing': 'marketing.html',
  '/advertising': 'ads.html',
  '/content': 'content.html',
  '/curation': 'curation.html',
  '/settings': 'index.html',
  '/seo': 'index.html',
  '/roadmap': 'future.html',
};

for (const [route, file] of Object.entries(pages)) {
  router.get(route, (_req, res, next) => {
    res.sendFile(path.join(process.cwd(), 'admin', file), error => {
      if (error) next(error);
    });
  });
}

export default router;
