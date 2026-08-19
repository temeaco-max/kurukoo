import { describe, expect, it } from "vitest";

import { discoveries, notifications, requests, tasks } from "../lib/kurukoo-data";

describe("Kurukoo native journey fixtures", () => {
  it("keeps requests and tasks in canonical state vocabulary", () => {
    expect(requests.map((item) => item.state)).toEqual(["Working", "Waiting for you", "Complete"]);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((item) => item.detail.length > 0)).toBe(true);
  });

  it("keeps discovery entities distinct from verified providers", () => {
    expect(discoveries.every((item) => item.detail.includes("Discovery entity") || item.detail.includes("Opportunity surface"))).toBe(true);
    expect(discoveries.some((item) => item.detail.includes("availability unconfirmed"))).toBe(true);
  });

  it("keeps notifications actionable without claiming external delivery", () => {
    expect(notifications).toHaveLength(2);
    expect(notifications.some((item) => item.detail.includes("conversation"))).toBe(true);
    expect(notifications.every((item) => item.title.length > 0 && item.detail.length > 0)).toBe(true);
  });
});
