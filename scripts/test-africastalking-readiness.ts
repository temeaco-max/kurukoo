import assert from 'node:assert/strict';
import { getAfricaTalkingReadiness } from '../src/services/africaTalkingReadiness.js';

const secret = 'never-return-this-api-key';
const disabled = getAfricaTalkingReadiness({ AFRICASTALKING_API_KEY: secret, AFRICASTALKING_USERNAME: 'sandbox' });
assert.equal(disabled.provider.status, 'external_unavailable');
assert.equal(disabled.sms.status, 'not_configured');
assert.equal(disabled.sms.reason, 'feature_disabled');

const incomplete = getAfricaTalkingReadiness({
  AFRICASTALKING_API_KEY: secret,
  AFRICASTALKING_USERNAME: 'sandbox',
  FF_SMS: 'true', FF_USSD: 'true', FF_AIRTIME: 'true',
});
assert.equal(incomplete.sms.status, 'not_configured');
assert.equal(incomplete.ussd.status, 'not_configured');
assert.equal(incomplete.airtime.status, 'not_configured');
assert.equal(incomplete.otp.status, 'not_configured');

const configured = getAfricaTalkingReadiness({
  AFRICASTALKING_API_KEY: secret,
  AFRICASTALKING_USERNAME: 'sandbox',
  FF_SMS: 'true', FF_USSD: 'true', FF_AIRTIME: 'true',
  AFRICASTALKING_SMS_CALLBACK_URL: 'https://staging.example.test/webhook/sms',
  AFRICASTALKING_USSD_CALLBACK_URL: 'https://staging.example.test/ussd',
  AFRICASTALKING_AIRTIME_CALLBACK_URL: 'https://staging.example.test/airtime',
});
assert.equal(configured.provider.status, 'external_unavailable');
assert.equal(configured.provider.external_completion_proven, false);
assert.equal(configured.sms.status, 'configured');
assert.equal(configured.ussd.status, 'configured');
assert.equal(configured.otp.status, 'configured');
assert.equal(configured.airtime.status, 'configured');
assert.deepEqual(JSON.stringify(configured).includes(secret), false, 'public readiness must never contain credential material');
console.log('Africa’s Talking readiness contract passed: configuration states are non-secret and external completion remains unproven.');
