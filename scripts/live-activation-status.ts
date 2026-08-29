/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import { getFeatureFlagStatus } from '../src/services/featureFlags.js';
import { getDriveConnectionStatus } from '../src/services/artifactService.js';
import { getTelegramLinkedDeviceStatus, isTelegramLinkedDeviceConfigured } from '../src/services/telegramLinkedDeviceService.js';
import { getWhatsAppLinkedDeviceStatus, isWhatsAppLinkedDeviceConfigured } from '../src/services/whatsappLinkedDeviceService.js';

async function main(): Promise<void> {
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  const ownerPhone = String(process.env.KURUKOO_TEST_PHONE || '').trim();
  const mistral = getFeatureFlagStatus(country, 'hosted_mistral');
  console.log(JSON.stringify({
    mistral: { status: mistral.status, configured: mistral.configured, enabled: mistral.enabled },
    googleDrive: await getDriveConnectionStatus(ownerPhone || 'activation-status-owner'),
    telegramLinkedDevice: { configured: isTelegramLinkedDeviceConfigured(), ...getTelegramLinkedDeviceStatus(), qrDataUrl: undefined },
    whatsappLinkedDevice: { configured: isWhatsAppLinkedDeviceConfigured(), ...getWhatsAppLinkedDeviceStatus(), qrDataUrl: undefined },
  }, null, 2));
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
