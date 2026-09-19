/**
 * Stable device identifier for the current browser.
 * Persisted in localStorage so the same device can be recognized across sessions.
 */
export function getDeviceId(): string {
  const key = "kurukoo-device-id";
  const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  if (existing) return existing;
  const id =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof window !== "undefined") window.localStorage.setItem(key, id);
  return id;
}
