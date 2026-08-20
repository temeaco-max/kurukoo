import { getExternalIntegrationOperationalStatus } from './externalIntegrationOperationalStatus.js';
import { stripeStatus } from './stripePayment.js';
import { getDriveConnectionStatus } from './artifactService.js';
import { testMistralConnection, getMistralModel } from './mistralService.js';
import { probeFirebaseFcmConnection } from './firebaseCloudMessaging.js';

export interface ExternalActivationResult {
  provider: string;
  configured: boolean;
  activated: boolean;
  verified: boolean;
  detail: string;
  externalReference?: string;
}

function publicBaseUrl(): string {
  return String(process.env.KURUKOO_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
}

async function telegram(): Promise<ExternalActivationResult> {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return { provider: 'telegram', configured: false, activated: false, verified: false, detail: 'TELEGRAM_BOT_TOKEN is not configured.' };
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const meBody = await me.json().catch(() => ({})) as any;
  if (!me.ok || meBody?.ok !== true) return { provider: 'telegram', configured: true, activated: false, verified: false, detail: String(meBody?.description || `Telegram getMe failed (${me.status}).`) };
  const base = publicBaseUrl();
  if (!base) return { provider: 'telegram', configured: true, activated: false, verified: true, detail: `Telegram bot ${meBody.result?.username || meBody.result?.id || 'configured'} authenticated; KURUKOO_PUBLIC_BASE_URL is required to register its webhook.` };
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  const webhook = `${base}/api/webhook/telegram`;
  const set = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: webhook, ...(secret ? { secret_token: secret } : {}), allowed_updates: ['message', 'edited_message'] }) });
  const setBody = await set.json().catch(() => ({})) as any;
  return set.ok && setBody?.ok === true
    ? { provider: 'telegram', configured: true, activated: true, verified: true, detail: `Telegram webhook registered at ${webhook}.`, externalReference: String(meBody.result?.username || meBody.result?.id || '') }
    : { provider: 'telegram', configured: true, activated: false, verified: true, detail: String(setBody?.description || `Telegram webhook registration failed (${set.status}).`) };
}

async function whatsapp(): Promise<ExternalActivationResult> {
  const token = String(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const graphVersion = String(process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0').trim().replace(/^v?/, 'v');
  if (!token || !phoneNumberId) return { provider: 'whatsapp', configured: false, activated: false, verified: false, detail: 'WHATSAPP_TOKEN/WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required.' };
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) return { provider: 'whatsapp', configured: true, activated: false, verified: false, detail: String(body?.error?.message || `WhatsApp phone-number lookup failed (${response.status}).`) };
  const subscription = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/subscribed_apps`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const subscriptionBody = await subscription.json().catch(() => ({})) as any;
  return subscription.ok
    ? { provider: 'whatsapp', configured: true, activated: true, verified: true, detail: `WhatsApp Cloud phone ${body?.display_phone_number || phoneNumberId} authenticated and app subscription activated using ${graphVersion}.`, externalReference: String(body?.id || phoneNumberId) }
    : { provider: 'whatsapp', configured: true, activated: false, verified: true, detail: String(subscriptionBody?.error?.message || `WhatsApp app subscription failed (${subscription.status}).`) };
}

async function stripe(): Promise<ExternalActivationResult> {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || !stripeStatus().configured) return { provider: 'stripe', configured: false, activated: false, verified: false, detail: 'Stripe secret/webhook configuration is incomplete.' };
  const response = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${key}` } });
  const body = await response.json().catch(() => ({})) as any;
  return response.ok
    ? { provider: 'stripe', configured: true, activated: true, verified: true, detail: `Stripe account ${body?.id || 'authenticated'} is reachable through the configured secret.`, externalReference: String(body?.id || '') }
    : { provider: 'stripe', configured: true, activated: false, verified: false, detail: String(body?.error?.message || `Stripe account verification failed (${response.status}).`) };
}

async function resend(): Promise<ExternalActivationResult> {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) return { provider: 'email', configured: false, activated: false, verified: false, detail: 'RESEND_API_KEY is not configured.' };
  const response = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
  const body = await response.json().catch(() => ({})) as any;
  return response.ok ? { provider: 'email', configured: true, activated: true, verified: true, detail: `Resend API authenticated; ${Array.isArray(body?.data) ? body.data.length : 0} sender domains visible.` } : { provider: 'email', configured: true, activated: false, verified: false, detail: String(body?.message || `Resend verification failed (${response.status}).`) };
}

async function fcm(): Promise<ExternalActivationResult> {
  try {
    const probe = await probeFirebaseFcmConnection();
    return probe.reachable
      ? { provider: 'fcm', configured: true, activated: true, verified: true, detail: probe.detail, externalReference: probe.projectId }
      : { provider: 'fcm', configured: probe.configured, activated: false, verified: probe.configured, detail: probe.detail };
  } catch (error) {
    return { provider: 'fcm', configured: true, activated: false, verified: false, detail: error instanceof Error ? error.message.slice(0, 200) : 'FCM activation probe failed.' };
  }
}

async function mistral(): Promise<ExternalActivationResult> {
  const key = String(process.env.MISTRAL_API_KEY || '').trim();
  if (!key) return { provider: 'mistral', configured: false, activated: false, verified: false, detail: 'MISTRAL_API_KEY is not configured.' };
  try {
    const probe = await testMistralConnection();
    return probe.reachable
      ? { provider: 'mistral', configured: true, activated: true, verified: true, detail: `Mistral ${getMistralModel()} is reachable; ${probe.modelCount ?? 0} models visible.`, externalReference: getMistralModel() }
      : { provider: 'mistral', configured: true, activated: false, verified: false, detail: probe.note };
  } catch (error) {
    return { provider: 'mistral', configured: true, activated: false, verified: false, detail: error instanceof Error ? error.message : 'Mistral activation probe failed.' };
  }
}

export async function activateConfiguredExternalProviders(): Promise<{ generatedAt: string; results: ExternalActivationResult[]; readiness: ReturnType<typeof getExternalIntegrationOperationalStatus> }> {
  const results = await Promise.all([telegram(), whatsapp(), stripe(), resend(), fcm(), mistral()]);
  return { generatedAt: new Date().toISOString(), results, readiness: getExternalIntegrationOperationalStatus() };
}

export async function probeConfiguredExternalProviders(phone = ''): Promise<Record<string, unknown>> {
  const drive = phone ? await getDriveConnectionStatus(phone).catch(error => ({ configured: false, enabled: false, connected: false, provider: 'google_drive' as const, scope: '', featureFlagState: 'error', reason: error instanceof Error ? error.message : 'drive_status_failed' })) : null;
  const activation = await activateConfiguredExternalProviders();
  return { ...activation, drive };
}
