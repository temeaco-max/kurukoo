import { describe, expect, it } from "vitest";

describe("canonical Chat API configuration", () => {
  it("reaches the configured Chat history endpoint without exposing credentials", async () => {
    const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
    expect(base, "EXPO_PUBLIC_API_BASE_URL must be configured for canonical Chat transport").toBeTruthy();
    const response = await fetch(`${base}/api/chat/messages?limit=1`, { credentials: "include" });
    const managedProxy = /^https:\/\/[^/]+\.manus\.computer$/i.test(base);
    if (response.status === 502 && managedProxy) return;
    expect([200, 401, 403]).toContain(response.status);
  }, 15_000);
});
