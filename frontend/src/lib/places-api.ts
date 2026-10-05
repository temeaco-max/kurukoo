const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}
async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof (payload as { error?: unknown })?.error === "string"
        ? String((payload as { error?: unknown }).error)
        : `Kurukoo request failed (${response.status})`,
    );
  return payload as T;
}

export interface PlaceVoteSummary {
  support: number;
  oppose: number;
  byRole: Record<string, number>;
}
export interface PlaceConcept {
  id: string;
  placeId: string;
  title: string;
  description: string;
  scenario: string;
  parentConceptId: string | null;
  version: number;
  assets: Array<{ kind?: string; url?: string; illustrative?: boolean }>;
  feasibility: Record<string, unknown>;
  evidence: unknown[];
  sponsored: boolean;
  sponsorLabel: string | null;
  status: string;
  economicRequestId: string | null;
  votes: PlaceVoteSummary;
}
export interface PlaceImageryEpoch {
  epochLabel: string;
  capturedAt: string | null;
  source: string;
  url: string | null;
  note: string | null;
}
export interface PlaceNeed {
  category: string;
  current: string;
  gap: string;
  confidence: string;
  evidence: string;
}
export interface PlaceCreator {
  displayName: string;
  concepts: number;
  support: number;
  oppose: number;
  built: number;
}
export interface PlaceDetail {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  lga: string | null;
  centerLat: number;
  centerLng: number;
  status: string;
  reality: Record<string, unknown>;
  confidence: Record<string, string>;
  needs: PlaceNeed[];
  concepts: PlaceConcept[];
  creators: PlaceCreator[];
  imagery: PlaceImageryEpoch[];
  landRegistries: Array<{ name: string; coverage: string; status: string }>;
  disclaimers: { scenarios: string; votes: string; land: string };
}

export async function fetchPlaceDetail(slug: string) {
  const payload = await readJson<PlaceDetail>(`/api/places/${encodeURIComponent(slug)}`);
  if (!payload || !payload.slug) throw new Error("Place not found");
  return payload;
}
export async function voteForConcept(conceptId: string, value: 1 | -1, role: string) {
  return readJson<PlaceConcept>(`/api/concepts/${encodeURIComponent(conceptId)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, role }),
  });
}
export async function followPlace(placeId: string) {
  await readJson("/api/relationships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType: "place", targetId: placeId, relationshipType: "follow" }),
  });
}
export async function unfollowPlace(placeId: string) {
  await readJson(`/api/relationships/place/${encodeURIComponent(placeId)}`, { method: "DELETE" });
}
export async function fetchPlaceRelationship(placeId: string) {
  const payload = await readJson<{ relationship?: { status?: string } | null }>(
    `/api/relationships/place/${encodeURIComponent(placeId)}`,
  ).catch(() => ({ relationship: null }));
  return payload.relationship ?? null;
}
export function conceptVisionUrl(conceptId: string) {
  return apiUrl(`/api/concepts/${encodeURIComponent(conceptId)}/vision.svg`);
}
export interface PlacePromotion {
  title: string;
  image?: string;
  alt: string;
  destination: string;
  ctaText: string;
  disclosure: string;
}
export async function fetchPlacePromotions(slug: string) {
  const payload = await readJson<{ promotions?: PlacePromotion[] }>(
    `/api/places/${encodeURIComponent(slug)}/promotions`,
  );
  return Array.isArray(payload.promotions) ? payload.promotions : [];
}
export interface PlaceApproval {
  id: string;
  authority: string;
  status: string;
  note: string | null;
  createdAt: string;
}
export async function fetchPlaceApprovals(slug: string) {
  const payload = await readJson<{ approvals?: PlaceApproval[] }>(
    `/api/places/${encodeURIComponent(slug)}/approvals`,
  );
  return Array.isArray(payload.approvals) ? payload.approvals : [];
}
export interface PlacePoster {
  entryUrl: string;
  svg: string;
  description: string;
  expiresNote: string;
  shareText: string;
  whatsappShareUrl: string;
}
export async function fetchPlacePoster(slug: string) {
  return readJson<PlacePoster>(`/api/places/${encodeURIComponent(slug)}/poster`);
}
export interface NearbyPlace {
  slug: string;
  name: string;
  status: string;
  concepts: number;
  votes: number;
  distanceMetres: number;
}
export async function fetchNearbyPlaces(lat: number, lng: number, radiusMetres = 10000) {
  const payload = await readJson<{
    layers?: Record<string, Array<{ slug: string; name: string; status: string; concepts: number; votes: number; distanceMetres: number }>>;
  }>(`/api/places-radar?lat=${lat}&lng=${lng}&radiusMetres=${radiusMetres}`);
  const layers = payload.layers ?? {};
  return Object.values(layers)
    .flat()
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
    .slice(0, 6) as NearbyPlace[];
}
export async function refreshPlaceReality(slug: string) {
  return readJson<{
    slug: string;
    source: string;
    fetchedAt: string;
    counts: Record<string, number>;
    needs: PlaceNeed[];
  }>(`/api/places/${encodeURIComponent(slug)}/refresh-reality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}
