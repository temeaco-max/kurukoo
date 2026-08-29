/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { queryUnifiedAI } from '../src/services/unifiedAiEngine.js';
import { getFeatureFlagStatus } from '../src/services/featureFlags.js';
import { getDriveConnectionStatus, startGoogleDriveConnection } from '../src/services/artifactService.js';
import { getTelegramLinkedDeviceStatus, isTelegramLinkedDeviceConfigured, startTelegramLinkedDevice } from '../src/services/telegramLinkedDeviceService.js';
import { getWhatsAppLinkedDeviceStatus, isWhatsAppLinkedDeviceConfigured, startWhatsAppLinkedDevice } from '../src/services/whatsappLinkedDeviceService.js';

function loadLocalEnv(): void {
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') return;
  try {
    const file = path.resolve('.env');
    if (!fs.existsSync(file)) return;
    for (const line of String(fs.readFileSync(file, 'utf8')).split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, '');
    }
  } catch {
    // Status-only checks remain useful when local .env loading is unavailable.
  }
}

function result(name: string, status: 'PASS' | 'READY' | 'BLOCKED' | 'NOT_CONFIGURED' | 'ERROR', detail: string): void {
  console.log(`${name}: ${status} — ${detail}`);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const country = process.env.KURUKOO_DEFAULT_COUNTRY || 'ng';
  const ownerPhone = String(process.env.KURUKOO_TEST_PHONE || process.env.KURUKOO_GOOGLE_DRIVE_TEST_PHONE || '').trim();

  const mistral = getFeatureFlagStatus(country, 'hosted_mistral');
  if (!mistral.enabled) {
    result('Mistral', mistral.configured ? 'BLOCKED' : 'NOT_CONFIGURED', `feature=${mistral.status}; enable FF_HOSTED_MISTRAL and provide MISTRAL_API_KEY`);
  } else {
    try {
      const response = await queryUnifiedAI('Reply with exactly: Kurukoo Mistral activation check passed.', {
        provider: 'mistral',
        conversational: true,
        phone: ownerPhone || undefined,
        systemPrompt: 'Return the requested short verification text only.'
      });
      const passed = response.provider === 'Mistral' && response.text.trim().length > 0;
      result('Mistral', passed ? 'PASS' : 'ERROR', `${response.provider}/${response.model}; ${response.latencyMs}ms`);
    } catch (error) {
      result('Mistral', 'ERROR', error instanceof Error ? error.message : 'Provider request failed');
    }
  }

  const drive = await getDriveConnectionStatus(ownerPhone || 'activation-smoke-owner');
  if (!drive.configured) {
    result('Google Drive', 'NOT_CONFIGURED', 'OAuth client ID, secret and exact redirect URI are missing');
  } else if (!drive.enabled) {
    result('Google Drive', 'BLOCKED', 'FF_GOOGLE_DRIVE is disabled');
  } else if (!ownerPhone) {
    result('Google Drive', 'READY', 'OAuth is configured; set KURUKOO_TEST_PHONE to begin an owner-bound consent run');
  } else if (drive.connected) {
    result('Google Drive', 'PASS', 'owner is already connected');
  } else {
    try {
      const authorization = await startGoogleDriveConnection(ownerPhone);
      console.log(`Google Drive OAuth URL (one-time state): ${authorization.authorizationUrl}`);
      result('Google Drive', 'READY', `consent URL issued; expires ${authorization.expiresAt}`);
    } catch (error) {
      result('Google Drive', 'ERROR', error instanceof Error ? error.message : 'OAuth start failed');
    }
  }

  const telegramConfigured = isTelegramLinkedDeviceConfigured();
  const telegramStatus = getTelegramLinkedDeviceStatus();
  if (!telegramConfigured) {
    result('Telegram linked device', telegramStatus.enabled ? 'BLOCKED' : 'NOT_CONFIGURED', `state=${telegramStatus.state}; requires TELEGRAM_API_ID/HASH, owner phone and explicit enable flags`);
  } else if (telegramStatus.state === 'connected') {
    result('Telegram linked device', 'PASS', `connected user=${telegramStatus.userId || 'unknown'}`);
  } else {
    try {
      await startTelegramLinkedDevice();
      const status = getTelegramLinkedDeviceStatus();
      result('Telegram linked device', status.qrAvailable ? 'READY' : status.state === 'connected' ? 'PASS' : 'BLOCKED', `state=${status.state}; qr=${status.qrAvailable ? 'available' : 'unavailable'}`);
    } catch (error) {
      result('Telegram linked device', 'ERROR', error instanceof Error ? error.message : 'Telegram startup failed');
    }
  }

  const whatsappConfigured = isWhatsAppLinkedDeviceConfigured();
  const whatsappStatus = getWhatsAppLinkedDeviceStatus();
  if (!whatsappConfigured) {
    result('WhatsApp linked device', whatsappStatus.enabled ? 'BLOCKED' : 'NOT_CONFIGURED', `state=${whatsappStatus.state}; requires owner phone and explicit enable flags`);
  } else if (whatsappStatus.connected) {
    result('WhatsApp linked device', 'PASS', `connected account=${whatsappStatus.connectedAccount || 'unknown'}`);
  } else {
    try {
      await startWhatsAppLinkedDevice();
      const status = getWhatsAppLinkedDeviceStatus();
      result('WhatsApp linked device', status.qrAvailable ? 'READY' : status.connected ? 'PASS' : 'BLOCKED', `state=${status.state}; qr=${status.qrAvailable ? 'available' : 'unavailable'}`);
    } catch (error) {
      result('WhatsApp linked device', 'ERROR', error instanceof Error ? error.message : 'WhatsApp startup failed');
    }
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
