import assert from 'node:assert/strict';
import { handleUssdRequest } from '../src/ussd/menus.js';

const phone = `+234706${String(Date.now()).slice(-7)}`;
const home = await handleUssdRequest(phone, '');
assert.match(home, /^CON Welcome to Kurukoo/, 'A new USSD session must return a continuation menu.');

const invalid = await handleUssdRequest(phone, '999');
assert.match(invalid, /^END Invalid selection/, 'An invalid USSD selection must terminate safely.');

const balance = await handleUssdRequest(phone, '9999');
assert.match(balance, /^END /, 'USSD terminal responses must use the required END prefix.');

console.log('USSD integration regression passed: session menu, terminal response, and channel persistence exercised without carrier dispatch.');
