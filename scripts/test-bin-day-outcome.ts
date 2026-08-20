import assert from 'node:assert/strict';
import { getDb, saveDb } from '../src/database.js';
import { resolveBinDaySchedule, upsertAuthoritativeBinDaySchedule, createBinDayReminder } from '../src/services/binDayService.js';
import { cancelReminder } from '../src/services/reminderService.js';

const phone = 'bin-day-contract-user';
const db = await getDb();
db.run('DELETE FROM reminders WHERE phone=?', [phone]);
db.run('DELETE FROM memory_profiles WHERE phone=?', [phone]);
db.run(`INSERT INTO memory_profiles (phone,name,location,country) VALUES (?,?,?,?)`, [phone, 'Bin Contract User', 'London', 'gb']);

assert.equal(await resolveBinDaySchedule({ postcode: 'SW1A 1AA' }), null, 'unknown postcode must not produce a guessed schedule');

const nextCollectionAt = new Date(Date.now() + 48 * 60 * 60_000).toISOString();
await upsertAuthoritativeBinDaySchedule({
  postcode: 'SW1A 1AA',
  council: 'Westminster City Council',
  wasteType: 'recycling',
  nextCollectionAt,
  recurrence: 'weekly',
  sourceName: 'Westminster City Council',
  sourceUrl: 'https://example.invalid/waste',
  sourceCheckedAt: new Date().toISOString(),
});

const schedule = await resolveBinDaySchedule({ postcode: 'sw1a 1aa', wasteType: 'recycling' });
assert.ok(schedule, 'authoritative schedule should resolve');
assert.equal(schedule?.evidence, 'authoritative_source');
assert.equal(schedule?.sourceName, 'Westminster City Council');

const reminder = await createBinDayReminder(phone, schedule!, 60);
assert.equal(reminder.phone, phone);
assert.match(reminder.title, /recycling bin collection/i);
assert.equal(reminder.recurrence, 'weekly');
assert.ok(new Date(reminder.due_at).getTime() < new Date(nextCollectionAt).getTime());

const cancelled = await cancelReminder(phone, reminder.id);
assert.equal(cancelled, true);
db.run('DELETE FROM authoritative_bin_schedules WHERE postcode=?', ['SW1A 1AA']);
db.run('DELETE FROM reminders WHERE phone=?', [phone]);
db.run('DELETE FROM memory_profiles WHERE phone=?', [phone]);
saveDb();

console.log('Bin-day outcome contract passed.');
