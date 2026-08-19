import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";

function friendlyVerificationError(status: number, payload: Record<string, unknown>): string {
  if (status === 401) return "That verification code did not match or has expired. Request a new code and try again.";
  if (status === 400) return "Check the email address and verification details, then try again.";
  if (status === 502 || status === 503) return "Email verification is temporarily unavailable here. No link or code was sent.";
  if (status === 429) return "Too many verification attempts. Wait a moment before trying again.";
  if (typeof payload.message === "string" && payload.message.toLowerCase().includes("phone number")) return "This account needs a phone number before device verification can finish. Continue with phone verification instead.";
  return "We couldn’t complete device verification. Check your connection and try again.";
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(friendlyVerificationError(response.status, payload as Record<string, unknown>));
  return payload as Record<string, unknown>;
}

function endpoint(path: string): string {
  return `${getApiBaseUrl().replace(/\/$/, "")}${path}`;
}

export async function requestDeviceEmailVerification(email: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(endpoint("/api/auth/request-email-otp"), {
      method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error("We couldn’t reach the verification service. Check your internet connection and try again.");
    throw error;
  }
  const payload = await parseResponse(response);
  return typeof payload.message === "string" ? payload.message : "Verification request created. Enter the code from the approved channel.";
}

export async function verifyDeviceEmailCode(email: string, code: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(endpoint("/api/auth/verify-email-otp"), {
      method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), credentialType: "mobile-device" }),
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error("We couldn’t reach the verification service. Check your internet connection and try again.");
    throw error;
  }
  const payload = await parseResponse(response);
  if (typeof payload.token === "string") await Auth.setSessionToken(payload.token);
  return typeof payload.message === "string" ? payload.message : "Device verification completed.";
}
