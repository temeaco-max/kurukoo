const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
function apiUrl(path: string) { return `${API_BASE}${path}`; }
async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Kurukoo request failed (${response.status})`);
  return payload as T;
}
export type Credential = { id: string; label: string; domain?: string | null; credentialType?: string | null; expiresAt?: string | null; lastUsedAt?: string | null };
export type VirtualCard = { id: string; last4: string; brand: string; status: string; spendLimitMinor: number; currency: string; expiresAt?: string | null };
export type AuditEntry = { id: string; type?: string; action?: string; status?: string; createdAt?: string; timestamp?: string; summary?: string; requestId?: string | null; evidence?: Record<string, unknown> | null };
export type ExecutionSession = { id: string; status: string; expiresAt?: string | null; createdAt?: string; metadata?: Record<string, unknown> | null };
export type ExecutionAction = { id: string; type?: string; status?: string; createdAt?: string; payload?: Record<string, unknown> | null };
export async function fetchTrustOverview() {
  const results = await Promise.allSettled([
    readJson<{ credentials?: Credential[]; count?: number }>("/api/v1/credentials"),
    readJson<{ cards?: VirtualCard[] }>("/api/v1/cards"),
    readJson<{ sessions?: ExecutionSession[] }>("/api/v1/execution/sessions"),
    readJson<{ timeline?: AuditEntry[] }>("/api/v1/audit?limit=50"),
  ]);
  const value = <T,>(index: number, fallback: T): T => results[index].status === "fulfilled" ? results[index].value as T : fallback;
  return {
    credentials: value(0, { credentials: [], count: 0 }),
    cards: value(1, { cards: [] }),
    sessions: value(2, { sessions: [] }),
    audit: value(3, { timeline: [] }),
    availability: results.map((item) => item.status === "fulfilled" ? "available" : "unavailable"),
  };
}
export async function freezeTrustCard(id: string) { return readJson<{ success: boolean }>(`/api/v1/cards/${encodeURIComponent(id)}/freeze`, { method: "POST" }); }
export async function cancelTrustCard(id: string) { return readJson<{ success: boolean }>(`/api/v1/cards/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export async function stopExecutionSession(id: string) { return readJson<{ success: boolean }>(`/api/v1/execution/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export async function exportTrustAudit() {
  const response = await fetch(apiUrl("/api/v1/audit/export"), { credentials: "include" });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(typeof payload?.error === "string" ? payload.error : `Audit export failed (${response.status})`); }
  return response.blob();
}
