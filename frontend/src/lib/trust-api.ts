/**
 * Canonical Trust API layer.
 *
 * Wraps the authenticated `/api/v1` secure-services contract. That contract is owned by the
 * **canonical backend repository** (`temeaco-max/kurukoo` → `src/routes/secureServicesRoutes.ts`)
 * and is intentionally not duplicated here: this repository contains only the client, so the
 * endpoints below cannot be re-verified from this checkout — they must be checked against the
 * backend, or against a running backend, before any claim about them is treated as proven.
 *
 * Covered capabilities: encrypted credentials, one-time cards + purchase protection, secure
 * execution sessions and the execution audit timeline.
 *
 * Every wrapper returns what the backend actually returns, and failures are typed so the UI can
 * tell "not available for this account or market" apart from a real error.
 */
const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

/** A failed Trust request. `state` is `unavailable` when the backend refuses the capability
 * (not authenticated, or the feature flag is not enabled for this market) and `error` otherwise. */
export class TrustApiError extends Error {
  readonly state: "unavailable" | "error";
  readonly status: number;
  constructor(message: string, state: "unavailable" | "error", status: number) {
    super(message);
    this.state = state;
    this.status = status;
  }
}

export function describeError(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function messageFrom(payload: unknown, status: number, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value;
  }
  return `${fallback} (${status})`;
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new TrustApiError(
      messageFrom(payload, response.status, "Kurukoo request failed"),
      response.status === 401 || response.status === 403 ? "unavailable" : "error",
      response.status,
    );
  return payload as T;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return readJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

// ── Encrypted credentials ────────────────────────────────────────────────
export type CredentialType = "password" | "api_key" | "token" | "note" | "other";
export type Credential = {
  id: string;
  label: string;
  domain?: string | null;
  credentialType?: CredentialType | null;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
};
export type StoredCredential = Credential & {
  ciphertext: string;
  iv: string;
  salt: string;
  algorithm?: string;
  iterations?: number;
};
export async function fetchCredentials() {
  const payload = await readJson<{ credentials?: Credential[]; count?: number }>(
    "/api/v1/credentials",
  );
  return {
    credentials: Array.isArray(payload.credentials) ? payload.credentials : [],
    count: typeof payload.count === "number" ? payload.count : 0,
  };
}
export async function storeCredential(input: {
  label: string;
  ciphertext: string;
  iv: string;
  salt: string;
  domain?: string;
  credentialType?: CredentialType;
  expiresAt?: string;
}) {
  return readJson<{ success: boolean; id: string; label: string }>("/api/v1/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
export async function fetchEncryptedCredential(id: string) {
  const payload = await readJson<{ credential?: StoredCredential }>(
    `/api/v1/credentials/${encodeURIComponent(id)}`,
  );
  if (!payload.credential)
    throw new TrustApiError("That credential is no longer available.", "error", 404);
  return payload.credential;
}
// ── One-time cards + purchase protection ─────────────────────────────────
export type CardStatus = "active" | "used" | "expired" | "frozen" | "cancelled";
export type VirtualCard = {
  id: string;
  last4: string;
  brand?: string;
  status: CardStatus | string;
  spendLimitMinor: number;
  currency: string;
  merchantLock?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
};
export type ProtectionStatus = "eligible" | "claimed" | "approved" | "denied" | "expired";
export type PurchaseProtection = {
  id: string;
  cardId?: string;
  orderRef: string;
  amountMinor: number;
  currency?: string;
  reason: string;
  status: ProtectionStatus | string;
  evidence?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
};
export async function fetchCards() {
  const payload = await readJson<{ cards?: VirtualCard[] }>("/api/v1/cards");
  return { cards: Array.isArray(payload.cards) ? payload.cards : [] };
}
export async function createCard(input: {
  spendLimitMinor: number;
  currency?: string;
  merchantLock?: string;
  expiresInHours?: number;
}) {
  return postJson<{ success: boolean; card?: VirtualCard }>("/api/v1/cards", input);
}
export async function freezeCard(id: string) {
  return postJson<{ success: boolean }>(`/api/v1/cards/${encodeURIComponent(id)}/freeze`);
}
export async function cancelCard(id: string) {
  return readJson<{ success: boolean }>(`/api/v1/cards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
export async function fetchProtectionClaims() {
  const payload = await readJson<{ claims?: PurchaseProtection[] }>("/api/v1/protections");
  return { claims: Array.isArray(payload.claims) ? payload.claims : [] };
}
export async function fileProtectionClaim(input: {
  cardId: string;
  orderRef: string;
  amountMinor: number;
  currency?: string;
  reason: string;
  evidence?: string;
}) {
  return postJson<{ success: boolean; id: string; status: string }>("/api/v1/protections", input);
}

// ── Secure execution sessions ────────────────────────────────────────────
export type SessionStatus =
  | "pending"
  | "starting"
  | "ready"
  | "busy"
  | "stopping"
  | "stopped"
  | "error"
  | "provider_required";
export type ActionType =
  "navigate" | "click" | "type" | "screenshot" | "extract" | "scroll" | "wait" | "evaluate";
export type ActionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ExecutionSession = {
  id: string;
  status: SessionStatus | string;
  createdAt?: string;
  expiresAt?: string | null;
  lastActionAt?: string | null;
  providerRef?: string | null;
  metadata?: Record<string, unknown> | null;
};
export type ExecutionAction = {
  id: string;
  sessionId?: string;
  type: ActionType | string;
  status: ActionStatus | string;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  createdAt?: string;
  completedAt?: string | null;
};
export async function fetchExecutionSessions() {
  const payload = await readJson<{ sessions?: ExecutionSession[] }>("/api/v1/execution/sessions");
  return { sessions: Array.isArray(payload.sessions) ? payload.sessions : [] };
}
export async function createExecutionSession(
  input: { ttlMinutes?: number; metadata?: Record<string, unknown> } = {},
) {
  const payload = await postJson<{ success: boolean; session?: ExecutionSession }>(
    "/api/v1/execution/sessions",
    input,
  );
  if (!payload.session)
    throw new TrustApiError("Kurukoo could not start a secure session.", "error", 0);
  return payload.session;
}
export async function fetchExecutionActions(sessionId: string) {
  const payload = await readJson<{ actions?: ExecutionAction[] }>(
    `/api/v1/execution/sessions/${encodeURIComponent(sessionId)}/actions`,
  );
  return { actions: Array.isArray(payload.actions) ? payload.actions : [] };
}
export async function queueExecutionAction(
  sessionId: string,
  type: ActionType,
  payload: Record<string, unknown> = {},
) {
  return postJson<{ success: boolean; id: string; status: ActionStatus | string }>(
    `/api/v1/execution/sessions/${encodeURIComponent(sessionId)}/actions`,
    { type, payload },
  );
}
export async function stopExecutionSession(id: string) {
  return readJson<{ success: boolean }>(`/api/v1/execution/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
export async function markCredentialUsed(id: string) {
  return postJson<{ success: boolean }>(`/api/v1/credentials/${encodeURIComponent(id)}/use`);
}
// ── Execution audit timeline ─────────────────────────────────────────────
/** Entries come from the backend executionAuditService, which reads the existing canonical event
 * stores. `occurredAt` is the recorded time and `status` is the recorded state — never invented. */
export type AuditEntryKind = "intent" | "request" | "goal" | "action" | "outcome" | "evidence";
export type AuditEntry = {
  id: string;
  kind?: AuditEntryKind | string;
  title?: string;
  description?: string | null;
  status?: string;
  occurredAt?: string;
  actor?: string | null;
  ref?: string | null;
  requestId?: string | null;
  summary?: string;
  action?: string;
  type?: string;
  createdAt?: string;
  timestamp?: string;
  evidence?: Record<string, unknown> | null;
};
export type AuditTimeline = { generatedAt?: string; entries: AuditEntry[]; total: number };
export async function fetchAuditTimeline(limit = 50) {
  const payload = await readJson<{ success: boolean; timeline?: Partial<AuditTimeline> }>(
    `/api/v1/audit?limit=${Math.min(200, Math.max(1, Math.trunc(limit)))}`,
  );
  const timeline = payload.timeline ?? {};
  const entries = Array.isArray(timeline.entries) ? timeline.entries : [];
  return {
    generatedAt: timeline.generatedAt,
    entries,
    total: typeof timeline.total === "number" ? timeline.total : entries.length,
  } as AuditTimeline;
}
/** Downloads the backend's own audit export as a JSON file. */
export async function exportTrustAudit(): Promise<Blob> {
  const response = await fetch(apiUrl("/api/v1/audit/export"), { credentials: "include" });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new TrustApiError(
      messageFrom(payload, response.status, "Audit export failed"),
      response.status === 401 || response.status === 403 ? "unavailable" : "error",
      response.status,
    );
  const exported =
    payload && typeof payload === "object" && "export" in payload
      ? (payload as { export?: unknown }).export
      : payload;
  return new Blob([JSON.stringify(exported ?? {}, null, 2)], { type: "application/json" });
}

// ── Composite overview (Trust page + continuity rail) ────────────────────
export type TrustResource = "credentials" | "cards" | "sessions" | "protections" | "audit";
export type TrustResourceState = { state: "available" | "unavailable" | "error"; message: string };

function resourceState(result: PromiseSettledResult<unknown>): TrustResourceState {
  if (result.status === "fulfilled") return { state: "available", message: "" };
  const cause = result.reason;
  if (cause instanceof TrustApiError && cause.state === "unavailable")
    return { state: "unavailable", message: cause.message };
  return {
    state: "error",
    message:
      cause instanceof Error && cause.message
        ? cause.message
        : "Kurukoo could not read this control.",
  };
}

export async function fetchTrustOverview() {
  const [credentials, cards, sessions, protections, audit] = await Promise.allSettled([
    fetchCredentials(),
    fetchCards(),
    fetchExecutionSessions(),
    fetchProtectionClaims(),
    fetchAuditTimeline(50),
  ]);
  return {
    credentials:
      credentials.status === "fulfilled"
        ? credentials.value
        : { credentials: [] as Credential[], count: 0 },
    cards: cards.status === "fulfilled" ? cards.value : { cards: [] as VirtualCard[] },
    sessions:
      sessions.status === "fulfilled" ? sessions.value : { sessions: [] as ExecutionSession[] },
    protections:
      protections.status === "fulfilled"
        ? protections.value
        : { claims: [] as PurchaseProtection[] },
    audit: audit.status === "fulfilled" ? audit.value : { entries: [] as AuditEntry[], total: 0 },
    availability: {
      credentials: resourceState(credentials),
      cards: resourceState(cards),
      sessions: resourceState(sessions),
      protections: resourceState(protections),
      audit: resourceState(audit),
    } as Record<TrustResource, TrustResourceState>,
  };
}
export async function deleteCredential(id: string) {
  return readJson<{ success: boolean }>(`/api/v1/credentials/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
