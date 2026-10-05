# Kurukoo Places — "See it. Shape it. Build it."

**Status:** subordinate to `docs/architecture/CURRENT_PRODUCT_TRUTH.md`. This document governs
implementation ownership only; it does not assert that external providers, authorities, imagery
sources, or AI visualisation backends are live.

## 1. What Places is

Kurukoo Places lets people, creators, developers and authorities understand a real area,
imagine what it could become, agree on priorities, and turn the strongest ideas into real
projects — through the existing Kurukoo OS, not a parallel platform.

Pilot areas (development seeds, `seedDemoPlaces` in `src/database.ts`, non-production
only): Garki, Wuse and Lugbe Phase 2 (Abuja); Independence Layout, Trans-Ekulu and GRA
(Enugu); Ikeja and Lekki Phase 1 (Lagos); Old Bodija (Ibadan); Old GRA (Port Harcourt).
Centres were geocoded once against OpenStreetMap and baked in so seeding stays offline-safe.
Reality starts empty (every need reads unknown); no concepts, votes or opportunities are
seeded. Production pilots are created through the API.

Core loop:

```text
Observe → Create → Publish → Vote → Improve → Validate → Opportunity → Execute
```

## 2. Canonical objects (new)

| Object | Owner | Table | Notes |
|---|---|---|---|
| Place | `src/services/placeService.ts` | `places` | Location + reality + confidence + needs + lifecycle status. |
| Concept | `placeService.ts` | `place_concepts` | Creator vision for a Place. Forks via `parent_concept_id`; losers are kept, never deleted. Sponsored concepts carry a mandatory `sponsor_label`. |
| Vote | `placeService.ts` | `place_votes` | One vote per person per concept (`UNIQUE(concept_id, voter_phone)`); role is `lives_here \| works_here \| owns_here \| interested`. |

Place lifecycle: `observed → visioning → proposed → approved → building → built` (forward only).
Concept lifecycle: `draft → published → leading → proposed → approved → building → built`.

## 2b. The complete loop as shipped

| Step | How it is reached | Owner |
|---|---|---|
| Discover an area | Chat: "show me what Garki could become" → deterministic `place_card` (verified end-to-end over the SSE stream, guest included); unknown areas get a `place_clarification` card listing only real places | `intentRouter` + `placeService` |
| Understand it now | Place page NOW map (streets/satellite), labelled reality + needs table | `placeService`, OSM/Overpass/OSRM/OpenTopodata |
| Imagine it | "Show me what this could become" scenario templates; free deterministic SVG massing per concept; optional cached AI hero | `SCENARIO_TEMPLATES`, `visionService` |
| Publish & iterate | Creators publish concepts; anyone forks (v1 → v2); vision tour plays visions client-side with zero new assets | `placeService`, place page |
| Agree | One vote per person per concept with a declared role; sponsorship always labelled | `place_votes` |
| Bring people in | Printable pilot poster (signed QR, 90-day expiry) + WhatsApp share; Discover radar; follows drive re-engagement | `/places/:slug/poster`, `qrContextService` |
| Needs | Live OSM refresh + district pulse | `placeGeoService`, `district-pulse` |
| Opportunity | Evidence-worded opportunity into the existing feed | `opportunityEngine` |
| Authority review | Explicit approval workflow — community support is never an approval | `place_approvals` |
| Make it real | One canonical Economic Request, routed to `find_worker`/`architect`/`urban_planner`/`civil_engineer`/`quantity_surveyor`/`land_surveyor` | `skillFlows` |
| Earn | Creator milestone at 10 supporters (existing points rails); Plus/Business-gated developer report; labelled `places_detail` ad placement | `pointsEngine`, `getDeveloperReport`, `adManager` |

## 3. Reuse map (no parallel authorities)

| Need | Canonical owner reused | Places relationship |
|---|---|---|
| Spatial query | `discoveryNetwork` | Places remain queryable nearby entities; radar is a projection, not a second presence store. |
| Discussion | `topicService` | A Place may link an existing Topic (`topic_id`); no second comment system. |
| Demand feed | `opportunityEngine` (`proactive_opportunities` + additive `place_id`/`concept_id` columns) | Strong concepts publish evidence-worded opportunities with a Chat continuation link. |
| Execution | `skillFlows` Economic Request | "Make this real" creates exactly one Economic Request per concept (`economic_request_id`); duplicates are rejected. |
| Presence/privacy | `nearbyPulse` patterns | Radar coordinates are fuzzed to ~100m; exact locations stay request-scoped. Creator phones are never public. |
| Conversation | `canonicalChatTurnService` | Entry is `Ask Kurukoo → /chat → Place card`; no second chat engine. |
| Memory | `memoryProfile` | Only follows/roles/interests; never raw geo or invented availability. |
| Re-engagement | `relationshipService` (`place` target) + `notifyRelationshipTargetUpdate` | Places are followable civic objects; status transitions and new concepts fan out through the canonical follow primitive. No second notification system. |
| Discover | `discoverExperience` (`places` section, `place` item type, `open_place` chat action) | Nearby Places project from the fuzzed radar into Discover home; follow/unfollow route to the canonical relationship primitive. Watches stay discovery/topic/promotion-only with an explicit error. |
| Visualisation | `src/services/visionService.ts` | Deterministic SVG massing (free, always) + one cached AI hero per revision (only when an image backend is configured). |
| SEO | `publicRoutes` + `seoService` | `GET /places/:slug` detail chain, `sitemap-places.xml`, sitemap index + robots + llms.txt entries. |
| Moderation console | `admin/places.html` | Static-admin pattern; lifecycle + `removed` controls. |

## 4. Truth rules

- Every reality/needs claim carries `verified | estimated | community-reported | missing`.
- Unknown stays unknown: `computeNeeds` returns `gap: unknown` with a survey-required note rather than a fabricated gap.
- Opportunity subtitles must name their evidence source and state that feasibility is not yet validated.
- Developer reports (`GET /api/places/:slug/report`) carry a disclaimer: community signal is indicative, not a planning approval.
- Contract: `scripts/test-places-truth.ts` (wired into `test:route-sequence`), including the HTTP surface (detail chain, vision assets, authenticated votes, opportunity act/dismiss, bounded radar).

## 5. Cost-effective technology choices

- Live geo context: OpenStreetMap via Overpass (`src/services/placeGeoService.ts`,
  `POST /api/places/:slug/refresh-reality`). No key, free, user-triggered, rate-limited,
  25s timeout, 3000-element cap with recorded truncation. Counts merge into reality labelled
  `community-reported` with source + `fetched_at`; road/water counts are informational only
  and never produce gap claims. Unreachable source fails closed with zero writes.
- Real network routing: OSRM (`walkingSeconds`), public demo server by default (free, no key),
  self-hosted via `KURUKOO_OSRM_URL`. Enriches refresh with nearest-school/clinic walk times
  (fail-soft, informational). A full self-hosted Valhalla/GraphHopper graph remains ops work,
  not a code gap: the engine URL is already swappable.
- Terrain: SRTM elevation via OpenTopodata (free, no key, fail-soft) in the same refresh.
- Tiles: OSM + Esri defaults with `VITE_KURUKOO_TILE_URL_STREETS/SATELLITE` overrides, so
  self-hosted Protomaps drops in without code changes. No tile server is operated in V1.
- Land registries: `LAND_REGISTRIES` seam (AGIS/ENGIS `not_connected`) surfaced in every
  place detail; verified land entries can only arrive through a connected registry.
- Maps: Leaflet CDN (same version already vendored in `admin/`) + OpenStreetMap tiles with an Esri World Imagery satellite toggle, rendered in the SPA place page (`frontend/src/routes/places.$slug.tsx`) with an offline fallback. No Mapbox/Google billing, no self-hosted tile server in V1. Public radar coordinates are rounded to ~100m (`precisionMetres` in the response); exact geometry stays request-scoped.
- POIs/context: Nominatim/Photon + Overpass API on demand, cached in the existing discovery cache.
- AI visualisation: deterministic SVG massing ships free and is served with no storage
  (`GET /api/concepts/:id/vision.svg`, honesty caption baked in); a generative hero render is
  attempted at most once per concept revision and only when the deployment configures an image
  backend (`POST /api/concepts/:id/vision`, `aiRateLimit`), cached in `place_vision_blobs`,
  served at `GET …/hero.png` (truthful 404 otherwise) — no trained model, no standing GPU cost.
- Geo: SQLite lat/lng + bounding-box now; PostGIS only on the production path per the existing dev→prod migration plan.
- Voting integrity: existing phone auth + one-vote constraint + rate limits. No blockchain, no new identity system.

## 5b. Surfaces (web, PWA, native share one backend)

- Web: `/places` (list, SPA-piloted with prerendered content) + `/places/$slug` (detail:
  NOW map, POTENTIAL visions, needs, creators, history, disclaimers) in the TanStack SPA;
  linked from Discover ("Places being shaped", radar-driven when located), the more-menu,
  and Chat continuation links. Unknown slugs stay 404 through the detail owner chain.
- PWA: the same SPA routes inside the existing manifest scope — no separate app.
- Native (Expo): `lib/places-client.ts` + `components/place-detail.tsx` +
  `app/surface/places/[slug].tsx`; Discover gains a `places` section where place items open
  the place screen (slug from `chatAction.id`) and offer **Follow** (not Watch — the API
  rejects place watches by design); `discover-contract` gains the `place` item type and
  `places` section; `platform-contract` gains the places entry. Verified: client unit tests
  (`tests/places-client.test.ts`, 4 cases), platform contract, full mobile vitest suite.
  A `vitest.config.ts` alias now lets tests import `@/…` modules (previously impossible).
  Device/emulator proof remains UNVERIFIED; Expo route-type regeneration needs Metro, so the
  local `.expo/types/router.d.ts` stays stale (gitignored) until a dev machine/CI regenerates it.
- Registries: `places` feature, `place-card` component, `places` capability (Discover
  surface), `web-places-public` surface, canonical `place(s)` URLs — all additive and
  contract-tested. The nine-screen OS manifest is intentionally untouched.

## 5c. Moderation

- Admin API (`authenticateAdmin` only): `GET /api/admin/places` (counts), `GET /api/admin/places/:slug/concepts` (with creator phones), `PATCH /api/admin/concepts/:id/status` (lifecycle + `removed`), `PATCH /api/admin/places/:slug/status`.
- `removed` hides a concept from every public surface and makes votes, forks, opportunities and make-real inert with an explicit moderation error.
- Console: `admin/places.html` follows the existing static-admin pattern (admin-auth.js token).

## 6. Monetisation (participation stays free)

Voting and community proposals are free. Revenue attaches to the economic activity around them:
1. Creator milestones: a concept that earns 10 supporters awards its creator 5 points once
   (`rewarded` flag, existing `pointsEngine` rails — no new currency, no commission ledger).
   The stranded `9f01f5c4` creator-storefront commit was deliberately not resurrected: 824
   unaudited lines with no in-tree tests and no live references; place-creator incentives do
   not need it.
2. Developer intelligence (`/report`): demand signals, sentiment by voter role, gap analysis.
2. Sponsored development concepts — always labelled via `sponsor_label`.
3. Professional referrals when a concept becomes an Economic Request (architects, surveyors, builders as existing providers).
4. Institutional (`Place Intelligence`) subscriptions for LGAs/authorities: priorities, gaps, supported projects.

## 7. Explicitly out of scope for this slice (with reasons)

- No 3D/Cesium, no video generation, no national modelling, no government-registry integration
  (AGIS/ENGIS links are future activation boundaries, labelled `missing` until connected).
  Land fields additionally carry the no-ownership-claim disclaimer in every place detail.
- No dedicated creator-profile service: creator attribution lives on concepts (owner view only),
  area interest lives in follows, and milestones pay through points. A creator commission loop remains a follow-up.
- No third taxonomy: Places reuses `ECONOMIC_CATEGORIES` wherever categorization is needed;
  the five concept scenarios are a fixed illustrative enum (invalid values rejected, contract-tested),
  not a taxonomy. Investigated merging the two pre-existing Topic taxonomies
  (`ECONOMIC_CATEGORIES` vs `topic_community_categories`) and declined: they govern different
  axes (skill/request routing + topic validation vs discussion-space organisation + ad placement),
  and `topicService` already validates `topic.category` against `ECONOMIC_CATEGORIES`, so the
  boundary is coherent. Merging would risk Topics, community ads and skill routing for no
  Places benefit.
- No generated video: the "motion" requirement is met by a zero-cost client-side
  vision tour (crossfading SVG massings) plus an optional cached AI hero. Real
  text-to-video needs keyed spend and per-render cost, so it stays opt-in.
- No Protomaps self-hosting, Sentinel-2 ingestion pipeline, or routing graph ops:
  imagery history exists as schema + API + UI (`place_imagery_epochs`, empty until a source
  connects — the empty state is the product, not a placeholder); satellite history stays a
  viewer link, not an ingested dataset. Road connectivity uses live OSRM instead of a local
  graph; operating one remains deployment work, not a code gap.

## 8. Bugs fixed alongside (verified before fixing)

- `startBackgroundWorkers`/`stopBackgroundWorkers` had zero callers, silently disabling
  deferred matching, reminders, memory decay, trust scores, FCM drain and discover watches.
  They are now wired into `startBackgroundServices`/`stopBackgroundServices`
  (`src/startup/backgroundServices.ts`); `KURUKOO_WORKERS=0` remains the kill switch.
- `actOnOpportunity`/`dismissOpportunity` had no HTTP route: `POST /api/proactive/:id/act`
  and `POST /api/proactive/:id/dismiss` added in `publicRoutes.ts`; the feed now also
  carries `placeId`/`conceptId` for place-linked opportunities.
- Demo seeds ran under `NODE_ENV=test`, contradicting the repository's own
  `test-demo-workspace-seed` contract ("Demo seed must stay out of automated test
  databases"). Added `allowDemoSeeds()`; topics/places/providers now seed only in
  development-like environments, so contract tests observe truthful empty states.
- `kurukoo-app-shell.js` still pointed primary navigation at the retired `/home`;
  it now targets `/field` ("Your Perch") per §29a.
- `canonicalAuthenticatedScreenSetManifest` still declared `desk: /home`; corrected
  to `/field` (single-line change; Chat ownership assertions were pointing at a
  retired sendFile owner and now assert the SPA boundary instead).
- `appSurfaceRoutes` detail loop omitted `agents` and `memory`, so canonical URLs
  `/agents/:id` and `/memory/:id` 404'd; both families restored.
- Topic detail pages lost their `index,follow` robots metadata, so the
  convergence contract could not see indexable metadata on a page whose own
  guard already 404s non-public topics; static robots is truthful there and is
  now declared (same for the place detail route).
- `isStandaloneName` treated any short wordy message as identity input, so a guest
  asking "show me what Garki could become" was asked for their name instead of being
  routed. Interrogatives, questions and request verbs are now excluded; the area flow
  reaches routing. This was a general conversational bug, not a Places-only one.
- `test:content-routes` still expected the retired `/resources` page; it now asserts the
  Help guide owner plus the surviving `/resources/:slug` detail alias (and reads
  array-path Express layers correctly).
- `test-fresh-database` asserted the agent runtime is DISABLED while inheriting
  `KURUKOO_AGENT_ENABLED=true` from the ambient `.env`; the flags are now pinned.
- `test-public-routes` was red on main for three pre-existing reasons (stale `/chat`
  expectation after identity-in-conversation moved it to the SPA, unlisted `/resources`
  redirect aliases, array-path stack shape): manifest aligned, `/chat` removed per the
  test's own SPA-ownership rule, `/resources` documented as redirect aliases.
