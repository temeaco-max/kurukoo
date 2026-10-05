// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: true,
      proxy: {
        // Bridge the frontend's /backend/* calls to the canonical backend API.
        "/backend": {
          target: process.env["KURUKOO_BACKEND_URL"] || "http://127.0.0.1:3100",
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/backend/, ""),
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Static prerender list. Each entry renders at build time into
    // .output/public/<route>/index.html, which the Express static layer serves
    // ahead of the EJS routers — that ordering IS the SPA migration mechanism.
    // Rules: only list routes with no committed public/ file (the build errors
    // on collision) and no loader needing backend data at build time. Grow this
    // list route by route; each addition is proven by the built output below.
    pages: ["/", "/about", "/help", "/pricing", "/contact", "/careers", "/blog", "/api-docs", "/legal", "/how-it-works", "/partners", "/advertise", "/network", "/topics", "/login", "/features", "/developers", "/discover", "/places", "/auth/challenge/complete", "/whatsapp-linked-device", "/discover/community", "/discover/events", "/discover/food", "/discover/government", "/discover/groceries", "/discover/health", "/discover/home", "/discover/learning", "/discover/mobility", "/discover/money-circle", "/discover/prayer", "/discover/repairs", "/discover/safety", "/discover/selling", "/discover/work"].map((path) => ({ path, prerender: { enabled: true } })),
  },
});
