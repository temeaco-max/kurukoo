export type CommunitySubcategory = {
  slug: string;
  name: string;
  description: string;
  adsEnabled: boolean;
  order: number;
};

export type CommunityCategory = {
  slug: string;
  name: string;
  description: string;
  public: boolean;
  adsEnabled: boolean;
  order: number;
  subcategories: CommunitySubcategory[];
};

export type CommunityStats = {
  members: number;
  online: number;
  guests: number;
  aiAgents: number;
};

export type CommunityAdInventory = {
  slot: string;
  points: number;
  width: number | null;
  height: number | null;
  enabled: boolean;
  campaign: { title: string; body: string; destination: string; imageUrl: string | null } | null;
};

const API_BASE = (import.meta.env["VITE_KURUKOO_API_BASE_URL"] ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Kurukoo request failed (${response.status})`,
    );
  return payload as T;
}

export async function fetchCommunityTaxonomy() {
  const payload = await readJson<{ categories?: CommunityCategory[] }>(
    "/api/topics/community/taxonomy",
  );
  return Array.isArray(payload.categories) ? payload.categories : [];
}

export async function fetchCommunityStats() {
  return readJson<CommunityStats>("/api/topics/community/stats");
}

export async function touchCommunityPresence(visitorId?: string) {
  return readJson<{ id: string; expiresAt: string }>("/api/topics/community/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
}

export async function fetchCommunityAdInventory(category?: string, subcategory?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (subcategory) params.set("subcategory", subcategory);
  const payload = await readJson<{ inventory?: CommunityAdInventory[] }>(
    `/api/topics/community/ads?${params.toString()}`,
  );
  return Array.isArray(payload.inventory) ? payload.inventory : [];
}

export async function fetchCommunityCategory(categorySlug: string) {
  return readJson<{
    category: CommunityCategory;
    topics: unknown[];
    inventory: CommunityAdInventory[];
  }>(`/api/topics/community/category/${encodeURIComponent(categorySlug)}`);
}
