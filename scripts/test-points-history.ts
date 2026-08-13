import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-points-history-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'points_history_test_secret_with_32_chars';

const { app } = await import('../src/index.js');
const { getDb, saveDb } = await import('../src/database.js');
const db = await getDb();
const ownerPhone = '+2348010005005';
const otherPhone = '+2348010005006';

db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,points_balance,subscription_tier) VALUES(?,?,?,?,?,?)`, [ownerPhone, 'Points owner', 'Ikeja', 'ng', 17, 'Base']);
db.run(`INSERT OR REPLACE INTO memory_profiles(phone,name,location,country,points_balance,subscription_tier) VALUES(?,?,?,?,?,?)`, [otherPhone, 'Other account', 'Ikeja', 'ng', 8, 'Base']);
db.run(`INSERT INTO credit_transactions(phone,amount,type,description) VALUES(?,?,?,?)`, [ownerPhone, 20, 'credit', 'Completed approved contribution']);
db.run(`INSERT INTO credit_transactions(phone,amount,type,description) VALUES(?,?,?,?)`, [ownerPhone, -3, 'debit', 'Nearby Pulse Go Live (30 minutes)']);
saveDb();

const token = (phone: string) => jwt.sign({ phone, role: 'user' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
const auth = (phone: string) => ({ Authorization: `Bearer ${token(phone)}` });
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const unauthenticated = await fetch(`${baseUrl}/api/points/history`);
  assert.equal(unauthenticated.status, 401, 'Points history must require authentication');

  const forbidden = await fetch(`${baseUrl}/api/points/history?phone=${encodeURIComponent(otherPhone)}`, { headers: auth(ownerPhone) });
  assert.equal(forbidden.status, 403, 'a client cannot read another account’s Points history');

  const response = await fetch(`${baseUrl}/api/points/history?limit=10`, { headers: auth(ownerPhone) });
  const payload = await response.json() as { success?: boolean; history?: Array<{ phone?: string; amount?: number; type?: string; description?: string }> };
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.success, true);
  assert.ok(Array.isArray(payload.history));
  assert.ok(payload.history?.some((entry) => entry.amount === 20 && entry.type === 'credit' && entry.description === 'Completed approved contribution'));
  assert.ok(payload.history?.some((entry) => entry.amount === -3 && entry.type === 'debit' && /Nearby Pulse/i.test(String(entry.description))));
  assert.ok(payload.history?.every((entry) => entry.phone === ownerPhone), 'history projection must contain only owner ledger records');

  console.log('Points history regression passed: authenticated owner-only ledger projection for workspace activity.');
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
