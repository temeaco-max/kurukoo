/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-phone-otp-${process.pid}-${Date.now()}.sqlite`;
const { requestPhoneOtp, verifyPhoneOtp } = await import('../src/services/otpAuthService.js');

const previousNodeEnv = process.env.NODE_ENV;
const previousDebug = process.env.OTP_DEBUG;
const previousApiKey = process.env.AFRICASTALKING_API_KEY;
const previousUsername = process.env.AFRICASTALKING_USERNAME;
process.env.NODE_ENV = 'test';
process.env.OTP_DEBUG = 'true';
delete process.env.AFRICASTALKING_API_KEY;
delete process.env.AFRICASTALKING_USERNAME;

const phone = `+234808${String(Date.now()).slice(-7)}`;
const issued = await requestPhoneOtp(phone);
assert.equal(issued.success, true);
assert.equal(issued.provider, undefined);
assert.match(String(issued.message), /no external SMS was sent/i);
assert.match(String(issued.debugCode), /^\d{6}$/);

const verified = await verifyPhoneOtp(phone, String(issued.debugCode));
assert.equal(verified.success, true);
assert.equal(verified.phone, phone);
const replay = await verifyPhoneOtp(phone, String(issued.debugCode));
assert.equal(replay.success, false);

if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
if (previousDebug === undefined) delete process.env.OTP_DEBUG; else process.env.OTP_DEBUG = previousDebug;
if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY; else process.env.AFRICASTALKING_API_KEY = previousApiKey;
if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME; else process.env.AFRICASTALKING_USERNAME = previousUsername;
console.log('Phone OTP regression passed: canonical SMS seam, truthful unavailable delivery, debug-only development code, verification and replay rejection.');
