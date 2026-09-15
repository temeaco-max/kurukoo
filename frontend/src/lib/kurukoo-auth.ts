import { getDeviceId } from './device-id.js';

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

async function readJson<T>(path: string, init?: RequestInit): Promise<{ response: Response; payload: T }> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload = (await response.json().catch(() => ({}))) as T;
  return { response, payload };
}

/** Canonical backend auth helpers — no frontend-only session bypass. */
export type KurukooAuthUser = { phone?: string; email?: string; role?: string; [key: string]: unknown };

export async function getKurukooAuthState(): Promise<{ authenticated: boolean; user: KurukooAuthUser | null }> {
  try {
    const { response, payload } = await readJson<{ success?: boolean; user?: KurukooAuthUser }>('/api/auth/me');
    if (!response.ok || !payload?.success || !payload.user) return { authenticated: false, user: null };
    // The canonical auth JWT is phone-rooted; read profile so the UI has email/name too.
    try {
      const profileResponse = await readJson<{ profile?: { email?: string; name?: string; phone?: string } }>('/api/user/profile');
      if (profileResponse.response.ok && profileResponse.payload?.profile) {
        return {
          authenticated: true,
          user: { ...payload.user, ...profileResponse.payload.profile },
        };
      }
    } catch { /* /api/auth/me remains authoritative if profile lookup is unavailable */ }
    return { authenticated: true, user: payload.user };
  } catch {
    return { authenticated: false, user: null };
  }
}

export async function requestPhoneOtp(phone: string) {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) throw new Error('Enter your phone number.');
  const { response, payload } = await readJson<{ success?: boolean; message?: string; error?: string }>('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalizedPhone }),
  });
  if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error || 'Unable to send a verification code.');
  return payload;
}

export async function verifyPhoneOtp(input: { phone: string; code: string; name?: string; email?: string }) {
  const phone = input.phone.trim();
  const code = input.code.trim();
  if (!phone) throw new Error('Enter your phone number.');
  if (!code) throw new Error('Enter the verification code.');
  const { response, payload } = await readJson<{ success?: boolean; message?: string; error?: string; phone?: string }>('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kurukoo-device-id': getDeviceId() },
    body: JSON.stringify({ phone, code, name: input.name?.trim() || undefined, email: input.email?.trim().toLowerCase() || undefined, deviceId: getDeviceId(), credentialType: 'web' }),
  });
  if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error || 'Unable to verify your phone.');
  return payload;
}

export async function requestMagicLink(input: { email: string; name?: string; returnPath?: string }) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Enter your email address.');
  const { response, payload } = await readJson<{ success?: boolean; message?: string; error?: string; debugUrl?: string; challengeId?: string }>('/api/auth/request-magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name: input.name?.trim() || undefined, returnPath: input.returnPath }),
  });
  if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error || 'Unable to send a magic link.');
  // If debug mode is enabled, return the real challenge completion URL so the user can
  // complete authentication locally without waiting for email delivery.
  if (payload.debugUrl) {
    return { success: true, message: payload.message, debugUrl: payload.debugUrl, delivery: 'debug' as const };
  }
  return { success: true, message: payload.message, delivery: 'email' as const };
}

export async function logoutKurukoo() {
  try {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  } finally {
    window.dispatchEvent(new Event('kurukoo-auth-updated'));
  }
}
