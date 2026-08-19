import { describe, expect, it } from "vitest";

import { buildTaskNotificationData, notificationReadinessLabel, parseTaskNotificationData } from "../lib/notification-contract";

describe("Kurukoo local notification boundaries", () => {
  it("encodes exact task identity and an allowlisted Chat route", () => {
    expect(buildTaskNotificationData({ id: "task-offer", title: "Compare grocery basket" })).toEqual({
      kind: "task-continuation",
      taskId: "task-offer",
      taskTitle: "Compare grocery basket",
      url: "/(tabs)",
    });
  });

  it("describes each readiness state without claiming remote delivery", () => {
    expect(notificationReadinessLabel("web-unavailable")).toContain("unavailable");
    expect(notificationReadinessLabel("permission-required")).toContain("not granted");
    expect(notificationReadinessLabel("project-id-required")).toContain("required");
    expect(notificationReadinessLabel("physical-device-required")).toContain("physical device");
    expect(notificationReadinessLabel("token-ready")).toContain("delivery is not claimed");
  });

  it("parses only the known task continuation shape", () => {
    expect(parseTaskNotificationData({ kind: "task-continuation", taskId: "task-match", taskTitle: "Repair", url: "/(tabs)" })).toEqual({
      kind: "task-continuation",
      taskId: "task-match",
      taskTitle: "Repair",
      url: "/(tabs)",
    });
    expect(parseTaskNotificationData({ kind: "task-continuation", taskId: "task-match", taskTitle: "Repair", url: "https://unsafe.example" })).toBeNull();
    expect(parseTaskNotificationData(null)).toBeNull();
  });
});
