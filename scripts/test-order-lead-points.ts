/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-order-lead-points-${process.pid}-${Date.now()}.sqlite`;
const { getDb, saveDb } = await import('../src/database.js');
const { finalizeOrder } = await import('../src/services/orderFinalizer.js');
const { getPointsBalance } = await import('../src/services/pointsEngine.js');

const buyer = `ci_buyer_${Date.now()}@example.com`;
const provider = `ci_lead_provider_${Date.now()}@example.com`;
const db = await getDb();
try {
  db.run(`INSERT INTO memory_profiles (phone,name,country,points_balance,grace_leads,subscription_tier) VALUES (?,?,?,?,?,?)`, [buyer, 'CI Buyer', 'ng', 0, 0, 'Base']);
  db.run(`INSERT INTO memory_profiles (phone,name,country,points_balance,grace_leads,verified_provider,provider_type) VALUES (?,?,?,?,?,?,?)`, [provider, 'CI Ride Provider', 'ng', 100, 0, 1, 'human']);
  db.run(`INSERT INTO skills (phone,skill,is_available,products,rating) VALUES (?,?,?,?,?)`, [provider, 'okada', 1, '[]', 5]);
  db.run(`INSERT INTO provider_subscriptions (phone,tier,status,leads_this_month) VALUES (?,?,?,?)`, [provider, 'Base', 'active', 0]);
  saveDb(true);
  const before = await getPointsBalance(provider);
  const result = await finalizeOrder(buyer, 'okada', { amount: 0, bookingMode: 'instant', idempotencyKey: `ci-lead-${Date.now()}` });
  const after = await getPointsBalance(provider);
  assert.equal(result.success, true);
  assert.equal(before - after, 50);
  const rows = db.exec('SELECT leads_this_month FROM provider_subscriptions WHERE phone=?', [provider]);
  assert.equal(Number(rows[0]?.values?.[0]?.[0] || 0), 1);
  console.log(JSON.stringify({ passed: true, orderId: result.orderId, pointsCharged: before - after }, null, 2));
} finally {
  db.run('DELETE FROM orders WHERE phone=? OR provider_phone=?', [buyer, provider]);
  db.run('DELETE FROM skills WHERE phone=?', [provider]);
  db.run('DELETE FROM provider_subscriptions WHERE phone=?', [provider]);
  db.run('DELETE FROM memory_profiles WHERE phone IN (?,?)', [buyer, provider]);
  saveDb(true);
}
