/**
 * Contract test: admin routes require authenticateAdmin (JWT admin claim).
 * Pricing is a separate route boundary and is tested independently.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const paths = [
  '/api/admin/tickets',
  '/api/admin/disputes',
  '/api/admin/users',
  '/api/admin/ai-agents',
  '/api/admin/analytics',
  '/api/admin/content',
  '/api/admin/stats',
  '/api/admin/pilot-readiness',
  '/api/admin/external-integrations',
  '/api/admin/ads',
  '/api/admin/operator/state',
  '/api/admin/operator/chat',
  '/api/admin/operator/actors',
  '/api/admin/operator/actors/:actorId/chat',
  '/api/admin/operator/actors/:actorId/reset',
];

async function main() {
  const mod = await import('../src/routes/adminRoutes.ts');
  assert.ok(mod.default || mod.adminRoutes, 'adminRoutes export missing');
  const src = await import('node:fs').then((fs) =>
    fs.promises.readFile(new URL('../src/routes/adminRoutes.ts', import.meta.url), 'utf8')
  );
  const publicRoutes = await fs.promises.readFile(path.join(process.cwd(), 'src', 'routes', 'publicRoutes.ts'), 'utf8');
  assert.match(publicRoutes, /router\.get\('\/admin'/, 'the canonical /admin entry route must exist');
  for (const file of ['login.html', 'dashboard.html', 'ads.html', 'analytics.html', 'ai-agents.html', 'content.html', 'seo.html', 'users.html', 'pricing.html', 'revenue.html']) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'admin', file)), `admin page ${file} must exist`);
  }
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'admin', 'admin-auth.js')), 'shared admin auth boundary must exist');
  for (const file of await fs.promises.readdir(path.join(process.cwd(), 'public', 'admin'))) {
    if (!file.endsWith('.html')) continue;
    const page = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', file), 'utf8');
    assert.match(page, /admin-auth\.js/, `${file} must include the shared admin auth boundary`);
  }
  const dashboard = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'dashboard.html'), 'utf8');
  assert.match(dashboard, /(?:fetch|adminFetch)\('\/api\/admin\/ads'/, 'admin dashboard campaigns must use the protected admin ads owner');
  assert.match(dashboard, /(?:fetch|adminFetch)\('\/api\/admin\/content'/, 'admin dashboard CMS must use the protected admin content owner');
  assert.doesNotMatch(dashboard, /fetch\('\/api\/ads'/, 'admin dashboard must not use the public ads path');
  assert.doesNotMatch(dashboard, /fetch\('\/api\/content'/, 'admin dashboard must not use the public content path');
  assert.match(src, /router\.get\('\/celebrity',\s*authenticateAdmin/, 'celebrity demand must have a protected admin endpoint');
  const celebrity = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'celebrity.html'), 'utf8');
  assert.match(celebrity, /fetch\('\/api\/admin\/celebrity'/, 'celebrity demand page must use its protected admin endpoint');
  assert.match(celebrity, /x-admin-token.*localStorage\.getItem\('kurukoo_admin'\)/, 'celebrity demand page must forward the shared admin token');
  const future = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'future.html'), 'utf8');
  assert.match(future, /fetch\('\/api\/admin\/future_plans'/, 'future roadmap page must use its protected admin endpoint');
  assert.match(future, /x-admin-token.*localStorage\.getItem\('kurukoo_admin'\)/, 'future roadmap page must forward the shared admin token');
  assert.match(src, /listCoordinatorRuns/, 'admin stats must expose coordinator run telemetry');
  assert.match(src, /recentRuns/, 'admin stats must expose recent coordinator runs');
  assert.match(src, /autonomous: process\.env\.KURUKOO_AGENT_AUTONOMOUS/, 'admin stats must expose the effective autonomy gate');
  assert.match(src, /teacherEnabled: process\.env\.KURUKOO_COORDINATOR_TEACHER_ENABLED/, 'admin stats must expose teacher-mode state');
  assert.match(src, /recentLearningArtifacts/, 'admin stats must expose candidate learning artifacts');
  assert.match(src, /router\.get\('\/external-integrations',\s*authenticateAdmin/, 'external integration readiness must remain on the protected admin boundary');
  assert.match(src, /getExternalIntegrationReadiness/, 'admin integration readiness must reuse the canonical projection');
  assert.match(src, /authenticateAdmin/, 'adminRoutes must use authenticateAdmin');
  assert.match(src, /operatorSession: true/, 'operator Chat must issue an explicit operator session claim');
  assert.match(src, /testActor: true/, 'Test As must issue an explicit actor claim');
  assert.match(src, /isolated_actor_context/, 'Test As must disclose the isolated actor boundary');
  assert.doesNotMatch(src, /\\+2348030000000/, 'no demo phone in admin routes');
  for (const p of paths) {
    assert.ok(src.includes(p.replace('/api/admin', '')) || src.includes(p), `path reference for ${p}`);
  }
  console.log('test-admin-routes: PASS: protected API registry, canonical /admin entry, and core static admin revamp pages are present');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
