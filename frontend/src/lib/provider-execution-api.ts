import type { EconomicRequest, EconomicParticipant } from "@/lib/kurukoo-api";

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
function apiUrl(path: string) { return `${API_BASE}/api/provider-communication${path}`; }
async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Provider request failed (${response.status})`);
  return payload as T;
}

export type ProviderRequest = {
  id: string;
  customerPhone: string;
  skill: string;
  category: string;
  status: string;
  requirements: Record<string, unknown>;
  quote: Record<string, unknown> | null;
  fulfillment: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  participant: { role: string; capability: string; status: string; evidence: Record<string, unknown> };
};

export async function fetchProviderRequests(limit = 20) {
  const payload = await readJson<{ requests?: ProviderRequest[] }>(`/requests?limit=${Math.min(50, Math.max(1, limit))}`);
  return Array.isArray(payload.requests) ? payload.requests : [];
}
export async function fetchProviderRequest(id: string) {
  return readJson<{ request: EconomicRequest; participant: EconomicParticipant; communicationSessionId?: string | null; communicationState?: string | null }>(`/requests/${encodeURIComponent(id)}`);
}
export async function submitProviderQuote(id: string, input: { amountMinor: number; currency: string; note?: string; validUntil?: string; providerName?: string; revision?: number }) {
  return readJson<{ request: EconomicRequest; participant: EconomicParticipant; quote: Record<string, unknown> }>(`/requests/${encodeURIComponent(id)}/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export async function acceptProviderRequest(id: string) {
  return readJson<{ request: EconomicRequest; participant: EconomicParticipant; started: boolean }>(`/requests/${encodeURIComponent(id)}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
export async function declineProviderRequest(id: string, reason?: string) {
  return readJson<{ request: EconomicRequest; participant: EconomicParticipant }>(`/requests/${encodeURIComponent(id)}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
}
export async function submitProviderEvidence(id: string, status: string, evidence: Record<string, unknown>) {
  return readJson<{ request: EconomicRequest; participant: EconomicParticipant; awaitingCustomerConfirmation?: boolean }>(`/requests/${encodeURIComponent(id)}/evidence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, evidence }) });
}
export async function startProviderCommunication(id: string) {
  return readJson<{ session: { id: string; state: string; conversationId?: string } }>(`/requests/${encodeURIComponent(id)}/communication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "both" }) });
}
export type ProviderSessionMessage = { id: number; sender: string; content: string; created_at?: string; createdAt?: string; metadata?: string | Record<string, unknown> | null };
export async function fetchProviderSessionMessages(sessionId: string) {
  const payload = await readJson<{ messages?: ProviderSessionMessage[] }>(`/sessions/${encodeURIComponent(sessionId)}/messages?limit=50`);
  return Array.isArray(payload.messages) ? payload.messages : [];
}
export async function sendProviderSessionMessage(sessionId: string, content: string) {
  return readJson<{ message: ProviderSessionMessage }>(`/sessions/${encodeURIComponent(sessionId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
}
export async function updateProviderSessionState(sessionId: string, state: string) {
  return readJson<{ session: Record<string, unknown> }>(`/sessions/${encodeURIComponent(sessionId)}/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
}
