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

/** Start/lock the canonical escrow boundary after payment evidence is available. */
export async function lockEconomicEscrow(id: string) {
  return readJson<{ success: boolean; orderId?: string; status?: string; message?: string; error?: string }>(`/api/economic-requests/${encodeURIComponent(id)}/escrow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
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

/** Ask the canonical dispatch coordinator to find eligible live providers. */
export async function broadcastEconomicRequest(input: { requestId: string; skill: string; vehicleType?: string; location?: string }) {
  const payload = await readJson<{ success: boolean; requestId: string; offers?: Array<{ id: string; providerPhone: string; skill: string; status: string }>; providers?: unknown[]; error?: string }>(`/api/economic-requests/${encodeURIComponent(input.requestId)}/dispatch/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skill: input.skill,
      vehicleType: input.vehicleType || undefined,
      location: input.location || undefined,
      maxProviders: 8,
    }),
  });
  return { ...payload, offers: payload.offers ?? [], providers: payload.providers ?? [] };
}

/** Confirm a provider-reported real-world completion as the request owner. */
export async function confirmDispatchCompletion(leadId: string) {
  const payload = await readJson<{ success: boolean; lead?: { status?: string } }>(`/api/dispatch-leads/${encodeURIComponent(leadId)}/confirm-completion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!payload.lead) throw new Error("Completion confirmation was not recorded.");
  return payload.lead;
}

/** Submit the owner's review after the canonical request has completed. */
export async function submitEconomicReview(input: { requestId: string; providerPhone: string; rating: number; feedback?: string }) {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Choose a rating from 1 to 5.");
  if (!input.providerPhone.trim()) throw new Error("A provider is required before submitting a review.");
  const payload = await readJson<{ success: boolean; review?: Record<string, unknown> }>(`/api/economic-requests/${encodeURIComponent(input.requestId)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerPhone: input.providerPhone.trim(),
      rating,
      feedback: input.feedback?.trim() || undefined,
    }),
  });
  if (!payload.review) throw new Error("The review was not submitted.");
  return payload.review;
}
