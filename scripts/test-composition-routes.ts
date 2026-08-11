/** Composition-root contract test. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const indexSource = await fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const routeFiles = await Promise.all([
  'authRoutes','chatRouter','orderRoutes','presenceRoutes','discoveryRoutes','contentRoutes','publicRoutes',
  'pricingRoutes','subscriptionRoutes','channelRoutes','circleRoutes','economicRequestRouter','adminRoutes',
  'adminUiRoutes','seoRoutes','paymentRoutes','userRoutes','healthRoutes',
].map(async name => [name, await fs.readFile(new URL(`../src/routes/${name}.ts`, import.meta.url), 'utf8')] as const));

const canonicalImports = [
  'authRoutes','chatRouter','orderRoutes','presenceRoutes','discoveryRoutes','contentRoutes','publicRoutes',
  'pricingRoutes','subscriptionRoutes','channelRoutes','circleRoutes','economicRequestRouter','adminRoutes',
  'adminUiRoutes','seoRoutes','paymentRoutes','userRoutes','healthRoutes',
];
for (const name of canonicalImports) assert.match(indexSource, new RegExp(`from './routes/${name}\\.js'`), `index.ts must import existing ${name}`);

const requiredMounts = [
  "app.use('/', seoRoutes)","app.use('/api/auth', authRoutes)","app.use('/api/chat', chatRouter)","app.use('/api', orderRoutes)",
  "app.use('/', healthRoutes)","app.use('/', presenceRoutes)","app.use('/', discoveryRoutes)","app.use('/', contentRoutes)",
  "app.use('/', publicRoutes)","app.use('/', adminUiRoutes)","app.use('/api/pricing', pricingRoutes)","app.use('/api', subscriptionRoutes)",
];
for (const mount of requiredMounts) assert.ok(indexSource.includes(mount), `missing composition boundary: ${mount}`);

assert.doesNotMatch(indexSource, /legacyApp|registerLegacyRoutes/, 'composition root must not depend on the removed legacy app');
await assert.rejects(fs.access(new URL('../src/legacyApp.ts', import.meta.url)), 'legacyApp.ts must be removed');

const seoSource = Object.fromEntries(routeFiles);
assert.match(seoSource.seoRoutes, /getRobotsTxt|getLlmsTxt|getSitemapIndex/, 'SEO route boundary must own public SEO infrastructure');
assert.match(seoSource.adminUiRoutes, /\/admin\/:page|login\.html/, 'admin UI route boundary must own browser admin pages');
console.log('test-composition-routes: PASS');
