import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import type { DiscoverAction, DiscoverItemType } from "@/lib/discover-contract";
import { MOBILE_PLATFORM_CONTRACTS } from "@/lib/platform-contract";

function endpoint(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await Auth.getSessionToken();
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload?.error === "string" ? payload.error : `Kurukoo request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

export type DiscoverItem = {
  id: string;
  type: DiscoverItemType;
  title: string;
  detail: string;
  verified?: boolean;
  available?: boolean;
  distanceMetres?: number;
  lifecycle?: string;
  sponsored?: boolean;
  disclosure?: string;
  ctaText?: string;
  actions?: DiscoverAction[];
  chatAction?: { id?: string; prompt?: string };
};

export type DiscoverHome = {
  generatedAt: string;
  sections: Record<string, DiscoverItem[]>;
  sparse: boolean;
  density: "rich" | "sparse" | "empty";
  explanation: string;
  watchedItemIds: string[];
};

export async function getDiscoverHome(input: { latitude: number; longitude: number; radiusMetres?: number; conversationId?: string }): Promise<DiscoverHome> {
  const query = new URLSearchParams({ lat: String(input.latitude), lng: String(input.longitude), radius: String(input.radiusMetres ?? 10000) });
  if (input.conversationId) query.set("conversationId", input.conversationId);
  const response = await fetch(endpoint(`/api/discover/home?${query.toString()}`), { credentials: "include", headers: await headers() });
  return json<DiscoverHome>(response);
}

export async function setDiscoverAction(itemType: DiscoverItemType, itemId: string, action: Extract<DiscoverAction, "watch" | "follow" | "save">): Promise<void> {
  const response = await fetch(endpoint(`/api/discover/items/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}/actions`), {
    method: "POST",
    credentials: "include",
    headers: await headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action }),
  });
  await json(response);
}

export async function removeDiscoverAction(itemType: DiscoverItemType, itemId: string, action: Extract<DiscoverAction, "watch" | "follow" | "save">): Promise<void> {
  const response = await fetch(endpoint(`/api/discover/items/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(action)}`), {
    method: "DELETE",
    credentials: "include",
    headers: await headers(),
  });
  await json(response);
}

export type MobileSurfaceReadiness = {
  id: string;
  status: string;
  route: string | null;
  canonicalOwner: string;
};

export function getMobileSurfaceFramework(): MobileSurfaceReadiness[] {
  return MOBILE_PLATFORM_CONTRACTS.map((contract) => ({ id: contract.id, status: contract.status, route: contract.nativeRoute, canonicalOwner: contract.canonicalOwner }));
}
