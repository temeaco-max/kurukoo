import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const radarSource = readFileSync(resolve(process.cwd(), "app/(tabs)/discover.tsx"), "utf8");

describe("experience feedback contract", () => {
  it("keeps Chat loading and empty states inside the clean canonical Agent surface", () => {
    expect(chatSource).toContain('"loading" | "ready" | "empty"');
    expect(chatSource).toContain("Preparing your conversation");
    expect(chatSource).toContain("Let’s get something moving");
    expect(chatSource).toContain("Welcome back");
    expect(chatSource).toContain("Ask anything:");
    expect(chatSource).toContain("Ask Kurukoo");
    expect(chatSource).toContain("Kurukoo is typing");
    expect(chatSource).toContain("Read by Kurukoo");
  });

  it("keeps Nearby Radar loading and empty states source-truthful", () => {
    expect(radarSource).toContain('const [loading, setLoading] = useState(true);');
    expect(radarSource).toContain("Preparing Discover");
    expect(radarSource).toContain("Nothing attributed here yet.");
    expect(radarSource).toContain("Discovery cards are contextual candidates.");
    expect(radarSource).toContain("RefreshControl");
    expect(radarSource).toContain("const refresh =");
    expect(radarSource).toContain("No local availability is implied until the feed confirms it.");
  });
});
