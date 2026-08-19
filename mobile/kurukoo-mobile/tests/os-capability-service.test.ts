import { describe, expect, it } from "vitest";

import { getCapabilityPortfolio } from "../server/_core/osCapabilityService";

describe("OS capability service", () => {
  it("returns the shared capability vocabulary with explicit voice and storage boundaries", async () => {
    const portfolio = await getCapabilityPortfolio(1);
    expect(portfolio.source).toBe("canonical-capability-service");
    expect(portfolio.skills.length).toBeGreaterThan(0);
    expect(portfolio.opportunities.some((item) => item.state === "Opportunity")).toBe(true);
    expect(portfolio.voice.reviewBeforeSend).toBe(true);
    expect(portfolio.storage.provider).toBe("Kurukoo-managed fallback");
  });
});
