import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("../lib/_core/auth", () => ({ getSessionToken: async () => "+2348000000000" }));
vi.mock("../constants/oauth", () => ({ getApiBaseUrl: () => "https://api.kurukoo.test" }));

async function loadClient() {
  return import("../lib/places-client");
}

describe("places client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a place detail from the canonical API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "p1",
        slug: "garki-abuja",
        name: "Garki",
        state: "FCT",
        lga: "Abuja Municipal",
        status: "observed",
        concepts: [],
        disclaimers: { scenarios: "s", votes: "v", land: "l" },
      }),
    });
    const { fetchPlaceDetail } = await loadClient();
    const place = await fetchPlaceDetail("garki-abuja");
    expect(place.slug).toBe("garki-abuja");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.kurukoo.test/api/places/garki-abuja",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends an authenticated vote with the declared role", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", votes: { support: 1, oppose: 0, byRole: { interested: 1 } } }),
    });
    const { voteForPlaceConcept } = await loadClient();
    await voteForPlaceConcept("c1", -1, "lives_here");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer +2348000000000");
    expect(JSON.parse(init.body)).toEqual({ value: -1, role: "lives_here" });
  });

  it("surfaces server errors instead of inventing a place", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "Place not found" }) });
    const { fetchPlaceDetail } = await loadClient();
    await expect(fetchPlaceDetail("nope")).rejects.toThrow("Place not found");
  });

  it("follows a place through the canonical relationship boundary", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ relationship: { id: "r1" } }) });
    const { followPlace } = await loadClient();
    await followPlace("p1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kurukoo.test/api/relationships");
    expect(JSON.parse(init.body)).toEqual({ targetType: "place", targetId: "p1", relationshipType: "follow" });
  });
});
