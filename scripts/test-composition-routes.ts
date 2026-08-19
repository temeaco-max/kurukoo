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
  /app\.use\('\/api\/auth',\s*authRoutes\)/,
  /app\.use\('\/api\/chat',\s*(?:\.\.\.prayerChatMiddleware\);\s*)?chatRouter\)/,
  /app\.use\('\/api',\s*userRoutes\)/,
  /app\.use\('\/api',\s*taskRoutes\)/,
  /app\.use\('\/api',\s*trustRoutes\)/,
  /app\.use\('\/api\/webrtc',\s*webrtcRoutes\)/,
  /app\.use\('\/',\s*systemRoutes\)/,
  /app\.use\('\/',\s*healthRoutes\)/,
  /app\.use\('\/',\s*presenceRoutes\)/,
  /app\.use\('\/',\s*discoveryRoutes\)/,
  /app\.use\('\/',\s*contentRoutes\)/,
  /app\.use\('\/',\s*publicRoutes\)/,
  /app\.use\('\/api\/pricing',\s*pricingRoutes\)/,
  /app\.use\('\/api',\s*subscriptionRoutes\)/,
];
for (const mount of requiredMounts) assert.match(indexSource, mount, `missing composition boundary: ${mount.source}`);
assert.doesNotMatch(indexSource, /legacyApp|registerLegacyRoutes/, 'composition root must not depend on legacyApp');

for (const route of ["router.get('/',", "router.get('/explore',", "router.get('/p/:providerSlug',"]) {
  assert.ok(publicSource.includes(route), `publicRoutes must own ${route}`);
}
assert.match(indexSource,/dotenv\.config\(\)/, 'startup environment initialization must remain in composition root');
assert.match(indexSource,/app\.set\('view engine', 'ejs'\)/, 'composition root must configure EJS after legacy route removal');
assert.match(indexSource,/app\.set\('views', path\.join\(process\.cwd\(\), 'views'\)\)/, 'composition root must configure the canonical views directory');
assert.match(indexSource,/startBackgroundServices, stopBackgroundServices/, 'composition root must import worker lifecycle controls');
assert.doesNotMatch(indexSource, /startBackgroundWorkers/, 'root launcher must not create a duplicate legacy worker lifecycle');
assert.match(indexSource,/process\.once\('SIGTERM'/, 'composition root must handle SIGTERM gracefully');
assert.match(indexSource,/process\.once\('SIGINT'/, 'composition root must handle SIGINT gracefully');
assert.match(indexSource,/server\.close\(/, 'composition root must drain the HTTP server during shutdown');

process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-composition-route-contract-32';
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
