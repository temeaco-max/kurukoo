/** Composition-root contract test. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const indexSource = await fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const legacySource = await fs.readFile(new URL('../src/legacyApp.ts', import.meta.url), 'utf8');

const canonicalImports = [
  'authRoutes','chatRouter','orderRoutes','presenceRoutes','discoveryRoutes','contentRoutes','publicRoutes',
  'pricingRoutes','subscriptionRoutes','channelRoutes','circleRoutes','economicRequestRouter','adminRoutes',
  'paymentRoutes','userRoutes','healthRoutes',
];
for (const name of canonicalImports) assert.match(indexSource, new RegExp(`from './routes/${name}\\.js'`), `index.ts must import existing ${name}`);

const requiredMounts = [
  "app.use('/api/auth', authRoutes)","app.use('/api/chat', chatRouter)","app.use('/api', orderRoutes)",
  "app.use('/', healthRoutes)","app.use('/', presenceRoutes)","app.use('/', discoveryRoutes)","app.use('/', contentRoutes)",
  "app.use('/', publicRoutes)","app.use('/api/pricing', pricingRoutes)","app.use('/api', subscriptionRoutes)",
  'registerLegacyRoutes(app)',
];
for (const mount of requiredMounts) assert.ok(indexSource.includes(mount), `missing composition boundary: ${mount}`);
const legacyRegistration=indexSource.indexOf('registerLegacyRoutes(app)');
for (const mount of requiredMounts.filter(item=>item!=='registerLegacyRoutes(app)')) assert.ok(indexSource.indexOf(mount)<legacyRegistration,`${mount} must be mounted before legacy routes`);

// LegacyApp is intentionally limited to transitional page/SEO infrastructure.
for (const pattern of [/app\.get\('\/health'/,/app\.get\('\/'/,/app\.get\('\/explore'/,/app\.get\('\/p\/:providerSlug'/,/app\.post\('\/api\/referral\//]) {
  assert.doesNotMatch(legacySource, pattern, 'legacyApp must not regain canonical product/business routes');
}
assert.match(legacySource,/getRobotsTxt|getLlmsTxt|getSitemapIndex/, 'legacyApp must retain transitional SEO infrastructure');
console.log('test-composition-routes: PASS');
