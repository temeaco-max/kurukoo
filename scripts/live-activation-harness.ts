/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';

function loadDotEnv(filePath = '.env'): void {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}
loadDotEnv();

const command = process.argv[2] || 'status';
const phone = String(process.argv[3] || process.env.KURUKOO_TEST_PHONE || process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_OWNER_PHONE || process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_OWNER_PHONE || '').trim();

async function run(): Promise<void> {
  const { resolveConversationProvider } = await import('../src/services/conversationalGenerationService.js');
  const { queryUnifiedAI } = await import('../src/services/unifiedAiEngine.js');
  const { getDriveConnectionStatus, startGoogleDriveConnection } = await import('../src/services/artifactService.js');
  const { getTelegramLinkedDeviceStatus, startTelegramLinkedDevice } = await import('../src/services/telegramLinkedDeviceService.js');
  const { getWhatsAppLinkedDeviceStatus, startWhatsAppLinkedDevice } = await import('../src/services/whatsappLinkedDeviceService.js');

  if (command === 'status') {
    const drive = phone ? await getDriveConnectionStatus(phone) : { configured: false, enabled: false, connected: false, provider: 'google_drive', scope: 'drive.file', featureFlagState: 'unknown', reason: 'phone argument required' };
    console.log(JSON.stringify({
      chat: {
        localFirst: resolveConversationProvider(undefined) === 'smollm2',
        hostedEscalationProvider: process.env.KURUKOO_AI_HOSTED_PROVIDER || 'auto',
        mistralConfigured: Boolean(process.env.MISTRAL_API_KEY),
      },
      googleDrive: drive,
      telegram: getTelegramLinkedDeviceStatus(),
      whatsapp: getWhatsAppLinkedDeviceStatus(),
    }, null, 2));
    return;
  }

  if (command === 'mistral') {
    const response = await queryUnifiedAI('Reply with one short sentence confirming the Mistral activation path is responding.', { provider: 'mistral', skipMemory: true, conversational: true });
    if (response.provider !== 'Mistral') throw new Error(`Mistral smoke test did not use Mistral; actual provider: ${response.provider}`);
    console.log(JSON.stringify({ ok: true, provider: response.provider, model: response.model, text: response.text }, null, 2));
    return;
  }

  if (command === 'drive') {
    if (!phone) throw new Error('Provide the authenticated owner phone as the second argument.');
    const result = await startGoogleDriveConnection(phone);
    console.log(JSON.stringify({ ok: true, provider: 'google_drive', authorizationUrl: result.authorizationUrl, expiresAt: result.expiresAt }, null, 2));
    return;
  }
  if (command === 'telegram') {
    if (!process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED || !process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW) throw new Error('Enable KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED and KURUKOO_TELEGRAM_LINKED_DEVICE_ALLOW in the local environment first.');
    await startTelegramLinkedDevice();
    console.log(JSON.stringify(getTelegramLinkedDeviceStatus(), null, 2));
    return;
  }
  if (command === 'whatsapp') {
    if (!process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ENABLED || !process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW) throw new Error('Enable KURUKOO_WHATSAPP_LINKED_DEVICE_ENABLED and KURUKOO_WHATSAPP_LINKED_DEVICE_ALLOW in the local environment first.');
    await startWhatsAppLinkedDevice();
    console.log(JSON.stringify(getWhatsAppLinkedDeviceStatus(), null, 2));
    return;
  }
  throw new Error(`Unknown activation command: ${command}`);
}
run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
