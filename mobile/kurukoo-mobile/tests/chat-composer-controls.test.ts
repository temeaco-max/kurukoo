import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Chat composer control contract", () => {
  const mobile = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const webRoot = resolve(process.cwd(), "../..");
  const webApp = readFileSync(resolve(webRoot, "views/app.ejs"), "utf8");
  const foundation = readFileSync(resolve(webRoot, "public/css/kurukoo-client-foundation.css"), "utf8");

  it("keeps every mobile composer control connected to an action", () => {
    expect(mobile).toContain('accessibilityLabel="Show conversation context"');
    expect(mobile).toContain('onPress={() => setShowContext(true)}');
    expect(mobile).toContain('accessibilityLabel="Clear draft"');
    expect(mobile).toContain('onPress={() => setDraft("")}');
    expect(mobile).toContain('onSubmitEditing={() => void ask()}');
    expect(mobile).toContain('sending ? stopGenerating() : void ask()');
  });

  it("keeps the canonical Web App represented without referencing the removed duplicate website", () => {
    expect(webApp).toContain('href="/chat"');
    expect(webApp).toContain('href="/app/requests"');
    expect(webApp).toContain('href="/app/tasks"');
    expect(webApp).toContain('href="/app/connect"');
    expect(foundation).toContain('.k-mobile-tabbar');
    expect(foundation).toContain('--k-primary');
  });

  it("preserves truthful disabled behavior for unsent or unavailable actions", () => {
    expect(mobile).toContain('disabled={!sending && !draft.trim()}');
    expect(mobile).toContain('sending ? stopGenerating() : void ask()');
  });
});
