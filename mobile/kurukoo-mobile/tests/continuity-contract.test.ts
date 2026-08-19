import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

describe("Trust and Continuity visual contract", () => {
  const uiSource = readFileSync(resolve(process.cwd(), "components/kurukoo-ui.tsx"), "utf8");
  const tasksSource = readFileSync(resolve(process.cwd(), "app/(tabs)/tasks.tsx"), "utf8");
  const notificationsSource = readFileSync(resolve(process.cwd(), "app/surface/notifications.tsx"), "utf8");
  const surfaceSource = readFileSync(resolve(process.cwd(), "components/surface-detail.tsx"), "utf8");

  it("owns one reusable continuity band", () => {
    expect(uiSource).toContain("export function ContinuityBand");
    expect(uiSource).toContain("Context continuity");
    expect(uiSource).toContain('label="Preserved"');
  });

  it("keeps task context exact when returning to Chat", () => {
    expect(tasksSource).toContain("<ContinuityBand");
    expect(tasksSource).toContain("contextId={state.activeContext.id}");
    expect(tasksSource).toContain("Open active context");
  });

  it("keeps notification context explicit and fail-safe", () => {
    expect(notificationsSource).toContain("<ContinuityBand");
    expect(notificationsSource).toContain('contextId="notifications"');
    expect(notificationsSource).toContain("does not claim external delivery");
  });

  it("keeps shared surfaces linked to canonical Chat", () => {
    expect(surfaceSource).toContain("<ContinuityBand");
    expect(surfaceSource).toContain("contextId={kind}");
    expect(surfaceSource).toContain("Internal acceptance never implies external payment");
  });

  it("keeps channel pairing fail-safe", () => {
    expect(surfaceSource).toContain("function ConnectView");
    expect(surfaceSource).toContain("Pairing stays truthful");
    expect(surfaceSource).toContain("A provider channel is only shown as linked after the server accepts the pairing");
    expect(surfaceSource).toContain("Create QR pairing");
    expect(surfaceSource).toContain("Confirm link");
  });
});
