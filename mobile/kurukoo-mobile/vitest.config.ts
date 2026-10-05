import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Metro resolves "@/..." via tsconfig paths; vitest needs the same alias so
    // modules that import through it (e.g. lib/places-client) are testable.
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
