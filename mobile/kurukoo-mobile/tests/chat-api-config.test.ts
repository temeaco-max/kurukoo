import { describe, expect, it, vi } from "vitest";

describe("canonical Chat API configuration", () => {
  it("builds the canonical Chat history request without exposing credentials", async () => {
    const base = "https://kurukoo.example";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${base}/api/chat/messages?limit=1`);
      expect(init).toEqual({ credentials: "include" });
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetch(`${base}/api/chat/messages?limit=1`, { credentials: "include" });
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
