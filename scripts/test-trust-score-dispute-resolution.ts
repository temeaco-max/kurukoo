/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'trust-score-dispute-test-secret-0123456789';
process.env.DB_PATH = process.env.DB_PATH || `tmp/trust-score-dispute-test-${Date.now()}.sqlite`;

const { ensureTrustScoreSchema, recalculateTrustScore, listTrustScoreLedger, getTrustScoreBreakdown } = await import('../src/services/trustScore.ts');
const { getDb, saveDb } = await import('../src/database.ts');

// Ensure schema is initialized
await ensureTrustScoreSchema();

const buyerPhone = '+2348035550101';
const providerPhone = '+2348035550202';
const orderId = `test-order-${Date.now()}`;

// Set up test data: buyer, provider, order, escrow, and dispute
const db = await getDb();

// Create buyer profile
db.run(`INSERT OR REPLACE INTO memory_profiles
  (phone, name, created_at, verified_provider, trust_score)
  VALUES (?, 'Test Buyer', datetime('now','-30 days'), 0, 5.0)`,
  [buyerPhone]);

// Create provider profile
db.run(`INSERT OR REPLACE INTO memory_profiles
  (phone, name, created_at, verified_provider, trust_score)
  VALUES (?, 'Test Provider', datetime('now','-30 days'), 1, 5.0)`,
  [providerPhone]);

// Create skills for provider
db.run(`INSERT OR IGNORE INTO skills (phone, skill, jobs_completed, rating)
  VALUES (?, 'plumber', 10, 4.5)`,
  [providerPhone]);

// Create order
db.run(`INSERT OR REPLACE INTO orders (id, phone, order_type, provider_phone, amount, status)
  VALUES (?, ?, 'service', ?, 5000, 'pending')`,
  [orderId, buyerPhone, providerPhone]);

// Create escrow
db.run(`INSERT INTO escrow (order_id, buyer_phone, provider_phone, amount_minor, description, status)
  VALUES (?, ?, ?, 5000, 'Test service', 'held')`,
  [orderId, buyerPhone, providerPhone]);

// Create dispute (buyer opens dispute)
db.run(`INSERT INTO disputes (phone, order_id, reason, status, type)
  VALUES (?, ?, 'Service not completed', 'open', 'dispute')`,
  [buyerPhone, orderId]);

// Get dispute ID
const disputeResult = db.exec(`SELECT id FROM disputes WHERE order_id = ? ORDER BY id DESC LIMIT 1`, [orderId]);
const disputeId = Number(disputeResult?.[0]?.values?.[0]?.[0]);
assert.ok(disputeId, 'Dispute should have been created');

// ---------------------------------------------------------------------------
// Test 1: Dispute resolution with 'release' → buyer at fault → buyer trust recalculated
// ---------------------------------------------------------------------------
console.log('Test 1: Dispute resolution with release (buyer at fault)');

const { resolveDisputeWithEconomicLifecycle } = await import('../src/services/disputeResolution.ts');

// Record initial trust score for buyer
const initialBuyerTrust = await getTrustScoreBreakdown(buyerPhone);
assert.ok(initialBuyerTrust, 'Should have initial trust score for buyer');

// Resolve dispute with 'release' (escrow to provider) → buyer is at fault
await resolveDisputeWithEconomicLifecycle(disputeId, 'release');

// Verify dispute is resolved
const disputeStatus = db.exec(`SELECT status, fault_party, fault_phone FROM disputes WHERE id = ?`, [disputeId]);
const disputeRow = disputeStatus[0]?.values?.[0];
assert.equal(disputeRow[0], 'resolved', 'Dispute should be resolved');
assert.equal(disputeRow[1], 'buyer', 'Fault party should be buyer');
assert.equal(disputeRow[2], buyerPhone, 'Fault phone should be buyer phone');

// Verify trust score ledger has an entry for the dispute fault
const ledger = await listTrustScoreLedger(buyerPhone, 10);
const disputeEntry = ledger.find((entry: { reason: string }) => entry.reason === 'reviewed_dispute_fault' || entry.reason === 'reviewed_dispute');
assert.ok(disputeEntry, 'Trust ledger should have a dispute fault entry for buyer');

console.log(`  OK - Buyer trust score recalculated after dispute (reason: ${disputeEntry?.reason})`);

// ---------------------------------------------------------------------------
// Test 2: Dispute resolution with 'refund' → provider at fault → provider trust recalculated
// ---------------------------------------------------------------------------
console.log('Test 2: Dispute resolution with refund (provider at fault)');

// Create a second order and dispute
const orderId2 = `test-order-2-${Date.now()}`;
const providerPhone2 = '+2348035550303';

db.run(`INSERT OR REPLACE INTO memory_profiles
  (phone, name, created_at, verified_provider, trust_score)
  VALUES (?, 'Test Provider 2', datetime('now','-30 days'), 0, 5.0)`,
  [providerPhone2]);

// Add skills with lower ratings for the provider (to affect trust score)
db.run(`INSERT OR IGNORE INTO skills (phone, skill, jobs_completed, rating)
  VALUES (?, 'plumber', 50, 3.0)`,
  [providerPhone2]);

db.run(`INSERT OR REPLACE INTO orders (id, phone, order_type, provider_phone, amount, status)
  VALUES (?, ?, 'service', ?, 3000, 'pending')`,
  [orderId2, buyerPhone, providerPhone2]);

db.run(`INSERT INTO escrow (order_id, buyer_phone, provider_phone, amount_minor, description, status)
  VALUES (?, ?, ?, 3000, 'Test service 2', 'held')`,
  [orderId2, buyerPhone, providerPhone2]);

db.run(`INSERT INTO disputes (phone, order_id, reason, status, type)
  VALUES (?, ?, 'Poor service quality', 'open', 'dispute')`,
  [buyerPhone, orderId2]);

const disputeResult2 = db.exec(`SELECT id FROM disputes WHERE order_id = ? ORDER BY id DESC LIMIT 1`, [orderId2]);
const disputeId2 = Number(disputeResult2?.[0]?.values?.[0]?.[0]);
assert.ok(disputeId2, 'Second dispute should have been created');

// Resolve with 'refund' (escrow to buyer) → provider is at fault
await resolveDisputeWithEconomicLifecycle(disputeId2, 'refund');

// Verify dispute is resolved
const disputeStatus2 = db.exec(`SELECT status, fault_party, fault_phone FROM disputes WHERE id = ?`, [disputeId2]);
const disputeRow2 = disputeStatus2[0]?.values?.[0];
assert.equal(disputeRow2[0], 'resolved', 'Dispute 2 should be resolved');
assert.equal(disputeRow2[1], 'provider', 'Fault party should be provider');
assert.equal(disputeRow2[2], providerPhone2, 'Fault phone should be provider phone');

// Verify trust score ledger has an entry for the provider
const providerLedger = await listTrustScoreLedger(providerPhone2, 10);
const providerDisputeEntry = providerLedger.find((entry: { reason: string }) => entry.reason === 'reviewed_dispute_fault' || entry.reason === 'reviewed_dispute');
assert.ok(providerDisputeEntry, 'Trust ledger should have a dispute fault entry for provider');

console.log(`  OK - Provider trust score recalculated after dispute (reason: ${providerDisputeEntry?.reason})`);

// ---------------------------------------------------------------------------
// Test 3: Explicit faultParty override
// ---------------------------------------------------------------------------
console.log('Test 3: Explicit faultParty override');

const orderId3 = `test-order-3-${Date.now()}`;
const providerPhone3 = '+2348035550404';

db.run(`INSERT OR REPLACE INTO memory_profiles
  (phone, name, created_at, verified_provider, trust_score)
  VALUES (?, 'Test Provider 3', datetime('now','-10 days'), 0, 5.0)`,
  [providerPhone3]);

db.run(`INSERT OR IGNORE INTO skills (phone, skill, jobs_completed, rating)
  VALUES (?, 'electrician', 5, 4.0)`,
  [providerPhone3]);

db.run(`INSERT OR REPLACE INTO orders (id, phone, order_type, provider_phone, amount, status)
  VALUES (?, ?, 'service', ?, 7000, 'pending')`,
  [orderId3, buyerPhone, providerPhone3]);

db.run(`INSERT INTO escrow (order_id, buyer_phone, provider_phone, amount_minor, description, status)
  VALUES (?, ?, ?, 7000, 'Test service 3', 'held')`,
  [orderId3, buyerPhone, providerPhone3]);

db.run(`INSERT INTO disputes (phone, order_id, reason, status, type)
  VALUES (?, ?, 'Disputed amount', 'open', 'dispute')`,
  [buyerPhone, orderId3]);

const disputeResult3 = db.exec(`SELECT id FROM disputes WHERE order_id = ? ORDER BY id DESC LIMIT 1`, [orderId3]);
const disputeId3 = Number(disputeResult3?.[0]?.values?.[0]?.[0]);
assert.ok(disputeId3, 'Third dispute should have been created');

// Resolve with 'release' but explicitly say provider is at fault (mutual agreement)
await resolveDisputeWithEconomicLifecycle(disputeId3, 'release', 'provider');

const disputeStatus3 = db.exec(`SELECT status, fault_party, fault_phone FROM disputes WHERE id = ?`, [disputeId3]);
const disputeRow3 = disputeStatus3[0]?.values?.[0];
assert.equal(disputeRow3[0], 'resolved', 'Dispute 3 should be resolved');
assert.equal(disputeRow3[1], 'provider', 'Explicit fault party should override inference');
assert.equal(disputeRow3[2], providerPhone3, 'Fault phone should be provider phone');

console.log('  OK - Explicit faultParty override works correctly');

// ---------------------------------------------------------------------------
// Test 4: Trust score breaks down after dispute fault
// ---------------------------------------------------------------------------
console.log('Test 4: Trust score reflects dispute fault');

const buyerTrustAfter = await getTrustScoreBreakdown(buyerPhone);
assert.ok(buyerTrustAfter, 'Should have trust score for buyer after disputes');
assert.ok(buyerTrustAfter.disputesLost > 0, 'Buyer should have disputesLost > 0');

const providerTrustAfter = await getTrustScoreBreakdown(providerPhone2);
assert.ok(providerTrustAfter, 'Should have trust score for provider after disputes');
assert.ok(providerTrustAfter.disputesLost > 0, 'Provider should have disputesLost > 0');

console.log(`  Buyer trust: ${buyerTrustAfter.score} (disputes lost: ${buyerTrustAfter.disputesLost})`);
console.log(`  Provider trust: ${providerTrustAfter.score} (disputes lost: ${providerTrustAfter.disputesLost})`);

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
console.log('\nTrust-score dispute resolution tests passed.');
console.log(JSON.stringify({
  ok: true,
  testsPassed: 4,
}, null, 2));
