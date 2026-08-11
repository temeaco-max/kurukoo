/** Composition-root contract test. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const indexSource = await fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const publicSource = await fs.readFile(new URL('../src/routes/publicRoutes.ts', import.meta.url), 'utf8');

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
];
for (const mount of requiredMounts) assert.ok(indexSource.includes(mount), `missing composition boundary: ${mount}`);
assert.doesNotMatch(indexSource, /legacyApp|registerLegacyRoutes/, 'composition root must not depend on legacyApp');

for (const route of ["router.get('/',", "router.get('/explore',", "router.get('/p/:providerSlug',"]) {
  assert.ok(publicSource.includes(route), `publicRoutes must own ${route}`);
}
assert.match(indexSource,/dotenv\.config\(\)/, 'startup environment initialization must remain in composition root');
console.log('test-composition-routes: PASS');
