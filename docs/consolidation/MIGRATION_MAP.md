# Kurukoo Consolidation Migration Map

**Purpose:** prove nothing is lost while consolidating web/admin/mobile/PWA. This is the evidence chain required before any EJS/admin/legacy removal. Decisions follow `docs/architecture/REPOSITORY_BOUNDARIES.md`.

Legend: `SUPERSEDED` = equivalent exists in frontend repo · `KEEP` = backend-owned, no UI replacement · `MIGRATE` = needs a replacement built/moved · `INVESTIGATE` = consumer unknown.

## 1. Backend EJS routes (views/) → TanStack frontend

Backend renders pages via `src/routes/publicRoutes.ts`, `appSurfaceRoutes.ts`, `contentRoutes.ts`, `authChallengePublicRoutes.ts`. Static assets are already served from `frontend/public` (`src/index.ts` line 110).

| Backend route (EJS view) | Frontend equivalent | Status | Notes |
|---|---|---|---|
| `/` (`index.ejs`) | `/` (`routes/index.tsx`) | SUPERSEDED | SEO/ads data via `pageContentRoutes` API; backend route must serve SEO until cutover |
| `/explore`, `/explore/:slug` (`explore/`) | `/explore`, `routes/explore/` | SUPERSEDED | |
| `/p/:providerSlug` (`provider-profile.ejs`) | `routes/profile.$slug.tsx`, `routes/provider.tsx` | INVESTIGATE | verify slug schema parity (provider profile cards) |
| `/topics`, `/topics/:slug` (`topics/`) | `routes/topics*.tsx` | SUPERSEDED | recent commits already wired frontend topics incl. ads |
| `/login` (`login.ejs`) | `routes/login.tsx` | MIGRATE | magic-link/challenge flow must be fully consumed by TanStack login before retirement |
| `/resources`, `/resources/:slug` (`resources/`) | `routes/resources.tsx`, `resources.$slug.tsx` | SUPERSEDED | content via `/api/content/resources/:slug` |
| `/partners` | `routes/partners.tsx` | SUPERSEDED | |
| `/advertise` | `routes/advertise.tsx` | SUPERSEDED | |
| `/discover` (`discover.ejs`) | `routes/discover.tsx` | SUPERSEDED | |
| `/blog` (`blog.ejs`) | `routes/blog.tsx`, `blog.$slug.tsx`, `routes/blog/` | SUPERSEDED | |
| `/careers` | `routes/careers.tsx` | SUPERSEDED | |
| `/api-docs` (`api_docs.ejs`) | `routes/api-docs.tsx` | SUPERSEDED | |
| `/legal/:section?` (`legal.ejs`) | `routes/legal.tsx`, `legal.$section.tsx` | SUPERSEDED | |
| `/features` (`features.ejs`) | `routes/use-cases.tsx` / `routes/capabilities.tsx` | INVESTIGATE | confirm which frontend route carries the feature story |
| `/developers`, `/developers/api` (`developers.ejs`) | `routes/developer.tsx`, `routes/api-docs.tsx` | INVESTIGATE | |
| `/:country(ng|gh|gb)` (`index.ejs`) | frontend country context | INVESTIGATE | confirm frontend renders localized home per country |
| Authenticated `/desk`, `/workspace`, resource pages (`app.ejs` via `appSurfaceRoutes`) | `/chat`, `/work`, `/workspace`, `/perch`, `/artifacts`, `/connect` | SUPERSEDED | authenticated app.ejs shell is the old OS; frontend OS shell is canonical |
| `/chat/:conversationId`, `/share/:shareId` (redirects) | — | KEEP | pure redirects, not UI |
| `/referral-qr/` (`frontend/public/referral-qr/index.html`) | — | KEEP | static send-file |
| `/auth-challenge-complete` (`auth-challenge-complete.ejs`) | — | KEEP | magic-link completion surface; no frontend equivalent yet |
| `/whatsapp-linked-device` (`whatsapp-linked-device.ejs`) | — | KEEP | channel linking surface |
| `/robots.txt`, `/sitemap-topics.xml` | — | KEEP | SEO endpoints (backend-owned per boundaries) |
| Unrouted `views/` templates (`about.ejs`, `help.ejs`, `how-it-works.ejs`, `network.ejs`, `pricing.ejs`, `programmatic.ejs`, `channels.ejs`, `contact.ejs`, `settings.ejs`, `admin/login.ejs`, `views/explore/*` etc.) | corresponding TanStack routes exist for most (`about.tsx`, `help.tsx`, `how-it-works.tsx`, `network.tsx`, `pricing.tsx`, `contact.tsx`, `settings.tsx`) | MIGRATE/retire | confirm zero direct renders, then mark deprecated |

Verified render inventory (grep of `src/routes/*.ts`): only `index`, `explore/index`, `explore/category`, `provider-profile`, `features`, `developers`, `login`, `resources/index`, `resources/article`, `app`, `auth-challenge-complete`, `topics/index`, `topics/detail`, plus dynamic `renderPage(view)` usage in publicRoutes. All other `views/*.ejs` are currently unreferenced by routes.

## 2. Admin

| Piece | Location | Owner | Status |
|---|---|---|---|
| Admin API | `src/routes/adminRoutes.ts` + `adminPlatformRoutes`, `adminDisputeRoutes`, `adminFcmRoutes`, `adminClineRoutes`, `adminSurfaceRoutes`, `adminConfigRoutes`, `providerPayoutAdminRouter` | backend | KEEP (canonical) |
| Admin UI (23 pages) | `frontend/public/admin/*.html` + `admin-auth.js`, `admin-canonical-route.js`, `login.html/js` | frontend repo (privileged client) | KEEP for now; long-term migrate into TanStack `/admin` routes |
| `views/admin/login.ejs` | `views/admin/` | — | SUPERSEDED by `frontend/public/admin/login.html` (verify zero links, then retire) |

## 3. Mobile

| Piece | Location | Status |
|---|---|---|
| Expo/RN app (tabs: connect, discover, index, more, requests, tasks; surface: artifacts, capabilities, discovery, go-live, notifications, reminders, requests, [kind]) | `mobile/kurukoo-mobile/` | Canonical mobile app. iOS + Android are targets of this one app. |
| `android/` native wrapper | repo root | Native Android build target of the mobile app — keep, wire to Expo app output |
| Embedded tRPC scaffold server (`server/`, `drizzle/`, `sdk`) | `mobile/kurukoo-mobile/server/` | ISOLATE as demo/local scaffold. NOT a Kurukoo backend authority. No product logic added here; clients consume the canonical kurukoo API. |

## 4. PWA

| Piece | Location | Status |
|---|---|---|
| Service worker | `frontend/public/firebase-messaging-sw.js` | MIGRATE-into-frontend (already inside frontend/public) — PWA is a web capability, one product |
| Manifest / offline / push client | frontend + backend FCM | PWA = capability of the web frontend, not a separate app |

## 5. Already-landed consolidation (in git working tree)

- `public/` → `frontend/public/` (admin pages, brand assets, campaign images, referral-qr, api-docs) — staged renames, ~200 files.
- `src/index.ts` serves static from `frontend/public`.
- Build scripts (`copy-public.mjs`, Dockerfile, cloudbuild.yaml) verified free of stale `public/` references.

## Removal gate (apply to every EJS/legacy item)

```text
replacement exists? → replacement connected? → consumers migrated? → runtime verified? → remove
```

## 6. Verification record (Phase 3 landing, 2026-09-13)

Fixes applied to complete the in-flight `public/` → `frontend/public/` migration:

- `Dockerfile`: `COPY --from=build /app/public ./public` → `/app/frontend/public ./frontend/public` (build would otherwise fail; runtime serves `frontend/public`).
- `scripts/test-desk-visual-foundation.ts`: reads moved to `frontend/public/...`.
- `src/services/canonicalAuthenticatedScreenSetManifest.json`: 31 doc paths `public/...` → `frontend/public/...`.
- `scripts/test-canonical-authenticated-screen-set.mjs`: (a) fixed unescaped `/` inside the `frontend/public` regex (SyntaxError introduced by the path edit); (b) the chat-page path assertion now reads `src/routes/chatPageRoutes.ts` (the canonical owner of the chat page path) instead of `appSurfaceRoutes.ts`, which never contained it.

Runtime verification (dev server on :3101):

- `GET /` → 200 · `GET /chat` → 301 → `/chat/` → 200 · `GET /admin/login.html` → 200 · `GET /assets/brand/favicon.svg` → 200 · `GET /topics` → 200.
- Backend `tsc --noEmit` → clean.

**Pre-existing test failures (NOT caused by the migration — verified failing against HEAD; do not silently paper over):**

1. `scripts/test-canonical-authenticated-screen-set.mjs`: expects `k-app-surface` in `views/app.ejs` — absent at HEAD too (class removed/never added when the shell converged in commit 2620a0d0). Needs a product decision: restore the class or update the shell contract.
2. `scripts/test-desk-visual-foundation.ts`: expects `.k-desk-module-welcome` in `frontend/public/css/kurukoo-desk-system.css` — absent at HEAD's identical CSS. Needs the welcome module composition added or the assertion updated to the current module list.

Frontend `tsc --noEmit`: pending at time of writing (check `/tmp/fe-tsc.log`).

## 7. FastText boundary + Admin ownership corrections (Phase 3b, 2026-09-13)

### FastText repositioned to explicitly secondary (canonical path no longer FastText-first)

`src/services/aiRoutingConvergence.ts` — `classifyAiRoutingSignal()` corrected:

- Canonical order: conversation acts (rules) → skill catalogue. `classifyWithFastText()` now serves **only** as a downstream hint, reached when rules and catalogue both fail.
- Hint confidence is capped via `FASTTEXT_HINT_MAX_CONFIDENCE = 0.7`, deliberately below the 0.72 escalation threshold — a FastText-only hint can never satisfy the canonical path alone; it always escalates to the model path (`shouldEscalateToAi`).
- FastText infrastructure preserved (not deleted): it remains valuable for cheap hints/enrichment, offline evaluation/training (`scripts/evaluate-fasttext-heldout.ts`, `scripts/test-fasttext-quality.ts` — deterministic/skill cases still pass with `modelState=real`) and narrow specialist support. Consumers traced before the change: `aiInferencePolicy`, `unifiedAiEngine`, `legacyIntentRouter`, `fastTextService` (its own contract unchanged), `compoundObjectiveResolver`.
- Specialist catalogue disambiguation: `catalogueSkill()` now resolves explicit device subtypes (`laptop/macbook → laptop_repairer`, `tablet/ipad → tablet_repairer`) before base-skill alias iteration, so the base `phone_repairer` aliases (e.g. `'screen repair'`) no longer out-match specialists purely by catalogue iteration order. `src/services/compoundObjectiveResolver.ts::inferSkill` aligned to the same specialist map. `hotel_deals` local catalogue entry added (canonical `hotel_deals` skill from `skillFlows`) so accommodation requests resolve canonically.

Boundary guard: `scripts/test-ai-routing-convergence.ts` extended with regression assertions — FastText must never be the first-line classifier for a catalogue-solvable request; hint confidence can never exceed its cap; FastText-only hints must escalate. **Result: AI routing convergence passed 12 cases; FastText boundary guard passed (modelState=real, hintCap=0.7).**

### Admin repositioned out of the customer frontend

`frontend/public/admin/` → `admin/` (repo root) via `git mv` — single copy, no duplication:

- Admin is a privileged application surface, not customer web UI. UI pages live in `/admin` (repo root); the canonical Admin API remains at `/api/admin` in the backend — target ownership honoured: **Admin UI → canonical Admin API → Kurukoo backend**.
- `src/index.ts`: repo-root static serving corrected; `/admin` client surface now serves `/admin/...` from `/admin` (repo root), with a comment marking the ownership decision.
- `src/routes/publicRoutes.ts` and `src/routes/adminSurfaceRoutes.ts`: `public/admin` / `frontend/public/admin` reads corrected to `/admin` (repo root).
- `scripts/test-admin-routes.ts` and the other client-surface tests updated to the new `/admin` path — **test-admin-routes passes (exit 0)**.

### Admin copy inventory (what exists and which is live/canonical/legacy)

| Copy | Owner | Live/Canonical/Legacy | Action |
|---|---|---|---|
| `admin/*.html` + `admin/admin-auth.js` + `admin/admin-canonical-route.js` (repo root, `git mv` from `frontend/public/admin`) | privileged Admin UI | **LIVE / canonical** | KEEP |
| `/api/admin` routes (`src/routes/adminRoutes.ts`, `adminPlatformRoutes.ts`, `adminDisputeRoutes.ts`, `adminFcmRoutes.ts`, `adminClineRoutes.ts`, `providerVerificationRoutes.ts` admin half) + services | canonical Admin API (backend) | **LIVE / canonical** | KEEP in backend |
| `frontend/public/js/kurukoo-admin.js`, `frontend/public/css/admin-console.css`, `admin-pages/*.css` (shared shell assets served from `frontend/public`) | shared admin shell assets | LIVE (referenced by live `admin/*.html` via absolute `/...` URLs) | KEEP (tracked, served) |
| EJS admin surfaces | none found — no EJS admin templates exist in `views/` | — | nothing to retire |
| any second/legacy admin copy | none found (single `admin/` copy exists) | — | no duplication exists |

### Remaining pre-existing contract failures (explicitly identified, do not silently resolve)

1. `scripts/test-canonical-authenticated-screen-set.mjs`: `k-app-surface` — needs product decision (see §6.1).
2. `scripts/test-desk-visual-foundation.ts`: `k-desk-module-welcome` — needs product decision (see §6.2).
3. `scripts/test-behaviour-instructions.ts`: expects `classifyWithFastText('I need an okada to pick me up')` → `ride_request`, but the FastText rule layer routes explicit okada requests → `okada_rider` — absent at HEAD too. Conflicts with `scripts/test-ai-routing-convergence.ts` which expects `okada_rider` for explicit okada requests (and passes). Both intents exist as converged skills (`okada_rider`, `ride_request`). Needs a product decision: which converged skill owns explicit okada pickup requests.
4. `scripts/test-desk-system-contract.ts`: expects the desk chat HTML to include the direct canonical URL `href:'/chat'` — absent at HEAD too.
5. `scripts/test-web-app-shell.ts`: expects `frontend/public/css/kurukoo-app-polish-v2.css` and `frontend/public/js/kurukoo-app-polish-v3.js` — genuinely absent at HEAD too (also `kurukoo-ui-convergence.js`). Missing files, not a path-edit regression.
6. `scripts/test-client-surface-coverage.ts`: `ReferenceError: workspaceClient is not defined` (line 95) — a test-side bug at HEAD too (variable renamed, references not updated).
7. `scripts/test-chat-desk-parity.mjs`: `SyntaxError: Invalid or unexpected token` when compiling the desk runtime source as ESM — pre-existing at HEAD.
8. `scripts/test-desktop-screen-flow.ts`: expects `public/js/kurukoo-app-shell.js` → corrected to `frontend/public/js/...` during this migration. Two further failures verified absent at HEAD too: (a) `admin/admin-auth.js` lacks the `'Open Web App'` navigation bridge (absent at HEAD's identical file); (b) the `/chat` public route owner assertion — `/chat` routes moved to `chatPageRoutes.ts`, so `publicRoutes.ts` no longer declares them. Both need a product decision (restore the bridge/route or update the contract).

Frontend `tsc --noEmit`: pre-existing strict-mode errors (missing files/strict issues at HEAD; not a migration regression — see §6 tail).
