import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-native-'));
process.env.DB_PATH = path.join(tempDir, 'native.sqlite');
process.env.JWT_SECRET = 'native-assistance-test-secret-0123456789';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const {
  createReminder,
  listReminders,
  cancelReminder,
  processDueReminders,
} = await import('../src/services/reminderService.js');
const {
  addSafetyContact,
  listSafetyContacts,
  startCheckIn,
  completeCheckIn,
  processExpiredCheckIns,
} = await import('../src/services/safetyService.js');

const phone = '+2348010000000';
const otherPhone = '+2348010000001';
const tokenFor = (identity: string) => jwt.sign({ phone: identity, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
const authFor = (identity: string) => ({
  Authorization: `Bearer ${tokenFor(identity)}`,
  'Content-Type': 'application/json',
});

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const { port } = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const due = new Date(Date.now() + 60_000).toISOString();
  const reminder = await createReminder(phone, { title: 'Call Mum', dueAt: due });
  assert.equal(reminder.status, 'scheduled', 'Reminder should begin scheduled');
  assert.ok((await listReminders(phone)).some(item => item.id === reminder.id), 'Owner should list scheduled reminder');
  assert.equal(await cancelReminder(phone, reminder.id), true, 'Owner should cancel scheduled reminder');

  const contact = await addSafetyContact(phone, {
    name: 'Sarah',
    phone: '+2348020000000',
    relationship: 'friend',
    activate: true,
  });
  assert.equal(contact.status, 'active', 'Explicitly activated safety contact should be active');
  assert.equal((await listSafetyContacts(phone)).length, 1, 'Owner should list safety contacts');
  const checkIn = await startCheckIn(phone, {
    contactId: contact.id,
    durationMinutes: 5,
    routeNote: 'Evening walk',
  });
  assert.equal(checkIn.status, 'active', 'Owner should start check-in against active contact');
  assert.equal(await completeCheckIn(phone, checkIn.id), true, 'Owner should complete active check-in');

  const rejectedPastReminder = await createReminder(phone, {
    title: 'Past reminder',
    dueAt: new Date(Date.now() - 1_000).toISOString(),
  }).catch(() => null);
  assert.equal(rejectedPastReminder, null, 'Past reminders must be rejected');

  const scheduled = await createReminder(phone, {
    title: 'Due test',
    dueAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const db = await getDb();
  db.run('UPDATE reminders SET due_at = ? WHERE id = ?', [new Date(Date.now() - 1_000).toISOString(), scheduled.id]);
  saveDb(true);
  const processed = await processDueReminders();
  assert.equal(processed.checked, 1, 'One due reminder should be processed');
  assert.equal((await processDueReminders()).checked, 0, 'A processed one-off reminder must not generate duplicate conversation messages');
  const messageResult = db.exec("SELECT content, status FROM messages WHERE phone = ? AND card_data LIKE ?", [phone, `%${scheduled.id}%`]);
  assert.equal(messageResult[0]?.values?.length, 1, 'A due reminder should create one durable conversation message');
  assert.equal(messageResult[0]?.values?.[0]?.[1], 'queued', 'Unconfigured push transport must remain queued rather than falsely delivered');

  const expiring = await startCheckIn(phone, { contactId: contact.id, durationMinutes: 5 });
  db.run('UPDATE safety_checkins SET expires_at = ? WHERE id = ?', [new Date(Date.now() - 1_000).toISOString(), expiring.id]);
  saveDb(true);
  assert.equal(await processExpiredCheckIns(), 1, 'An expired safety check-in should enter an explicit escalation-pending state');
  assert.equal(await processExpiredCheckIns(), 0, 'An escalation-pending check-in must not be processed twice');
  const safetyResult = db.exec('SELECT status FROM safety_checkins WHERE id = ?', [expiring.id]);
  assert.equal(safetyResult[0]?.values?.[0]?.[0], 'escalation_pending', 'Safety escalation must fail closed until an authorised delivery transport is configured');

  const anonymous = await fetch(`${baseUrl}/api/reminders`);
  assert.equal(anonymous.status, 401, 'Reminder routes must require authentication');

  const createRouteReminder = await fetch(`${baseUrl}/api/reminders`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ title: 'Route reminder', dueAt: new Date(Date.now() + 120_000).toISOString() }),
  });
  assert.equal(createRouteReminder.status, 201, 'Authenticated owner should create a reminder through the canonical route');
  const routeReminder = await createRouteReminder.json() as { reminder?: { id?: string } };
  assert.ok(routeReminder.reminder?.id, 'Reminder route should return the created record');

  const guestReminder = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Remind me in 2 minutes to stretch', channel: 'web' }),
  });
  assert.equal(guestReminder.status, 200, 'Guests may express a reminder intent before authentication');
  const guestReminderBody = await guestReminder.text();
  assert.match(guestReminderBody, /auth_gate|auth_in_chat_start/, 'Guest reminder intent must be protected by the canonical identity gate');
  const guestReminderRows = db.exec("SELECT id FROM reminders WHERE phone LIKE 'anon_%'");
  assert.equal(guestReminderRows[0]?.values?.length || 0, 0, 'Guest reminder intent must not create anonymous persistent reminder data');

  const chatReminder = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ message: 'Remind me in 2 minutes to stretch', channel: 'web' }),
  });
  assert.equal(chatReminder.status, 200, 'Authenticated chat should schedule a relative reminder');
  const chatReminderBody = await chatReminder.text();
  assert.match(chatReminderBody, /Done\. I’ll remind you/i, 'Authenticated chat should confirm the scheduled reminder');
  const savedChatReminder = db.exec("SELECT id FROM reminders WHERE phone = ? AND title = 'stretch'", [phone]);
  assert.equal(savedChatReminder[0]?.values?.length, 1, 'Authenticated chat should persist the reminder to the owner profile');

  const absoluteReminder = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ message: 'Remind me tomorrow at 9am to check reports', channel: 'web' }),
  });
  assert.equal(absoluteReminder.status, 200, 'Authenticated chat should accept an absolute reminder time');
  assert.match(await absoluteReminder.text(), /Done\. I’ll remind you/i, 'Absolute reminder should return the native confirmation');
  const absoluteRows = db.exec("SELECT due_at FROM reminders WHERE phone = ? AND title = 'check reports'", [phone]);
  assert.equal(absoluteRows[0]?.values?.length, 1, 'Absolute reminder should be persisted');
  assert.ok(new Date(String(absoluteRows[0]?.values?.[0]?.[0])).getTime() > Date.now(), 'Absolute reminder must be scheduled in the future');

  const dayReminder = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ message: 'Remind me in 2 days to take bins', channel: 'web' }),
  });
  assert.equal(dayReminder.status, 200, 'Authenticated chat should accept day-based relative reminders');
  assert.match(await dayReminder.text(), /Done\. I’ll remind you/i, 'Day-based reminder should return the native confirmation');
  const dayRows = db.exec("SELECT due_at FROM reminders WHERE phone = ? AND title = 'take bins'", [phone]);
  assert.equal(dayRows[0]?.values?.length, 1, 'Day-based reminder should be persisted');

  const reminderOrders = db.exec("SELECT id FROM orders WHERE phone = ? AND order_type = 'lead'", [phone]);
  assert.equal(reminderOrders[0]?.values?.length || 0, 0, 'Native reminders must not create economic lead orders');

  const otherList = await fetch(`${baseUrl}/api/reminders`, { headers: authFor(otherPhone) });
  const otherPayload = await otherList.json() as { reminders?: Array<{ id?: string }> };
  assert.equal(otherList.status, 200, 'Another authenticated user can list only their own reminders');
  assert.equal(otherPayload.reminders?.some(item => item.id === routeReminder.reminder?.id), false, 'Reminder records must not cross user identities');

  const routeContact = await fetch(`${baseUrl}/api/safety/contacts`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ name: 'Route contact', phone: '+2348020000011', activate: true }),
  });
  const routeContactPayload = await routeContact.json() as { contact?: { id?: string } };
  assert.equal(routeContact.status, 201, 'Authenticated owner should create a safety contact through the canonical route');
  assert.ok(routeContactPayload.contact?.id, 'Safety-contact route should return the owner-scoped record');

  const pendingContact = await fetch(`${baseUrl}/api/safety/contacts`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ name: 'Pending contact', phone: '+2348020000012', relationship: 'sibling' }),
  });
  const pendingPayload = await pendingContact.json() as { contact?: { id?: string; status?: string } };
  assert.equal(pendingContact.status, 201, 'Safety contacts should default to pending when activation is not requested');
  assert.equal(pendingPayload.contact?.status, 'pending', 'Unconfirmed safety contacts must remain pending');

  const withoutConsent = await fetch(`${baseUrl}/api/safety/contacts/${pendingPayload.contact?.id}/activate`, {
    method: 'POST', headers: authFor(phone), body: JSON.stringify({ consentConfirmed: false }),
  });
  assert.equal(withoutConsent.status, 400, 'Pending safety contacts require explicit owner consent');

  const activated = await fetch(`${baseUrl}/api/safety/contacts/${pendingPayload.contact?.id}/activate`, {
    method: 'POST', headers: authFor(phone), body: JSON.stringify({ consentConfirmed: true }),
  });
  const activatedPayload = await activated.json() as { contact?: { status?: string }; message?: string };
  assert.equal(activated.status, 200, 'Owner consent should activate a pending safety contact');
  assert.equal(activatedPayload.contact?.status, 'active', 'Consent activation should produce active status');
  assert.match(String(activatedPayload.message), /No notification has been sent/i, 'Activation must not claim external contact delivery');

  const otherActivation = await fetch(`${baseUrl}/api/safety/contacts/${pendingPayload.contact?.id}/activate`, {
    method: 'POST', headers: authFor(otherPhone), body: JSON.stringify({ consentConfirmed: true }),
  });
  assert.equal(otherActivation.status, 404, 'Another user must not activate a safety contact they do not own');

  const crossUserCheckIn = await fetch(`${baseUrl}/api/safety/check-ins`, {
    method: 'POST',
    headers: authFor(otherPhone),
    body: JSON.stringify({ contactId: routeContactPayload.contact?.id, durationMinutes: 10 }),
  });
  assert.equal(crossUserCheckIn.status, 400, 'A user must not start a check-in using another user’s safety contact');

  const ownerCheckIn = await fetch(`${baseUrl}/api/safety/check-ins`, {
    method: 'POST',
    headers: authFor(phone),
    body: JSON.stringify({ contactId: routeContactPayload.contact?.id, durationMinutes: 10 }),
  });
  assert.equal(ownerCheckIn.status, 201, 'Owner should start a check-in through the canonical route');
  const checkInPayload = await ownerCheckIn.json() as { checkIn?: { id?: string } };
  const listedCheckIns = await fetch(`${baseUrl}/api/safety/check-ins`, { headers: authFor(phone) });
  assert.equal(listedCheckIns.status, 200, 'Owner should list safety check-ins');
  const listedCheckInPayload = await listedCheckIns.json() as { checkIns?: Array<{ id?: string }> };
  assert.equal(listedCheckInPayload.checkIns?.some(item => item.id === checkInPayload.checkIn?.id), true, 'Check-in listing must remain owner-scoped');

  console.log('Native assistance tests passed');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
}
