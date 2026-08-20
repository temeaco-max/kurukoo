import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { deactivateFcmToken, parseFcmTokenCollection } from './fcmDeviceRegistry.js';

interface FirebaseServiceAccount { project_id?: string; client_email?: string; private_key?: string; }
export interface FcmReadiness { configured: boolean; projectId?: string; reason: string; }
export interface FirebaseWebConfigResponse { success: true; configured: boolean; reason: string; config?: { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string; vapidKey: string; }; }
export interface FcmSendResult { attempted: boolean; accepted: boolean; providerReference?: string; failureReason?: string; }
export interface FcmActivationProbe { configured: boolean; reachable: boolean; projectId?: string; detail: string; }
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function readServiceAccount(): FirebaseServiceAccount | null {
  const pathValue = process.env.FCM_SERVICE_ACCOUNT_PATH || '';
  if (pathValue) {
    try { const require = createRequire(import.meta.url); const parsed = JSON.parse(require('node:fs').readFileSync(pathValue, 'utf8')) as FirebaseServiceAccount; if (parsed.project_id && parsed.client_email && parsed.private_key) return parsed; } catch { return null; }
  }
  const raw = String(process.env.FCM_SERVICE_ACCOUNT_JSON || '').trim();
  if (raw) {
    try { const parsed = JSON.parse(raw) as FirebaseServiceAccount; if (parsed.project_id && parsed.client_email && parsed.private_key) return parsed; } catch { return null; }
  }
  const projectId = String(process.env.KURUKOO_FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.KURUKOO_FCM_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.KURUKOO_FCM_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey.replace(/\\n/g, '\n') };
}

export function getFirebaseFcmReadiness(): FcmReadiness {
  const account = readServiceAccount();
  if (!account) return { configured: false, reason: 'FCM service-account configuration is absent or invalid.' };
  return { configured: true, projectId: account.project_id, reason: 'FCM service-account configuration is present; provider and device delivery still require runtime validation.' };
}

export function getFirebaseWebConfig(): FirebaseWebConfigResponse {
  const config = {
    apiKey: String(process.env.FIREBASE_API_KEY || '').trim(),
    authDomain: String(process.env.FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: String(process.env.FIREBASE_PROJECT_ID || process.env.KURUKOO_FCM_PROJECT_ID || '').trim(),
    storageBucket: String(process.env.FIREBASE_STORAGE_BUCKET || '').trim(),
    messagingSenderId: String(process.env.FIREBASE_MESSAGING_SENDER_ID || '').trim(),
    appId: String(process.env.FIREBASE_APP_ID || '').trim(),
    vapidKey: String(process.env.KURUKOO_FCM_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '').trim(),
  };
  const configured = Object.values(config).every(Boolean);
  return configured ? { success: true, configured: true, reason: 'Firebase web configuration is available for client registration.', config } : { success: true, configured: false, reason: 'Firebase web configuration is incomplete; push permission and token registration remain unavailable until the public web configuration and VAPID key are configured.' };
}

function base64Url(value: string): string { return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }

async function getAccessToken(account: FirebaseServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(String(account.private_key), 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${header}.${claim}.${signature}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}` });
  if (!response.ok) throw new Error(`oauth_token_http_${response.status}`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('oauth_token_missing');
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000 };
  return data.access_token;
}

export async function probeFirebaseFcmConnection(): Promise<FcmActivationProbe> {
  const account = readServiceAccount();
  if (!account?.project_id || !account.client_email || !account.private_key) {
    return { configured: false, reachable: false, detail: 'FCM service-account configuration is absent or invalid.' };
  }
  try {
    await getAccessToken(account);
    return { configured: true, reachable: true, projectId: account.project_id, detail: 'Firebase service-account credentials successfully exchanged for an FCM OAuth access token. This proves provider authentication, not delivery to a physical device.' };
  } catch (error) {
    cachedAccessToken = null;
    return { configured: true, reachable: false, projectId: account.project_id, detail: error instanceof Error ? error.message.slice(0, 200) : 'FCM provider authentication failed.' };
  }
}

async function sendOneFcmToken(accessToken: string, account: FirebaseServiceAccount, token: string, input: { title: string; body: string; link?: string }): Promise<{ accepted: boolean; providerReference?: string; failureReason?: string }> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id!)}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title: input.title, body: input.body }, ...(input.link ? { webpush: { fcm_options: { link: input.link } } } : {}) } }),
  });
  const data = await response.json().catch(() => ({})) as { name?: string; error?: { status?: string; message?: string } };
  if (response.ok) return { accepted: true, providerReference: typeof data.name === 'string' ? data.name.slice(0, 256) : undefined };
  const providerStatus = String(data.error?.status || '').toUpperCase();
  const message = String(data.error?.message || '').toLowerCase();
  const reason = providerStatus === 'UNREGISTERED' || message.includes('unregistered') || message.includes('not a valid fcm registration token') ? 'device_token_unregistered' : `fcm_http_${response.status}`;
  return { accepted: false, failureReason: reason };
}

export async function sendFirebaseFcmMessage(input: { token: string; title: string; body: string; link?: string }): Promise<FcmSendResult> {
  const account = readServiceAccount();
  if (!account?.project_id || !account.client_email || !account.private_key) return { attempted: false, accepted: false, failureReason: 'fcm_not_configured' };
  const tokens = parseFcmTokenCollection(input.token);
  if (!tokens.length) return { attempted: false, accepted: false, failureReason: 'device_token_missing' };
  try {
    const accessToken = await getAccessToken(account);
    let accepted = 0;
    let firstReference: string | undefined;
    let firstFailure: string | undefined;
    for (const token of tokens) {
      try {
        const result = await sendOneFcmToken(accessToken, account, token, input);
        if (result.accepted) { accepted += 1; firstReference ||= result.providerReference; }
        else {
          firstFailure ||= result.failureReason;
          if (result.failureReason === 'device_token_unregistered') await deactivateFcmToken(token, result.failureReason).catch(() => undefined);
        }
      } catch (error) { firstFailure ||= error instanceof Error ? error.message.slice(0, 160) : 'fcm_request_failed'; }
    }
    return accepted > 0 ? { attempted: true, accepted: true, providerReference: firstReference } : { attempted: true, accepted: false, failureReason: firstFailure || 'fcm_request_failed' };
  } catch (error) {
    return { attempted: true, accepted: false, failureReason: error instanceof Error ? error.message.slice(0, 160) : 'fcm_request_failed' };
  }
}

export function resetFirebaseFcmTokenCache(): void { cachedAccessToken = null; }
