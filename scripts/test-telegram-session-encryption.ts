import assert from 'node:assert/strict';

const original = {
  enabled: process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED,
  allow: process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW,
  owner: process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_OWNER_PHONE,
  apiId: process.env.TELEGRAM_API_ID,
  apiHash: process.env.TELEGRAM_API_HASH,
  storageKey: process.env.KURUKOO_STORAGE_ENCRYPTION_KEY,
  memoryKey: process.env.MEMORY_ENCRYPTION_KEY,
  jwt: process.env.JWT_SECRET,
};

try {
  process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED = 'true';
  process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW = 'true';
  process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_OWNER_PHONE = '+2348030000000';
  process.env.TELEGRAM_API_ID = '123456';
  process.env.TELEGRAM_API_HASH = 'test-api-hash';
  delete process.env.KURUKOO_STORAGE_ENCRYPTION_KEY;
  delete process.env.MEMORY_ENCRYPTION_KEY;
  process.env.JWT_SECRET = 'short';

  const { isTelegramLinkedDeviceConfigured } = await import('../src/services/telegramLinkedDeviceService.js');
  assert.equal(isTelegramLinkedDeviceConfigured(), false);

  process.env.KURUKOO_STORAGE_ENCRYPTION_KEY = 'telegram-session-test-encryption-secret-01234567890123456789';
  assert.equal(isTelegramLinkedDeviceConfigured(), true);
  console.log('Telegram linked-session security contract passed.');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key as keyof typeof process.env];
    else process.env[key as keyof typeof process.env] = value;
  }
}
