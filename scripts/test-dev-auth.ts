import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.KURUKOO_DEV_AUTH = 'true';
process.env.KURUKOO_TEST_PHONE = '08030000000';
process.env.KURUKOO_TEST_NAME = 'Kurukoo Test Operator';
process.env.JWT_SECRET = 'dev-auth-regression-secret-that-is-long-enough';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-password-for-test';
process.env.KURUKOO_DISABLE_LISTEN = 'true';
process.env.KURUKOO_WORKERS = '0';
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kurukoo-dev-auth-')), 'test.sqlite');

const { app } = await import('../src/index.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const cookieFrom = (response: Response): string => String(response.headers.get('set-cookie') || '').split(';')[0];
const json = async (response: Response) => await response.json() as any;

try {
  const otpRequest = await fetch(`${base}/api/auth/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: process.env.KURUKOO_TEST_PHONE }) });
  const otpData = await json(otpRequest);
  assert.equal(otpRequest.status, 200);
  assert.equal(otpData.testMode, true);
  assert.equal(otpData.devCode, '111111');

  const wrongCode = await fetch(`${base}/api/auth/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: process.env.KURUKOO_TEST_PHONE, code: '222222' }) });
  assert.equal(wrongCode.status, 401);

  const verify = await fetch(`${base}/api/auth/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: process.env.KURUKOO_TEST_PHONE, code: '111111' }) });
  const verifyData = await json(verify);
  assert.equal(verify.status, 200);
  assert.equal(verifyData.testMode, true);
  const userCookie = cookieFrom(verify);
  assert.match(userCookie, /^kurukoo_auth=/);

  const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: userCookie } });
  const meData = await json(me);
  assert.equal(me.status, 200);
  assert.equal(meData.developmentTestAccount, true);
  assert.equal(meData.user.phone, '+2348030000000');

  const chatTurn = async (message: string) => {
    const response = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { cookie: userCookie, 'content-type': 'application/json' }, body: JSON.stringify({ message, channel: 'web' }) });
    const text = await response.text();
    assert.equal(response.status, 200, `canonical Chat should accept: ${message}`);
    assert.match(text, /conversation|done|text/, `canonical Chat should emit a response for: ${message}`);
    return text;
  };
  await chatTurn('Hello');
  await chatTurn('Remember that I prefer simple answers.');
  await chatTurn('Remind me tomorrow to test Kurukoo.');
  await chatTurn('I need a plumber.');

  process.env.NODE_ENV = 'production';
  const productionAttempt = await fetch(`${base}/api/auth/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: process.env.KURUKOO_TEST_PHONE, code: '111111' }) });
  assert.notEqual(productionAttempt.status, 200, 'development code must be rejected in production');
  process.env.NODE_ENV = 'test';

  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'admin-password-for-test';
  assert.equal(process.env.ADMIN_USERNAME, 'admin');
  assert.equal(process.env.ADMIN_PASSWORD, 'admin-password-for-test');
  const adminLogin = await fetch(`${base}/api/admin/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin-password-for-test' }) });
  const adminData = await json(adminLogin);
  assert.equal(adminLogin.status, 200);
  assert.ok(adminData.token);

  const launch = await fetch(`${base}/api/admin/test-chat`, { headers: { 'x-admin-token': adminData.token } });
  const launchData = await json(launch);
  assert.equal(launch.status, 200);
  assert.equal(launchData.testMode, true);
  assert.match(String(launch.headers.get('set-cookie') || ''), /kurukoo_auth=/);

  const reset = await fetch(`${base}/api/admin/test-chat/reset`, { method: 'POST', headers: { 'x-admin-token': adminData.token } });
  const resetData = await json(reset);
  assert.equal(reset.status, 200);
  assert.deepEqual(resetData.preserved, ['economic_requests', 'orders', 'escrow', 'payments', 'disputes']);

  const source = fs.readFileSync(path.join(process.cwd(), 'src/routes/chatRouter.ts'), 'utf8');
  assert.match(source, /processCanonicalChatTurn/);
  console.log('Development auth regression passed: controlled OTP, production rejection, normal session, admin launch/reset, owner identity, and canonical Chat wiring.');
} finally {
  server.close();
}
