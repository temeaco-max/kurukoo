import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const radarSource = readFileSync(resolve(process.cwd(), "app/(tabs)/discover.tsx"), "utf8");

describe("experience feedback contract", () => {
  it("keeps Chat loading and empty states inside the canonical composer surface", () => {
    expect(chatSource).toContain('"loading" | "ready" | "empty"');
    expect(chatSource).toContain("Preparing your conversation");
    expect(chatSource).toContain("No conversation to show yet");
    expect(chatSource).toContain("Ask Kurukoo");
    expect(chatSource).toContain("Kurukoo is typing");
    expect(chatSource).toContain("Read by Kurukoo");
  });

  it("keeps Nearby Radar loading and empty states source-truthful", () => {
    expect(radarSource).toContain('"loading" | "ready" | "empty"');
    expect(radarSource).toContain("Refreshing Nearby Radar");
    expect(radarSource).toContain("No source-attributed results here yet");
    expect(radarSource).toContain("has not substituted an unverified provider");
    expect(radarSource).toContain("RefreshControl");
    expect(radarSource).toContain("refreshRadar");
    expect(radarSource).toContain("Updating source-attributed results");
  });
});
