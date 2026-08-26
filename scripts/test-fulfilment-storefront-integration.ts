import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-fulfilment-storefront-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';

const { getDb, saveDb } = await import('../src/database.js');
const { startStorefrontSession, advanceStorefront } = await import('../src/services/agenticStorefront.js');
const { getFulfilmentForEconomicRequest, getOpenProviderInquiry } = await import('../src/services/canonicalFulfilmentService.js');

const db = await getDb();
const customerPhone = '+2347000000411';
const providerPhone = '+2347000000412';

db.run(
  `INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, verified_provider, points_balance)
   VALUES (?, ?, 'Ikeja', 'ng', ?, 30)`,
  [customerPhone, 'Fulfilment Customer', 0]
);
db.run(
  `INSERT OR REPLACE INTO memory_profiles (phone, name, location, country, verified_provider, points_balance)
   VALUES (?, ?, 'Ikeja', 'ng', ?, 30)`,
  [providerPhone, 'Fulfilment Provider', 1]
);
db.run(
  `INSERT INTO skills (phone, skill, is_available, hourly_rate, rating, jobs_completed, operation_mode)
   VALUES (?, 'plumber', 1, 0, 4.8, 10, 'mobile')`,
  [providerPhone]
);

try {
  const initial = await startStorefrontSession(customerPhone, 'find_worker', { service: 'plumber', location: 'Ikeja' }, { forceNew: true });
  assert.ok(initial.requestId, 'A real storefront request must receive an Economic Request identity.');
  assert.equal(initial.skill, 'find_worker');
  assert.ok(initial.providers?.some(provider => provider.phone === providerPhone), 'The canonical storefront must project the verified local provider without treating it as a quote.');

  const requestId = initial.requestId!;
  const fulfilment = await getFulfilmentForEconomicRequest(customerPhone, requestId);
  assert.equal(fulfilment?.mechanism, 'local_discovery', 'The current find_worker flow must bind to the reusable fulfilment mechanism.');
  assert.equal(fulfilment?.requirements.service, 'plumber');
  assert.equal(fulfilment?.requirements.location, 'Ikeja');

  const selected = await advanceStorefront(customerPhone, requestId, { providerPhone }, 'select_provider');
  assert.match(selected.message, /selected/i, 'Provider selection must stay explicit before a quote is prepared.');

  const inquiryCard = await advanceStorefront(customerPhone, requestId, {}, 'request_quote');
  assert.equal(inquiryCard.title, 'Quote inquiry prepared');
  assert.match(inquiryCard.message, /No message has been sent/i, 'Preparing an inquiry must not claim provider delivery.');
  assert.match(inquiryCard.message, /no quote has been received/i, 'Preparing an inquiry must not claim provider confirmation.');

  const inquiry = await getOpenProviderInquiry(customerPhone, fulfilment!.id, providerPhone);
  assert.equal(inquiry?.status, 'pending', 'The provider inquiry must remain pending until a real delivery or response is recorded.');
  assert.equal(inquiry?.sentAt, undefined, 'No provider message may be implied without channel delivery evidence.');

  const replayedInquiryCard = await advanceStorefront(customerPhone, requestId, {}, 'request_quote');
  assert.equal(replayedInquiryCard.title, 'Quote inquiry prepared');
  const replayedInquiry = await getOpenProviderInquiry(customerPhone, fulfilment!.id, providerPhone);
  assert.equal(replayedInquiry?.id, inquiry?.id, 'Repeated quote actions must reuse the same unresolved inquiry.');

  console.log(JSON.stringify({
    passed: true,
    requestId,
    fulfilmentId: fulfilment?.id,
    inquiryId: inquiry?.id,
    truths: ['provider selected by user', 'inquiry prepared', 'delivery not claimed', 'quote not claimed'],
  }, null, 2));
} finally {
  saveDb(true);
  try { fs.rmSync(dbPath, { force: true }); } catch { /* temporary database cleanup is best-effort */ }
}
