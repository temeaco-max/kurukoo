/** Composition-root contract test. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AddressInfo } from 'node:net';

const indexSource = await fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const publicSource = await fs.readFile(new URL('../src/routes/publicRoutes.ts', import.meta.url), 'utf8');

const canonicalImports = [
  'authRoutes','chatRouter','orderRoutes','presenceRoutes','discoveryRoutes','contentRoutes','publicRoutes',
  'pricingRoutes','subscriptionRoutes','channelRoutes','circleRoutes','economicRequestRouter','adminRoutes',
  'paymentRoutes','userRoutes','taskRoutes','trustRoutes','webrtcRoutes','systemRoutes','healthRoutes',
];
for (const name of canonicalImports) assert.match(indexSource, new RegExp(`from './routes/${name}\\.js'`), `index.ts must import existing ${name}`);

const requiredMounts = [
  "app.use('/api/auth', authRoutes)","app.use('/api/chat', chatRouter)","app.use('/api', userRoutes)","app.use('/api', taskRoutes)","app.use('/api', trustRoutes)","app.use('/api/webrtc', webrtcRoutes)","app.use('/', systemRoutes)",
  "app.use('/', healthRoutes)","app.use('/', presenceRoutes)","app.use('/', discoveryRoutes)","app.use('/', contentRoutes)",
  "app.use('/', publicRoutes)","app.use('/api/pricing', pricingRoutes)","app.use('/api', subscriptionRoutes)",
];
for (const mount of requiredMounts) assert.ok(indexSource.includes(mount), `missing composition boundary: ${mount}`);
assert.doesNotMatch(indexSource, /legacyApp|registerLegacyRoutes/, 'composition root must not depend on legacyApp');

for (const route of ["router.get('/',", "router.get('/explore',", "router.get('/p/:providerSlug',"]) {
  assert.ok(publicSource.includes(route), `publicRoutes must own ${route}`);
}
assert.match(indexSource,/dotenv\.config\(\)/, 'startup environment initialization must remain in composition root');

process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test';
const { app } = await import('../src/index.ts');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
try {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/api/webrtc/peers?roomId=composition-test`);
  assert.equal(response.status, 401, 'mounted WebRTC API must reject anonymous callers');
  const docs = await fetch(`http://127.0.0.1:${port}/api/docs`);
  assert.equal(docs.status, 200, 'mounted system router must serve the existing API documentation');
  const escrow = await fetch(`http://127.0.0.1:${port}/api/escrow`);
  assert.equal(escrow.status, 401, 'mounted trust API must reject anonymous escrow access');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log('test-composition-routes: PASS');
