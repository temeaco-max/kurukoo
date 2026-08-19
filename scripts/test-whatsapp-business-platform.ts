import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { normalizeWhatsAppBusinessWebhook, verifyWhatsAppSignature, verifyWhatsAppWebhook } from '../src/services/whatsappBusinessPlatformService.js';

process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'kurukoo-test-verify';
process.env.WHATSAPP_APP_SECRET = 'kurukoo-test-secret';

assert.equal(verifyWhatsAppWebhook('subscribe', 'kurukoo-test-verify', 'challenge-123'), 'challenge-123');
assert.equal(verifyWhatsAppWebhook('subscribe', 'wrong', 'challenge-123'), null);

const payload = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.test', from: '2348030000000', timestamp: '1', text: { body: 'I need rice in Ikeja' } }, { id: 'ignored', from: '2348030000001', text: {} }] } }] }] });
const signature = `sha256=${crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(payload).digest('hex')}`;
assert.equal(verifyWhatsAppSignature(payload, signature), true);
assert.equal(verifyWhatsAppSignature(payload, 'sha256=bad'), false);

const normalized = normalizeWhatsAppBusinessWebhook(JSON.parse(payload));
assert.deepEqual(normalized, [{ from: '+2348030000000', messageId: 'wamid.test', text: 'I need rice in Ikeja', timestamp: '1' }]);
console.log('WhatsApp Business Platform contract passed: verification, signature validation and canonical inbound normalization are protected.');
