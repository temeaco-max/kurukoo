/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Compliance filter contract.
 *
 * Two obligations are asserted together, because the digit rule sits between them:
 *
 * 1. A money/transfer context that carries contact or account details is still
 *    blocked. Relaxing the digit rule must never open that path.
 * 2. A digit run on its own is not evidence of a scam. The canonical
 *    conversational sign-in path (AGENTS.md section 9) is the user typing their
 *    own phone number, and ordinary messages carry dates and reference ids, so
 *    those must pass. Before this rule existed these were blocked.
 *
 * Do not weaken these assertions to make a change pass: a false positive here
 * blocks sign-in and ordinary conversation, and a false negative lets a
 * pay-outside-the-platform scam through.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dbPath = path.join(os.tmpdir(), `kurukoo-compliance-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { checkCompliance } = await import('../src/services/complianceFilter.js');

const blocked: Array<[string, string]> = [
  ['send money to +2348031234567 now', 'payout request with a contact number'],
  ['Send me the money on 08031234567', 'money request with a local number'],
  ['transfer the funds to 08031234567', 'transfer wording with an account number'],
  ['wire the money to +2348031234567', 'wire wording with a contact number'],
  ['pay me directly on +2348031234567', 'off-platform payment with a contact number'],
  ['pay outside the platform to +2348031234567', 'explicit off-platform payout'],
  ['here are my bank account details 0123456789', 'bank details with an account number'],
  ['deposit the funds into 0123456789', 'deposit wording with an account number'],
  ['urgent cash needed, reach me on +2348031234567', 'urgency plus a contact number'],
  ['give me your pin 1234 to release the funds', 'pin solicitation'],
  ['share your otp 123456 to unlock the payment', 'otp solicitation'],
  ['send money urgently', 'scam keyword without digits'],
  ['double your money', 'scam keyword'],
  ['bypass kurukoo escrow', 'platform bypass wording'],
  ['western union transfer please', 'scam keyword pattern'],
  ['bitcoin investment return guaranteed', 'scam keyword'],
];

const allowed: Array<[string, string]> = [
  ['+2348031234567', 'canonical conversational sign-in: the user types their own number'],
  ['08031234567', 'local-format sign-in number'],
  ['Remind me on 2026-10-05 to call the plumber', 'an ordinary dated reminder'],
  ['Track my order 12345678', 'an order reference number'],
  ['My reference is ABC-99887766', 'a reference containing digits'],
  ['I need to order food for 4 people', 'an ordinary request'],
  ['My budget is 25000 naira', 'an ordinary price mention'],
  ['The quote is 18000', 'an ordinary quoted amount'],
  ['I was born in 1985 and live in Lagos', 'an ordinary year'],
];

for (const [text, why] of blocked) {
  assert.equal(await checkCompliance('+2348000000001', text), false, `must still block (${why}): ${text}`);
}

for (const [text, why] of allowed) {
  assert.equal(await checkCompliance('+2348000000002', text), true, `must not block (${why}): ${text}`);
}

// The blocked cases must be recorded as compliance events, so an operator can
// review what was refused rather than seeing a silent rejection.
const { getDb } = await import('../src/database.js');
const db = await getDb();
const stmt = db.prepare('SELECT COUNT(*) AS total FROM compliance_events');
let recorded = 0;
if (stmt.step()) recorded = Number(stmt.getAsObject().total ?? 0);
stmt.free();
assert.ok(recorded >= blocked.length, `every blocked message must be recorded as a compliance event (expected >= ${blocked.length}, saw ${recorded})`);

try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary cleanup is best-effort */ }
console.log(`Compliance filter contract passed: ${blocked.length} scam and payout patterns still blocked, ${allowed.length} ordinary digit-bearing messages allowed, and refusals are recorded.`);
