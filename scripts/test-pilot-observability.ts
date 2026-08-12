import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-pilot-${process.pid}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'pilot_observability_test_secret_with_32_chars';

const { app } = await import('../src/index.js');
const server = app.listen(0);
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const malformed = await fetch(`${baseUrl}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '   ' }) });
  assert.equal(malformed.status, 400, 'blank human input must fail closed without starting a stream');

  const longNote = 'messy-human-note '.repeat(100);
  const feedback = await fetch(`${baseUrl}/api/pilot/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: 'something_wrong', note: longNote, conversationId: 'conv-messy', messageId: 1, requestId: 'request-messy' }) });
  assert.equal(feedback.status, 201, 'guest feedback must remain available when optional note input is noisy');
  const cookie = feedback.headers.get('set-cookie') || '';
  assert.match(cookie, /kurukoo_guest_id=anon_/, 'guest feedback must establish a bounded anonymous session cookie');

  const duplicate = await fetch(`${baseUrl}/api/pilot/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie.split(';')[0] }, body: JSON.stringify({ rating: 'helpful', note: null }) });
  assert.equal(duplicate.status, 201, 'multiple independent ratings must not break the conversation path');

  const invalid = await fetch(`${baseUrl}/api/pilot/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: 'great', note: 'ignore validation' }) });
  assert.equal(invalid.status, 400, 'unknown feedback values must be rejected');

  const admin = await fetch(`${baseUrl}/api/admin/pilot-dashboard`);
  assert.equal(admin.status, 401, 'pilot dashboard must remain behind admin authentication');
  const adminToken = jwt.sign({ username: 'pilot-admin', role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m' });
  const dashboardResponse = await fetch(`${baseUrl}/api/admin/pilot-dashboard?days=30`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(dashboardResponse.status, 200, 'authenticated operator can load pilot aggregates');
  const dashboardBody = await dashboardResponse.json();
  assert.equal(dashboardBody.privacy.aggregate_only, true);
  assert.equal(Object.prototype.hasOwnProperty.call(dashboardBody, 'feedback'), false, 'ordinary dashboard must not return raw feedback rows');
  assert.equal(typeof dashboardBody.dashboard.feedback_total, 'number');
  assert.equal(dashboardBody.dashboard.feedback.something_wrong, 1);
  assert.doesNotMatch(JSON.stringify(dashboardBody), /messy-human-note|request-messy|conv-messy/i, 'aggregate dashboard must omit raw notes and raw identifiers');
  const dashboardHtml = fs.readFileSync(path.join(process.cwd(), 'public/admin/pilot.html'), 'utf8');
  assert.doesNotMatch(dashboardHtml, /row\.note|data\.feedback\.map|row\.requestId/, 'operator dashboard must not render raw feedback notes or request identifiers');

  const source = fs.readFileSync(path.join(process.cwd(), 'src/services/pilotObservability.ts'), 'utf8');
  assert.match(source, /hashIdentifier\(input\.ownerId\)/, 'owner identifiers must be hashed before persistence');
  assert.doesNotMatch(source, /console\.(log|info)\([^\n]*(phone|otp|jwt|token)/i, 'observability service must not log direct identity secrets');
  console.log('Pilot observability regression passed: noisy guest feedback, bounded validation, fail-closed blank input, repeated ratings, hashed identifiers, and admin isolation.');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const suffix of ['', '-journal', '-wal', '-shm']) { try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {} }
}
