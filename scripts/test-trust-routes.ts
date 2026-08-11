/**
 * Contract test: trust routes (disputes/escrow/scam) use JWT phone only.
 * Run: npx tsx scripts/test-trust-routes.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function main() {
  const src = await fs.readFile(new URL('../src/routes/trustRoutes.ts', import.meta.url), 'utf8');
  const orderFinalizer = await fs.readFile(new URL('../src/services/orderFinalizer.ts', import.meta.url), 'utf8');
  assert.match(src, /authenticateUser/, 'trustRoutes must use authenticateUser');
  assert.match(src, /req\.user\?\.phone|sessionPhone/, 'identity from JWT session');
  assert.match(src, /must match session|Forbidden/, 'must reject mismatched client phone');
  assert.doesNotMatch(src, /\+2348030000000/, 'no demo phone');
  assert.doesNotMatch(
    src,
    /const\s+phone\s*=\s*(req\.body|req\.query)\.phone/,
    'must not take identity solely from client body/query'
  );
  assert.match(src, /dispute|escrow|scam/i, 'trust domain present');
  assert.match(src, /Direct escrow creation is disabled/, 'legacy direct escrow creation must remain disabled');
  assert.doesNotMatch(src, /await\s+createEscrow\(/, 'trust route must not create a ledger from client-supplied details');
  assert.doesNotMatch(orderFinalizer, /INSERT INTO escrow/, 'legacy order finalizer must not create escrow outside the verified payment flow');
  assert.match(orderFinalizer, /Payment reference verification must complete through the Economic Request flow/, 'legacy order finalizer must fail closed without a verified payment reference');

  const { createEscrow } = await import('../src/services/escrow.js');
  await assert.rejects(
    () => createEscrow('order-test', '+2347000000101', '+2347000000102', 100, 'test ledger', undefined as never),
    /Verified payment evidence is required/,
    'escrow service must reject missing trusted payment evidence before database access',
  );
  console.log('test-trust-routes: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
