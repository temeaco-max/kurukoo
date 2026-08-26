import assert from 'node:assert/strict';
import { handleSmsWebhook } from '../src/channels/sms.js';
import { getChannelDeliveryState } from '../src/services/channelDeliveryState.js';

const messageId = `at-sms-${Date.now()}`;
const report = await handleSmsWebhook({ id: messageId, status: 'Success', phoneNumber: '+2347000000104', networkCode: '99999' });
assert.equal(report.status, 'success');
assert.equal(report.deliveryStatus, 'delivered');
const delivery = await getChannelDeliveryState('sms', 'africastalking', messageId);
assert.equal(delivery?.status, 'delivered');
assert.equal(delivery?.phone, '+2347000000104');

const inboundId = `at-inbound-${Date.now()}`;
const first = await handleSmsWebhook({ id: inboundId, from: '2347000000105', text: 'I need a plumber in Ikeja' });
assert.equal(first.status, 'success');
const duplicate = await handleSmsWebhook({ id: inboundId, from: '2347000000105', text: 'I need a plumber in Ikeja' });
assert.equal(duplicate.status, 'success');
assert.equal(duplicate.duplicate, true);

console.log('Africa’s Talking SMS boundary regression passed: delivery report correlation and inbound retry deduplication.');
