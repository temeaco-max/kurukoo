import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-reminder-safety-coordinator-'));
process.env.DB_PATH = path.join(tempDir, 'flow.sqlite');
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { getDb } = await import('../src/database.js');
const { createReminder, cancelReminder } = await import('../src/services/reminderService.js');
const { addSafetyContact, startCheckIn, completeCheckIn } = await import('../src/services/safetyService.js');
const { getCoordinatorTelemetry } = await import('../src/services/coordinatorStore.js');

const phone = '+2348095550101';
const privateReminderTitle = 'PRIVATE_REMINDER_SENTINEL';
const privateReminderNote = 'PRIVATE_NOTE_SENTINEL';
const privateContactName = 'PRIVATE_CONTACT_SENTINEL';
const privateRouteNote = 'PRIVATE_ROUTE_SENTINEL';

try {
  const reminder = await createReminder(phone, { title: privateReminderTitle, note: privateReminderNote, dueAt: new Date(Date.now() + 60 * 60_000).toISOString() });
  assert.equal(reminder.status, 'scheduled');
  assert.equal(await cancelReminder(phone, reminder.id), true);

  const contact = await addSafetyContact(phone, { name: privateContactName, phone: '+2348095550102', relationship: 'trusted contact', activate: true });
  const checkIn = await startCheckIn(phone, { contactId: contact.id, durationMinutes: 10, routeNote: privateRouteNote });
  assert.equal(checkIn.status, 'active');
  assert.equal(await completeCheckIn(phone, checkIn.id), true);

  const db = await getDb();
  const result = db.exec(`SELECT type, producer, payload_json, provenance_json, policy_json FROM coordinator_events WHERE producer IN ('reminderService', 'safetyService') ORDER BY created_at ASC`);
  const rows = result[0]?.values || [];
  const columns = result[0]?.columns || [];
  const events = rows.map((values: any[]) => Object.fromEntries(columns.map((column: string, index: number) => [column, values[index]])));
  const types = events.map((event: any) => String(event.type));
  assert.ok(types.includes('reminder.state_changed'), 'Reminder lifecycle event must be persisted');
  assert.ok(types.includes('safety.checkin.state_changed'), 'Safety lifecycle event must be persisted');

  const telemetryText = JSON.stringify(events);
  for (const forbidden of [privateReminderTitle, privateReminderNote, privateContactName, privateRouteNote]) assert.equal(telemetryText.includes(forbidden), false, `Sensitive value leaked into coordinator telemetry: ${forbidden}`);
  for (const event of events) {
    const payload = JSON.parse(String(event.payload_json));
    assert.equal(typeof payload.title, 'undefined', 'Reminder title must not be present in telemetry');
    assert.equal(typeof payload.note, 'undefined', 'Reminder note must not be present in telemetry');
    assert.equal(typeof payload.contactName, 'undefined', 'Safety contact name must not be present in telemetry');
    assert.equal(typeof payload.routeNote, 'undefined', 'Safety route note must not be present in telemetry');
  }

  const telemetry = await getCoordinatorTelemetry();
  assert.ok((telemetry.events.byType['reminder.state_changed'] || 0) >= 2);
  assert.ok((telemetry.events.byType['safety.checkin.state_changed'] || 0) >= 2);
  console.log(JSON.stringify({ ok: true, eventTypes: types, reminderEvents: telemetry.events.byType['reminder.state_changed'] || 0, safetyEvents: telemetry.events.byType['safety.checkin.state_changed'] || 0, sensitivePayloadsLeaked: false }, null, 2));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
