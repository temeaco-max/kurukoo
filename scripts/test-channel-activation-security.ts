/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { getChannelActivationSecurity } from '../src/services/channelActivationSecurity.js';

const base: NodeJS.ProcessEnv = {
  ...process.env,
  KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED: 'false',
  KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW: 'false',
  KURUKOO_WHATSAPP_LINKED_DEVICE_ENABLED: 'false',
  KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW: 'false',
};

assert.equal(getChannelActivationSecurity(base).telegram.encryptionReady, true);
assert.equal(getChannelActivationSecurity(base).whatsapp.persistentAuthPathReady, true);

const telegramUnsafe = { ...base,
  KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED: 'true',
  KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW: 'true',
  JWT_SECRET: 'short',
  KURUKOO_STORAGE_ENCRYPTION_KEY: '',
  MEMORY_ENCRYPTION_KEY: '',
};
assert.equal(getChannelActivationSecurity(telegramUnsafe).telegram.encryptionReady, false);

const telegramSafe = { ...telegramUnsafe, KURUKOO_STORAGE_ENCRYPTION_KEY: 'a'.repeat(40) };
assert.equal(getChannelActivationSecurity(telegramSafe).telegram.encryptionReady, true);

const whatsappUnsafe = { ...base,
  KURUKOO_WHATSAPP_LINKED_DEVICE_ENABLED: 'true',
  KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW: 'true',
  KURUKOO_WHATSAPP_LINKED_DEVICE_AUTH_DIR: '/tmp/kurukoo-whatsapp',
};
assert.equal(getChannelActivationSecurity(whatsappUnsafe).whatsapp.persistentAuthPathReady, false);

const whatsappSafe = { ...whatsappUnsafe, KURUKOO_WHATSAPP_LINKED_DEVICE_AUTH_DIR: '/var/lib/kurukoo/whatsapp-linked-device' };
assert.equal(getChannelActivationSecurity(whatsappSafe).whatsapp.persistentAuthPathReady, true);

console.log('Channel activation security contract passed.');
