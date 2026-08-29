/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import 'dotenv/config';
import { getFeatureRegistryReadiness } from '../src/services/featureFlags.js';
import { getExternalIntegrationReadiness } from '../src/services/externalIntegrationReadiness.js';
import { getExternalIntegrationOperationalStatus } from '../src/services/externalIntegrationOperationalStatus.js';
import { getPrivacyBridgeStatus } from '../src/services/privacyBridge.js';

const env = process.env;
const production = env.NODE_ENV === 'production';
const failures: string[] = [];
const warnings: string[] = [];

const present = (...values: unknown[]) => values.every(value => String(value ?? '').trim().length > 0);
const anyPresent = (...values: unknown[]) => values.some(value => String(value ?? '').trim().length > 0);
const enabled = (name: string) => env[name] === 'true';
const placeholderSecret = (value: string) => !value || /CHANGE_ME|example|replace|TODO/i.test(value);

if (!production) warnings.push('NODE_ENV is not production; this is a preview of production activation checks.');
if (placeholderSecret(String(env.JWT_SECRET || ''))) failures.push('JWT_SECRET is missing or still a placeholder.');
if (!present(env.DB_PATH) || String(env.DB_PATH).startsWith('/tmp/')) failures.push('DB_PATH must point to durable production state and must not use /tmp.');
if (!present(env.KURUKOO_STORAGE_ENCRYPTION_KEY) && (enabled('FF_GOOGLE_DRIVE') || enabled('FF_GOOGLE_SHEETS') || enabled('FF_NOTION') || enabled('FF_OUTLOOK') || enabled('FF_ONEDRIVE'))) failures.push('Owner-scoped external artifact/source features require KURUKOO_STORAGE_ENCRYPTION_KEY.');

if (enabled('FF_FCM')) {
  const serverConfigured = anyPresent(env.FCM_SERVICE_ACCOUNT_JSON, env.FCM_SERVICE_ACCOUNT_PATH) || present(env.KURUKOO_FCM_CLIENT_EMAIL, env.KURUKOO_FCM_PRIVATE_KEY, env.KURUKOO_FCM_PROJECT_ID);
  if (!serverConfigured) failures.push('FCM is enabled but no supported server credential path is configured.');
  if (!present(env.FIREBASE_API_KEY, env.FIREBASE_AUTH_DOMAIN, env.FIREBASE_PROJECT_ID, env.FIREBASE_STORAGE_BUCKET, env.FIREBASE_MESSAGING_SENDER_ID, env.FIREBASE_APP_ID, env.KURUKOO_FCM_VAPID_KEY)) failures.push('FCM is enabled but Web/PWA Firebase configuration is incomplete.');
}

if (enabled('FF_PRIVATE_NUMBER_MASKING')) {
  const privacy = getPrivacyBridgeStatus(env);
  if (!privacy.configured) failures.push('Private-number masking is enabled without a configured telephony provider.');
  else warnings.push('Private-number masking still requires real provider number ownership, routing and delivery evidence.');
}

if (enabled('FF_WEBRTC') && !anyPresent(env.STUN_SERVERS, env.TURN_URL, env.TURN_SERVER_URL)) failures.push('WebRTC is enabled without STUN/TURN/relay configuration.');
if (enabled('FF_IOT_REMOTE') && !present(env.MQTT_BROKER_URL)) failures.push('IoT remote control is enabled without MQTT_BROKER_URL.');
if (enabled('FF_STRIPE_PAYMENTS') && !present(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)) failures.push('Stripe payments are enabled without signed payment credentials.');
if (enabled('FF_WHATSAPP') && !present(env.WHATSAPP_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID, env.WHATSAPP_APP_SECRET)) failures.push('WhatsApp is enabled without approved provider credentials.');
if (enabled('FF_TELEGRAM') && !present(env.TELEGRAM_BOT_TOKEN)) failures.push('Telegram is enabled without bot credentials.');
if (enabled('FF_SMS') && !anyPresent(env.SMS_PROVIDER, env.SMS_API_KEY, env.AFRICASTALKING_API_KEY, env.AT_API_KEY)) failures.push('SMS is enabled without an approved provider configuration.');

const integrations = getExternalIntegrationReadiness(env);
const operational = getExternalIntegrationOperationalStatus();
const featureReadiness = getFeatureRegistryReadiness(env.KURUKOO_COUNTRY || 'ng');

for (const item of integrations) {
  if (item.readiness?.PRODUCTION_ACTIVE === true && item.readiness?.LIVE_VERIFIED !== true) failures.push(`${item.id} reports production-active without independent live verification.`);
}
for (const item of operational) {
  if (item.runtimeReady && item.physicalOrProviderEvidenceRequired) warnings.push(`${item.id} is runtime-ready but still requires independent provider/device evidence.`);
}

const report = {
  ok: failures.length === 0,
  production,
  failures,
  warnings,
  enabledFeatures: featureReadiness.filter(item => item.enabled).map(item => item.flagName),
  waitingForProvider: featureReadiness.filter(item => item.status === 'WAITING_FOR_PROVIDER').map(item => item.flagName),
  operational: operational.map(item => ({ id: item.id, configured: item.configured, connected: item.connected, runtimeReady: item.runtimeReady, evidenceRequired: item.physicalOrProviderEvidenceRequired })),
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
