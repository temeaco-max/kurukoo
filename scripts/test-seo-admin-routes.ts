/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Contract test: seoAdminRoutes exposes expected §53 SEO admin paths.
 */

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-seo-admin-routes-${process.pid}-${Date.now()}.sqlite`;
const { default: seoAdminRoutes } = await import('../src/routes/seoAdminRoutes.js');

const expected = [
  '/dashboard',
  '/health',
  '/settings',
  '/pages',
  '/faqs',
  '/faqs/:id',
  '/keywords',
  '/keywords/:id',
  '/redirects',
  '/redirects/:id',
  '/schemas',
  '/schemas/:id',
  '/internal-links',
  '/internal-links/:id',
  '/backlinks',
  '/backlinks/:id',
  '/content-calendar',
  '/content-calendar/:id',
  '/content-briefs',
  '/content-briefs/:id',
  '/404-log',
  '/404-log/ignore/:id',
  '/generate-alt-text',
  '/generate-faqs',
  '/generate-brief',
  '/run-audit',
  '/audits',
  '/rankings',
  '/orphans',
  '/image-meta',
  '/image-meta/generate-alt',
  '/image-meta/:id',
];

const stack = (seoAdminRoutes as any).stack || [];
const routes: string[] = stack.filter((layer: any) => layer.route).map((layer: any) => layer.route.path);

const missing = expected.filter((path) => !routes.includes(path));
if (missing.length) {
  throw new Error(`SEO admin route module is missing: ${missing.join(', ')}`);
}

console.log(`SEO admin route module contract passed: ${routes.length} registered paths (checked ${expected.length} required).`);
