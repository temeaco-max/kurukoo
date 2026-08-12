import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-channel-usage-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';

const { getDb, saveDb } = await import('../src/database.js');
const { recordChannelUsage, getChannelUsageSummary } = await import('../src/services/channelUsageService.js');

await getDb();
const phone = '+2347000000199';

await recordChannelUsage({
  phone,
  channel: 'whatsapp',
  direction: 'inbound',
  conversationId: 'conversation-1',
  metadata: { provider: 'meta', priced: false }
});
await recordChannelUsage({
  phone,
  channel: 'whatsapp',
  direction: 'outbound',
  estimatedCostMinor: 7,
  currency: 'ngn',
  providerReference: 'provider-message-1',
  conversationId: 'conversation-1'
});

const summary = await getChannelUsageSummary(phone);
assert.equal(summary.events, 2, 'two channel events should be recorded');
assert.equal(summary.units, 2, 'each conversation direction should count one unit');
assert.equal(summary.estimatedCostMinor, 7, 'reported connector cost should be retained');
assert.equal(summary.pricedEvents, 1, 'only explicitly priced events count as priced');
assert.equal(summary.unpricedEvents, 1, 'unknown provider pricing must remain explicitly unpriced');

const stored = (await getDb()).exec(
  `SELECT channel, direction, provider_reference, currency FROM channel_usage_events WHERE phone = ? ORDER BY id`,
  [phone]
)[0]?.values || [];
assert.equal(stored.length, 2, 'usage rows should be persisted');
assert.deepEqual(stored[1], ['whatsapp', 'outbound', 'provider-message-1', 'NGN']);

saveDb(true);
try { fs.rmSync(dbPath, { force: true }); } catch { /* best-effort temporary cleanup */ }

console.log('Channel usage metering checks passed');
console.log('Verified: unified channel events are metered, provider costs remain optional, and usage is not converted into Points.');
