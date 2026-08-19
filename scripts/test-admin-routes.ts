/**
 * Contract test: Admin routes require authenticateAdmin and the control room
 * exposes one canonical platform projection for every client family.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const paths = [
  '/api/admin/tickets', '/api/admin/disputes', '/api/admin/users', '/api/admin/ai-agents',
  '/api/admin/analytics', '/api/admin/content', '/api/admin/stats', '/api/admin/pilot-readiness',
  '/api/admin/external-integrations', '/api/admin/ads', '/api/admin/operator/state',
  '/api/admin/operator/chat', '/api/admin/operator/actors', '/api/admin/operator/actors/:actorId/chat',
  '/api/admin/operator/actors/:actorId/reset',
];

async function main() {
  const mod = await import('../src/routes/adminRoutes.ts');
  const platform = await import('../src/routes/adminPlatformRoutes.ts');
  const disputeRoutes = await import('../src/routes/adminDisputeRoutes.ts');
  assert.ok(mod.default || mod.adminRoutes, 'adminRoutes export missing');
  assert.ok(platform.default, 'adminPlatformRoutes export missing');
  assert.ok(disputeRoutes.default, 'adminDisputeRoutes export missing');

  const src = await fs.promises.readFile(new URL('../src/routes/adminRoutes.ts', import.meta.url), 'utf8');
  const platformSrc = await fs.promises.readFile(new URL('../src/routes/adminPlatformRoutes.ts', import.meta.url), 'utf8');
  const disputeSrc = await fs.promises.readFile(new URL('../src/routes/adminDisputeRoutes.ts', import.meta.url), 'utf8');
  const disputeServiceSrc = await fs.promises.readFile(new URL('../src/services/disputeResolution.ts', import.meta.url), 'utf8');
  const serviceSrc = await fs.promises.readFile(new URL('../src/services/adminPlatformService.ts', import.meta.url), 'utf8');
  const scaleSrc = await fs.promises.readFile(new URL('../src/services/scaleTransition.ts', import.meta.url), 'utf8');
  const authSrc = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'admin-auth.js'), 'utf8');
  const indexSrc = await fs.promises.readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const publicRoutes = await fs.promises.readFile(path.join(process.cwd(), 'src', 'routes', 'publicRoutes.ts'), 'utf8');

  assert.match(publicRoutes, /router\.get\('\/admin'/, 'canonical /admin entry route must exist');
  assert.match(indexSrc, /app\.use\('\/api\/admin\/platform',\s*adminPlatformRoutes\)/, 'platform admin router must be mounted before the general admin router');
  assert.match(indexSrc, /app\.use\('\/api\/admin',\s*adminDisputeRoutes\)\s*;\s*app\.use\('\/api\/admin',\s*adminRoutes\)/, 'canonical dispute/ticket routes must be mounted before legacy admin handlers');

  for (const file of ['login.html', 'dashboard.html', 'ads.html', 'analytics.html', 'ai-agents.html', 'content.html', 'seo.html', 'users.html', 'pricing.html', 'revenue.html']) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'admin', file)), `admin page ${file} must exist`);
  }
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'admin', 'admin-auth.js')), 'shared admin auth boundary must exist');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'css', 'admin-pages', 'admin-convergence-shell.css')), 'shared Admin convergence shell stylesheet must exist');
  assert.match(authSrc, /x-admin-token/, 'shared admin auth must forward the operator token');
  assert.match(authSrc, /localStorage\.removeItem\('kurukoo_admin'\)/, 'shared admin auth must clear expired credentials');
  assert.match(authSrc, /\/api\/admin\/platform\/health/, 'shared admin auth must surface platform health');
  for (const file of await fs.promises.readdir(path.join(process.cwd(), 'public', 'admin'))) {
    if (!file.endsWith('.html')) continue;
    const page = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', file), 'utf8');
    if (file === 'dashboard.html') continue;
    if (file !== 'login.html') assert.match(page, /admin-auth\.js/, `${file} must include the shared admin auth boundary`);
  }

  const index = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'index.html'), 'utf8');
  const adminJs = await fs.promises.readFile(path.join(process.cwd(), 'public', 'js', 'kurukoo-admin.js'), 'utf8');
  assert.match(index, /One canonical backend for Web, PWA, iOS, Android/, 'control room must state cross-platform ownership');
  assert.match(index, /admin-platform-convergence\.css/, 'control room must load the canonical convergence stylesheet');
  assert.match(adminJs, /\/api\/admin\/platform\/overview/, 'control room must consume canonical platform projection');
  assert.match(adminJs, /\/api\/admin\/trust\/readiness/, 'operational sections must consume canonical trust readiness');
  assert.match(adminJs, /renderModules/, 'control room must render canonical admin module registry');
  assert.match(adminJs, /renderPilotReadiness/, 'control room must render canonical dependency readiness');
  assert.match(adminJs, /renderScaleTransition/, 'control room must render scale transition readiness');

  assert.match(platformSrc, /router\.use\(authenticateAdmin\)/, 'platform projection must require admin authentication');
  assert.match(platformSrc, /router\.get\('\/overview'/, 'platform overview endpoint must exist');
  assert.match(platformSrc, /router\.get\('\/surfaces'/, 'surface contract endpoint must exist');
  assert.match(platformSrc, /router\.get\('\/modules'/, 'module registry endpoint must exist');
  assert.match(platformSrc, /router\.get\('\/health'/, 'platform health endpoint must exist');
  assert.match(platformSrc, /router\.get\('\/scale-readiness'/, 'scale readiness endpoint must exist');
  assert.match(platformSrc, /router\.get\('\/activation-matrix'/, 'external activation matrix endpoint must exist');
  assert.match(platformSrc, /getExternalIntegrationOperationalStatus/, 'activation matrix must reuse canonical operational status');
  assert.match(serviceSrc, /clientSurfaceRegistry/, 'admin platform service must reuse client surface registry');
  assert.match(serviceSrc, /externalIntegrationReadiness/, 'admin platform service must reuse integration readiness');
  assert.match(serviceSrc, /pilotReadiness/, 'admin platform service must expose canonical dependency readiness');
  assert.match(serviceSrc, /getScaleTransitionReport/, 'admin platform service must expose canonical scale readiness');
  assert.match(serviceSrc, /scaleTransition/, 'admin platform response must include scale transition state');
  assert.match(serviceSrc, /ADMIN_MODULES/, 'admin module registry must have a canonical owner');
  assert.match(serviceSrc, /evidence-gated/, 'external claims must remain evidence-gated');
  assert.match(scaleSrc, /KURUKOO_WORKERS/, 'scale readiness must reason from worker concurrency');
  assert.match(scaleSrc, /DATABASE_URL|POSTGRES_URL/, 'scale readiness must identify approved multi-process persistence signals');
  assert.match(scaleSrc, /REDIS_URL|REDIS_HOST/, 'scale readiness must identify shared queue/limit state');

  assert.doesNotMatch(disputeSrc, /router\.use\(authenticateAdmin\)/, 'canonical dispute admin router must not globally guard public Admin login paths');
  assert.match(disputeSrc, /router\.post\('\/disputes\/resolve',\s*authenticateAdmin/, 'dispute resolution must require Admin auth');
  assert.match(disputeSrc, /router\.post\('\/disputes\/escalate',\s*authenticateAdmin/, 'dispute escalation must require Admin auth');
  assert.match(disputeSrc, /router\.post\('\/tickets\/reply',\s*authenticateAdmin/, 'ticket reply must require Admin auth');
  assert.match(disputeSrc, /resolveDisputeWithEconomicLifecycle/, 'admin dispute route must use canonical resolution lifecycle');
  assert.match(disputeSrc, /resolveDispute\(/, 'admin ticket reply must use canonical dispute service');
  assert.match(disputeSrc, /escalateDispute/, 'admin escalation route must use canonical dispute service');
  assert.match(disputeServiceSrc, /releaseEscrow/, 'dispute lifecycle must use canonical escrow release');
  assert.match(disputeServiceSrc, /refundEscrow/, 'dispute lifecycle must use canonical escrow refund');
  assert.match(disputeServiceSrc, /transitionEconomicRequest/, 'dispute lifecycle must update the canonical economic request state');

  const dashboard = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'dashboard.html'), 'utf8');
  assert.match(dashboard, /location\.replace\('\/admin\/'\)/, 'legacy dashboard must converge to the canonical Control Room');
  assert.match(dashboard, /<link rel="canonical" href="\/admin\/">/, 'legacy dashboard must advertise Control Room as canonical');
  assert.doesNotMatch(dashboard, /fetch\('\/api\/ads'/, 'legacy dashboard must not use public ads path');
  assert.doesNotMatch(dashboard, /fetch\('\/api\/content'/, 'legacy dashboard must not use public content path');

  assert.match(src, /router\.get\('\/celebrity',\s*authenticateAdmin/, 'celebrity demand must have a protected endpoint');
  const celebrity = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'celebrity.html'), 'utf8');
  assert.match(celebrity, /fetch\('\/api\/admin\/celebrity'/, 'celebrity demand page must use protected endpoint');
  const future = await fs.promises.readFile(path.join(process.cwd(), 'public', 'admin', 'future.html'), 'utf8');
  assert.match(future, /fetch\('\/api\/admin\/future_plans'/, 'future roadmap page must use protected endpoint');

  assert.match(src, /getExternalIntegrationReadiness/, 'admin integration readiness must reuse canonical projection');
  assert.match(src, /authenticateAdmin/, 'adminRoutes must use authenticateAdmin');
  assert.match(src, /operatorSession: true/, 'operator Chat must issue explicit operator claim');
  assert.match(src, /testActor: true/, 'Test As must issue explicit actor claim');
  assert.match(src, /isolated_actor_context/, 'Test As must disclose isolated actor boundary');
  assert.doesNotMatch(src, /\\+2348030000000/, 'no demo phone in admin routes');
  for (const p of paths) assert.ok(src.includes(p.replace('/api/admin', '')) || src.includes(p), `path reference for ${p}`);
  console.log('test-admin-routes: PASS: protected admin API, shared shell/auth, canonical Control Room, platform health, external activation matrix, scale transition, canonical dispute/ticket lifecycle, client-surface contract and module registry are present');
}

main().catch((e) => { console.error(e); process.exit(1); });