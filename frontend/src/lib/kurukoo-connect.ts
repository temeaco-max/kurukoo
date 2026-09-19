const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Connection request failed (${response.status})`,
    );
  return payload as T;
}

export type ConnectResourceKind =
  | "phone"
  | "tv"
  | "cctv"
  | "camera"
  | "laptop"
  | "desktop"
  | "tablet"
  | "vehicle"
  | "iot"
  | "other";
export type ConnectionPairing = {
  challengeId: string;
  code: string;
  expiresAt: string;
  state: string;
};

export type RegisteredConnection = {
  resource: import("@/lib/kurukoo-api").ConnectedResource;
  pairing: ConnectionPairing;
};

export async function registerConnectedResource(input: {
  kind: ConnectResourceKind;
  label: string;
  vendor?: string | undefined;
  protocol?: string | undefined;
  capabilities?: string[] | undefined;
}) {
  return request<{
    success: boolean;
    resource: import("@/lib/kurukoo-api").ConnectedResource;
    pairing: ConnectionPairing;
  }>("/api/connect/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function issueConnectionChallenge(id: string) {
  const payload = await request<{ success: boolean; pairing: ConnectionPairing }>(
    `/api/connect/resources/${encodeURIComponent(id)}/challenge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  return payload.pairing;
}

export async function activateConnectedResource(id: string, code: string) {
  return request<{ success: boolean; resource?: import("@/lib/kurukoo-api").ConnectedResource }>(
    `/api/connect/resources/${encodeURIComponent(id)}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    },
  );
}
