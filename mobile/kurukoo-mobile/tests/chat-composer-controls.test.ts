import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Chat composer control contract", () => {
  const mobile = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const desktop = readFileSync(resolve(process.cwd(), "../kurukoo-website/client/src/App.tsx"), "utf8");
  const desktopCss = readFileSync(resolve(process.cwd(), "../kurukoo-website/client/src/index.css"), "utf8");

  it("keeps every mobile composer control connected to an action", () => {
    expect(mobile).toContain('accessibilityLabel="Show conversation context"');
    expect(mobile).toContain('onPress={() => setShowContext(true)}');
    expect(mobile).toContain('accessibilityLabel="Clear draft"');
    expect(mobile).toContain('onPress={() => setDraft("")}');
    expect(mobile).toContain('onSubmitEditing={() => void ask()}');
    expect(mobile).toContain('sending ? stopGenerating() : void ask()');
  });

  it("keeps desktop composer controls connected and explainable", () => {
    expect(desktop).toContain('className="chat-composer"');
    expect(desktop).toContain('data-tooltip="Show preserved context"');
    expect(desktop).toContain('data-tooltip="Clear this draft"');
    expect(desktop).toContain('data-tooltip={sending ? "Stop generating" : "Ask Kurukoo"}');
    expect(desktop).toContain('onClick={() => setMessage("")}');
    expect(desktopCss).toContain('.composer-tool[data-tooltip]::after');
    expect(desktopCss).toContain('.chat-ask-button[data-tooltip]::after');
  });

  it("preserves truthful disabled behavior for unsent or unavailable actions", () => {
    expect(mobile).toContain('disabled={!sending && !draft.trim()}');
    expect(desktop).toContain('disabled={(!message.trim() && !sending) || contextState.status !== "ready"}');
  });
});
