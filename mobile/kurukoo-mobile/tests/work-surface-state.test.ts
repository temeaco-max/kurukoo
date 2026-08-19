import { describe, expect, it } from "vitest";

import { parsePausedWorkItems, parseReminderDrafts, serializePausedWorkItems, serializeReminderDrafts, validateReminderDraft } from "../lib/work-surface-state";

describe("work-surface local state", () => {
  it("round-trips unique paused work items", () => {
    const raw = serializePausedWorkItems(["Team sync", "Team sync", "Follow up with repairer"]);
    expect(parsePausedWorkItems(raw)).toEqual(["Team sync", "Follow up with repairer"]);
  });

  it("fails closed for malformed or non-array state", () => {
    expect(parsePausedWorkItems("not-json")).toEqual([]);
    expect(parsePausedWorkItems(JSON.stringify({ paused: ["x"] }))).toEqual([]);
    expect(parsePausedWorkItems(JSON.stringify(["valid", 3, null, ""]))).toEqual(["valid"]);
  });

  it("round-trips reminder drafts and fails closed for malformed dates", () => {
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const raw = serializeReminderDrafts({ "Team sync": { title: "Team sync", detail: "Bring the notes back into Chat.", time: "09:00", date } });
    expect(parseReminderDrafts(raw)["Team sync"]).toEqual({ title: "Team sync", detail: "Bring the notes back into Chat.", time: "09:00", date });
    expect(parseReminderDrafts(JSON.stringify({ broken: { title: "x", detail: "y", time: "09:00" } }))).toEqual({});
  });

  it("validates reminder content and 24-hour time locally", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(validateReminderDraft({ title: "Team sync", detail: "Bring the notes back into Chat.", time: "09:00", date: futureDate })).toBeNull();
    expect(validateReminderDraft({ title: "No", detail: "Bring the notes back into Chat.", time: "09:00", date: futureDate })).toContain("3 characters");
    expect(validateReminderDraft({ title: "Team sync", detail: "Bring the notes back into Chat.", time: "25:00", date: futureDate })).toContain("24-hour");
    expect(validateReminderDraft({ title: "Team sync", detail: "Bring the notes back into Chat.", time: "09:00", date: "not-a-date" })).toContain("valid reminder date");
  });
});
