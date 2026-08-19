import { describe, expect, it } from "vitest";

import { contextReducer } from "../lib/kurukoo-context";

describe("Kurukoo canonical mobile context", () => {
  const initial = { pausedTaskIds: [] as string[], activeContext: null, hydrated: true };

  it("preserves the exact task identity when Chat is opened from Tasks", () => {
    const state = contextReducer(initial, {
      type: "set-active",
      context: { kind: "task", id: "task-offer", title: "Compare grocery basket" },
    });

    expect(state.activeContext).toEqual({ kind: "task", id: "task-offer", title: "Compare grocery basket" });
  });

  it("toggles only the requested task without changing the active context", () => {
    const withContext = contextReducer(initial, {
      type: "set-active",
      context: { kind: "task", id: "task-match", title: "Find a reliable phone repairer" },
    });
    const paused = contextReducer(withContext, { type: "toggle-paused", taskId: "task-offer" });

    expect(paused.pausedTaskIds).toEqual(["task-offer"]);
    expect(paused.activeContext?.id).toBe("task-match");
  });

  it("fails closed to empty context when persisted data is malformed", () => {
    const hydrated = contextReducer(initial, { type: "hydrate", state: { pausedTaskIds: [], activeContext: null } });
    expect(hydrated.activeContext).toBeNull();
    expect(hydrated.pausedTaskIds).toEqual([]);
    expect(hydrated.hydrated).toBe(true);
  });
});
