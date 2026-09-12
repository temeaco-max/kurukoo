import type { EconomicRequest } from "@/lib/kurukoo-api";

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Kurukoo request failed (${response.status})`);
  return payload as T;
}

/** Customer transitions exposed by the canonical economic-request router. */
export async function approveEconomicRequest(id: string) {
  const payload = await readJson<{ success: boolean; request?: EconomicRequest }>(`/api/economic-requests/${encodeURIComponent(id)}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "reserved" }),
  });
  if (!payload.request) throw new Error("The request was not updated.");
  return payload.request;
}

export async function completeEconomicRequest(id: string, evidence?: Record<string, unknown>) {
  const payload = await readJson<{ success: boolean; request?: EconomicRequest }>(`/api/economic-requests/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidence }),
  });
  return payload.request ?? null;
}

export async function cancelEconomicRequest(id: string) {
  const payload = await readJson<{ success: boolean; request?: EconomicRequest }>(`/api/economic-requests/${encodeURIComponent(id)}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!payload.request) throw new Error("The request was not updated.");
  return payload.request;
}
