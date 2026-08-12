/**
 * Contract test: admin routes require authenticateAdmin (JWT admin claim).
 * Pricing is a separate route boundary and is tested independently.
 */
import assert from 'node:assert/strict';

const paths = [
  '/api/admin/tickets',
  '/api/admin/disputes',
  '/api/admin/users',
  '/api/admin/ai-agents',
  '/api/admin/analytics',
  '/api/admin/content',
  '/api/admin/stats',
];

async function main() {
  const mod = await import('../src/routes/adminRoutes.ts');
  assert.ok(mod.default || mod.adminRoutes, 'adminRoutes export missing');
  const src = await import('node:fs').then((fs) =>
    fs.promises.readFile(new URL('../src/routes/adminRoutes.ts', import.meta.url), 'utf8')
  );
  assert.match(src, /authenticateAdmin/, 'adminRoutes must use authenticateAdmin');
  assert.doesNotMatch(src, /\\+2348030000000/, 'no demo phone in admin routes');
  for (const p of paths) {
    assert.ok(src.includes(p.replace('/api/admin', '')) || src.includes(p), `path reference for ${p}`);
  }
  console.log('test-admin-routes: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
