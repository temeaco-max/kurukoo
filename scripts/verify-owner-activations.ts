import 'dotenv/config';
import { getFeatureFlagStatus } from '../src/services/featureFlags.js';
import { getDriveConnectionStatus } from '../src/services/artifactService.js';
import { isTelegramLinkedDeviceConfigured, getTelegramLinkedDeviceStatus } from '../src/services/telegramLinkedDeviceService.js';
import { isWhatsAppLinkedDeviceConfigured, getWhatsAppLinkedDeviceStatus } from '../src/services/whatsappLinkedDeviceService.js';
import { resolveConversationProvider } from '../src/services/conversationalGenerationService.js';

function has(value: unknown): boolean { return Boolean(String(value ?? '').trim()); }
function redact(value: string): string { return value ? 'configured' : 'missing'; }

const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
const ownerPhone = String(process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_OWNER_PHONE || process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_OWNER_PHONE || '').trim();
const sessionEncryptionConfigured = has(process.env.KURUKOO_STORAGE_ENCRYPTION_KEY)
  || has(process.env.MEMORY_ENCRYPTION_KEY)
  || String(process.env.JWT_SECRET || '').trim().length >= 32;

const mistral = getFeatureFlagStatus(country, 'hosted_mistral');
const bypassRequested = String(process.env.KURUKOO_AI_BYPASS_SMOLLM2 || '').toLowerCase() === 'true'
  || String(process.env.KURUKOO_AI_PRIMARY_PROVIDER || process.env.KURUKOO_AI_HOSTED_PROVIDER || '').trim().toLowerCase() === 'mistral';
const selectedProvider = resolveConversationProvider(undefined);

let drive: Awaited<ReturnType<typeof getDriveConnectionStatus>> | null = null;
try {
  if (ownerPhone) drive = await getDriveConnectionStatus(ownerPhone);
} catch (error) {
  console.error(`Drive status failed: ${error instanceof Error ? error.message : String(error)}`);
}

const telegramConfigured = isTelegramLinkedDeviceConfigured();
const telegramStatus = getTelegramLinkedDeviceStatus();
const whatsappConfigured = isWhatsAppLinkedDeviceConfigured();
const whatsappStatus = getWhatsAppLinkedDeviceStatus();

const report = {
  country,
  mistral: {
    apiKey: redact(process.env.MISTRAL_API_KEY),
    featureFlag: mistral.status,
    bypassRequested,
    selectedProvider,
    model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  },
  googleDrive: {
    deploymentOAuthConfigured: has(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID) && has(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET) && has(process.env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI),
    featureFlag: getFeatureFlagStatus(country, 'google_drive').status,
    ownerChecked: Boolean(ownerPhone),
    ownerPhoneSource: ownerPhone ? 'configured-owner' : 'not-provided',
    status: drive,
  },
  telegramLinkedDevice: {
    runtimeConfigured: telegramConfigured,
    state: telegramStatus.state,
    ownerConfigured: telegramStatus.ownerConfigured,
    qrAvailable: telegramStatus.qrAvailable,
    apiId: has(process.env.TELEGRAM_API_ID) ? 'configured' : 'missing',
    apiHash: redact(process.env.TELEGRAM_API_HASH),
    sessionEncryption: sessionEncryptionConfigured ? 'configured' : 'missing',
  },
  whatsappLinkedDevice: {
    runtimeConfigured: whatsappConfigured,
    state: whatsappStatus.state,
    ownerConfigured: Boolean(process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_OWNER_PHONE),
    qrAvailable: whatsappStatus.qrAvailable,
    authStorageBoundary: 'private-0700-directory; production requires encrypted deployment volume',
  },
};

console.log(JSON.stringify(report, null, 2));

const hardFailures: string[] = [];
if (bypassRequested && (!has(process.env.MISTRAL_API_KEY) || mistral.status === 'DISABLED' || !mistral.enabled)) {
  hardFailures.push('Mistral bypass was requested but hosted_mistral is not enabled/configured.');
}
if (process.env.FF_GOOGLE_DRIVE === 'true' && (!has(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_ID) || !has(process.env.KURUKOO_GOOGLE_DRIVE_CLIENT_SECRET) || !has(process.env.KURUKOO_GOOGLE_DRIVE_REDIRECT_URI))) {
  hardFailures.push('Google Drive is enabled but OAuth deployment configuration is incomplete.');
}
if (process.env.KURUKOO_TELEGRAM_LINKED_DEVICE_ENABLED === 'true' && (!has(process.env.TELEGRAM_API_ID) || !has(process.env.TELEGRAM_API_HASH) || !sessionEncryptionConfigured)) {
  hardFailures.push('Telegram linked-device mode is enabled but Telegram API credentials or encrypted session storage configuration is incomplete.');
}

if (hardFailures.length) {
  for (const failure of hardFailures) console.error(`ACTIVATION ERROR: ${failure}`);
  process.exitCode = 2;
}
