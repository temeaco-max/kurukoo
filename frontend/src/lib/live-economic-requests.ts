import type { EconomicRequest } from "@/lib/kurukoo-api";

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Kurukoo request failed (${response.status})`);
  return payload as T;
}

/** Canonical Work index source. The economic-request router is mounted under /api/chat. */
export async function fetchLiveEconomicRequests(): Promise<EconomicRequest[]> {
  const payload = await readJson<{ requests?: EconomicRequest[] }>("/api/chat/economic-requests");
  return Array.isArray(payload.requests) ? payload.requests : [];
}
