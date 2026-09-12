export type PresenceParticipantKind = "human" | "provider" | "agent" | string;

export type PresenceContact = {
  identityId: string;
  displayName: string;
  participantKind: PresenceParticipantKind;
  presence: "available" | "offline" | "unknown" | string;
  provider?: { verified: boolean; type?: string; available?: boolean } | null;
  communication?: unknown;
};

export type PresenceOverview = {
  success?: boolean;
  self?: { pulseActive: boolean };
  counts: {
    contacts: number;
    human: number;
    providers: number;
    agents: number;
    available: number;
    offline: number;
    unknown: number;
    livePulseProviders: number;
  };
  contacts: PresenceContact[];
  privacy?: {
    relationshipScoped: boolean;
    exactLocationExposed: boolean;
    phoneIdentifiersExposed: boolean;
    publicPulseProviderIdentitiesExposed: boolean;
  };
};

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : `Kurukoo request failed (${response.status})`);
  }
  return payload as T;
}

export async function fetchPresenceOverview() {
  return readJson<PresenceOverview>("/api/presence/overview");
}
