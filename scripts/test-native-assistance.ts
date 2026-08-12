import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-native-'));
process.env.DB_PATH = path.join(tempDir, 'native.sqlite');
process.env.JWT_SECRET = 'native-assistance-test-secret-0123456789';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

const { createReminder, listReminders, cancelReminder, processDueReminders } = await import('../src/services/reminderService.js');
const { addSafetyContact, listSafetyContacts, startCheckIn, completeCheckIn, processExpiredCheckIns } = await import('../src/services/safetyService.js');

const phone = '+2348010000000';
const due = new Date(Date.now() + 60_000).toISOString();
const reminder = await createReminder(phone, { title: 'Call Mum', dueAt: due });
if (reminder.status !== 'scheduled') throw new Error('Reminder was not scheduled');
const reminders = await listReminders(phone);
if (!reminders.some(item => item.id === reminder.id)) throw new Error('Reminder not listed');
if (await cancelReminder(phone, reminder.id) !== true) throw new Error('Reminder did not cancel');

const contact = await addSafetyContact(phone, { name: 'Sarah', phone: '+2348020000000', relationship: 'friend', activate: true });
if (contact.status !== 'active') throw new Error('Safety contact was not activated');
if ((await listSafetyContacts(phone)).length !== 1) throw new Error('Safety contact not listed');
const checkIn = await startCheckIn(phone, { contactId: contact.id, durationMinutes: 5, routeNote: 'Evening walk' });
if (checkIn.status !== 'active') throw new Error('Check-in was not started');
if (await completeCheckIn(phone, checkIn.id) !== true) throw new Error('Check-in did not complete');

const dueReminder = await createReminder(phone, { title: 'Due test', dueAt: new Date(Date.now() - 1000).toISOString().replace('Z', '.000Z') }).catch(() => null);
if (dueReminder) throw new Error('Past reminder was accepted');
const processed = await processDueReminders();
if (processed.checked !== 0) throw new Error('Unexpected due reminder processed');
if ((await processExpiredCheckIns()) !== 0) throw new Error('Completed check-in was escalated');

console.log('Native assistance tests passed');
fs.rmSync(tempDir, { recursive: true, force: true });
