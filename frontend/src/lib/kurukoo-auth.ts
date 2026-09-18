const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

/** Temporary frontend-only access gate. Remove this constant and related checks when normal access is restored. */
export const KURUKOO_BUILD_EMAIL = "temea.co@gmail.com";
const BUILD_EMAIL_SESSION_KEY = "kurukoo-build-email-authenticated";

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

async function readJson<T>(path: string, init?: RequestInit): Promise<{ response: Response; payload: T }> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload = (await response.json().catch(() => ({}))) as T;
  return { response, payload };
}

export type KurukooAuthUser = { phone?: string; email?: string; role?: string; [key: string]: unknown };

export function isAllowedKurukooBuildAccount(user: KurukooAuthUser | null | undefined) {
  return user?.email?.trim().toLowerCase() === KURUKOO_BUILD_EMAIL;
}

export function hasTemporaryBuildEmailSession() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BUILD_EMAIL_SESSION_KEY)?.trim().toLowerCase() === KURUKOO_BUILD_EMAIL;
}

export function startTemporaryBuildEmailSession(email: string) {
  if (email.trim().toLowerCase() !== KURUKOO_BUILD_EMAIL) {
    throw new Error(`This build is currently available only to ${KURUKOO_BUILD_EMAIL}.`);
  }
  window.localStorage.setItem(BUILD_EMAIL_SESSION_KEY, KURUKOO_BUILD_EMAIL);
  window.localStorage.setItem("kurukoo-authenticated", "true");
  window.dispatchEvent(new Event("kurukoo-auth-updated"));
}

export async function getKurukooAuthState(): Promise<{ authenticated: boolean; user: KurukooAuthUser | null }> {
  if (hasTemporaryBuildEmailSession()) {
    return { authenticated: true, user: { email: KURUKOO_BUILD_EMAIL, role: "build-access" } };
  }
  try {
    const { response, payload } = await readJson<{ success?: boolean; user?: KurukooAuthUser }>("/api/auth/me");
    if (!response.ok || !payload?.success || !payload.user) return { authenticated: false, user: null };
    // The canonical auth JWT is phone-rooted and may not carry the profile email.
    // Read the already-authenticated profile so the temporary frontend gate can
    // identify the permitted build account without introducing a new backend auth path.
    try {
      const profileResponse = await readJson<{ profile?: { email?: string; name?: string; phone?: string } }>("/api/user/profile");
      if (profileResponse.response.ok && profileResponse.payload?.profile) {
        return {
          authenticated: true,
          user: { ...payload.user, ...profileResponse.payload.profile },
        };
      }
    } catch { /* auth/me remains authoritative if profile lookup is unavailable */ }
    return { authenticated: true, user: payload.user };
  } catch {
    return { authenticated: false, user: null };
  }
}

export async function requestPhoneOtp(phone: string) {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) throw new Error("Enter your phone number.");
  const { response, payload } = await readJson<{ success?: boolean; message?: string; error?: string }>("/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: normalizedPhone }),
  });
  if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error || "Unable to send a verification code.");
  return payload;
}

export async function verifyPhoneOtp(input: { phone: string; code: string; name?: string; email?: string }) {
  const phone = input.phone.trim();
  const code = input.code.trim();
  if (!phone) throw new Error("Enter your phone number.");
  if (!code) throw new Error("Enter the verification code.");
  const email = (input.email || KURUKOO_BUILD_EMAIL).trim().toLowerCase();
  if (email !== KURUKOO_BUILD_EMAIL) throw new Error(`This build is currently available only to ${KURUKOO_BUILD_EMAIL}.`);
  const { response, payload } = await readJson<{ success?: boolean; message?: string; error?: string; phone?: string }>("/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-kurukoo-device-id": getDeviceId() },
    body: JSON.stringify({ phone, code, name: input.name?.trim() || undefined, email, deviceId: getDeviceId(), credentialType: "web" }),
  });
  if (!response.ok || payload.success === false) throw new Error(payload.message || payload.error || "Unable to verify your phone.");
  return payload;
}

/** Email delivery is intentionally bypassed for the temporary frontend access gate. */
export async function requestMagicLink(input: { email: string; name?: string; returnPath?: string }) {
  const email = input.email.trim().toLowerCase();
  if (email !== KURUKOO_BUILD_EMAIL) {
    throw new Error(`This build is currently available only to ${KURUKOO_BUILD_EMAIL}.`);
  }
  // Do not call the real magic-link endpoint while the frontend gate is active.
  startTemporaryBuildEmailSession(email);
  return { success: true, delivery: "frontend-access" as const };
}

export async function logoutKurukoo() {
  try {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
  } finally {
    window.localStorage.removeItem(BUILD_EMAIL_SESSION_KEY);
    window.localStorage.removeItem("kurukoo-authenticated");
    window.dispatchEvent(new Event("kurukoo-auth-updated"));
  }
}

function getDeviceId() {
  const key = "kurukoo-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, id);
  return id;
}
