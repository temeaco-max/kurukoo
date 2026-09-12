import type { Integration } from "./integration-catalog";

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(typeof payload?.error === "string" ? payload.error : `Integration request failed (${response.status})`);
  return payload as T;
}

export type IntegrationConnectionState = { configured?: boolean; enabled?: boolean; connected?: boolean; status?: string; reason?: string; featureFlagState?: string };

export async function getIntegrationStatus(integration: Integration): Promise<IntegrationConnectionState> {
  if (!integration.endpoint) return { configured: false, enabled: false };
  const readPath = integration.slug === "google-drive" ? "/api/artifacts" : integration.slug === "google-sheets" ? "/api/artifacts/sheets" : integration.slug === "notion" ? "/api/artifacts/notion" : integration.slug === "onedrive" ? "/api/artifacts/microsoft/onedrive" : integration.slug === "outlook" ? "/api/artifacts/microsoft/outlook" : integration.endpoint.path.replace(/\/connect$/, "");
  const payload = await request<Record<string, unknown>>(readPath);
  const source = (payload.source ?? payload.storage ?? payload) as Record<string, unknown>;
  const sourceStatus = typeof source.status === "string" ? source.status : undefined;
  return { configured: Boolean(source.configured), enabled: source.enabled === undefined ? true : Boolean(source.enabled), connected: Boolean(source.connected ?? (sourceStatus === "connected" || sourceStatus === "active")), status: sourceStatus, reason: typeof source.reason === "string" ? source.reason : undefined, featureFlagState: typeof source.featureFlagState === "string" ? source.featureFlagState : undefined };
}

export async function startIntegrationConnection(integration: Integration) {
  if (!integration.endpoint) throw new Error("This integration does not expose an external authorization flow yet.");
  return request<{ authorizationUrl?: string; connected?: boolean }>(integration.endpoint.path, { method: integration.endpoint.method, headers: { "Content-Type": "application/json" }, body: integration.endpoint.method === "POST" ? "{}" : undefined });
}

export async function revokeIntegrationConnection(integration: Integration) {
  const revokePath = integration.slug === "google-drive" ? "/api/artifacts/drive/revoke" : integration.slug === "google-sheets" ? "/api/artifacts/sheets/revoke" : integration.slug === "notion" ? "/api/artifacts/notion/revoke" : integration.slug === "onedrive" ? "/api/artifacts/microsoft/onedrive/revoke" : integration.slug === "outlook" ? "/api/artifacts/microsoft/outlook/revoke" : null;
  if (!revokePath) throw new Error("This integration cannot be disconnected from this surface yet.");
  return request<{ revoked?: boolean }>(revokePath, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
