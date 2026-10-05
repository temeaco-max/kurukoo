import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

export type PlaceVoteSummary = { support: number; oppose: number; byRole: Record<string, number> };
export type PlaceConcept = {
  id: string;
  title: string;
  description: string;
  scenario: string;
  version: number;
  status: string;
  sponsored: boolean;
  sponsorLabel: string | null;
  economicRequestId: string | null;
  votes: PlaceVoteSummary;
};
export type PlaceDetail = {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  lga: string | null;
  status: string;
  concepts: PlaceConcept[];
  disclaimers: { scenarios: string; votes: string; land: string };
};

function endpoint(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

async function requestHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await Auth.getSessionToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload?.error === "string" ? payload.error : `Places request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

export async function fetchPlaceDetail(slug: string): Promise<PlaceDetail> {
  const response = await fetch(endpoint(`/api/places/${encodeURIComponent(slug)}`), {
    credentials: "include",
    headers: await requestHeaders(),
  });
  const payload = await parseJsonResponse<PlaceDetail>(response);
  if (!payload || !payload.slug) throw new Error("Place not found");
  return payload;
}

export async function voteForPlaceConcept(conceptId: string, value: 1 | -1, role = "interested"): Promise<PlaceConcept> {
  const response = await fetch(endpoint(`/api/concepts/${encodeURIComponent(conceptId)}/vote`), {
    method: "POST",
    credentials: "include",
    headers: await requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ value, role }),
  });
  return parseJsonResponse<PlaceConcept>(response);
}

export async function followPlace(placeId: string): Promise<void> {
  const response = await fetch(endpoint("/api/relationships"), {
    method: "POST",
    credentials: "include",
    headers: await requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ targetType: "place", targetId: placeId, relationshipType: "follow" }),
  });
  await parseJsonResponse(response);
}
