# Project TODO

- [x] Shared Kurukoo mobile design tokens and typography
- [x] Branded Kurukoo app icon, splash icon, favicon and adaptive icon configuration
- [x] Native Chat welcome and active conversation shell
- [x] Requests, reminders and tasks surfaces
- [x] Discover and Nearby Radar map/list surface
- [x] Connect and channel readiness surface
- [x] Memory, safety and settings surfaces
- [x] Cart, checkout, confirmation and request tracking surfaces
- [x] Notifications and Continue in Chat behavior
- [x] iOS safe-area, sheets, swipe-back and haptic adaptations
- [x] Android back navigation, adaptive bars and native feedback adaptations
- [x] Shared local state and deterministic journey fixtures
- [x] Mobile unit tests and mocked native feature tests
- [x] Web/PWA cross-platform design handoff alignment
- [x] Mobile lint, type-check and test validation

- [x] Canonical mobile conversation context store shared by Chat and Tasks
- [x] Exact-context task actions and resume-in-Chat navigation
- [x] Persist mobile task/context state across app relaunches with truthful local-only semantics
- [x] Deterministic tests for task pause/resume, exact context identity and Chat continuation
- [x] Re-run mobile validation and update the native completion handoff documentation

- [x] Local notification service with permission-aware, platform-safe behavior
- [x] Exact task context encoded in local notification data and resumed through Chat
- [x] Root notification response observer with safe route validation
- [x] Deterministic notification payload and navigation tests
- [x] Update mobile handoff with local-versus-remote notification boundaries

- [x] Truthful notification readiness state for web, simulator and physical device
- [x] Optional Expo push-token registration boundary without automatic delivery claims
- [x] Connect-surface notification readiness presentation
- [x] Deterministic readiness and token contract tests
- [x] Update the mobile handoff with token activation requirements

- [x] Replace the hand-drawn native BrandMark with the authoritative compact Kurukoo mark
- [x] Load the authoritative Inter and Space Grotesk typography in the native runtime
- [x] Align shared message, button, card and status primitives with the high-fidelity visual grammar
- [x] Add deterministic visual-contract tests for brand tokens and mark sizing
- [x] Complete the visual-convergence audit documentation and regression checkpoint
- [x] Replace the prior mobile BrandMark vector reference with the exact supplied compact logo crop
- [x] Validate the exact-logo mobile asset and updated visual contract

- [x] Repair the native date-picker dependency blocking Expo type-check, lint and Metro resolution
- [x] Re-run mobile validation and confirm the synced preview loads without the date-picker error

- [x] Audit every authoritative Kurukoo screen set against current web, PWA, mobile and operations implementations
- [x] Classify each screen as covered, partial, missing or blocked with evidence
- [x] Produce the prioritized visual refactor backlog and convergence recommendations

- [x] Repair the native date-picker dependency and restore mobile type-check/lint/Metro validation
- [x] Implement truthful gated external-provider readiness states across relevant web/provider surfaces
- [x] Add reduced-motion-safe loading animations and transitions to the updated homepage
- [x] Run cross-project regression checks for mobile and canonical web changes

- [x] Audit the latest shared Kurukoo state and select the highest-value repository-side implementation slice
- [x] Implement the prioritized next Kurukoo capability through canonical owners
- [x] Improve cross-platform continuity and operational readiness for the selected slice
- [x] Run full regression and repair any newly exposed defects

- [x] Audit the latest shared state and choose the next highest-value canonical capability slice
- [x] Implement the next capability through existing canonical owners
- [x] Extend cross-platform continuity and visual coverage for that capability
- [x] Run regression, repair defects and update truth documentation

- [x] Audit the latest shared state and choose the next highest-value canonical capability slice
- [x] Implement the next capability through existing canonical owners
- [x] Extend cross-platform continuity and visual coverage for that capability
- [x] Run regression, repair defects and update truth documentation

- [x] Audit the latest shared state and choose the next highest-value canonical capability slice
- [x] Implement the next capability through existing canonical owners
- [x] Extend cross-platform continuity and visual coverage for that capability
- [x] Run regression, repair defects and update truth documentation

- [x] Red-team the full Kurukoo repository across architecture, security, flows, routes, web/PWA, mobile and external boundaries
- [x] Run adversarial validation and record concrete repository-side defects
- [x] Fix all safe repository-side defects and incomplete build surfaces found by the red-team
- [x] Re-run full regression and reconcile truth documentation and residual activation gates

- [x] Inventory trusted-contact, consent, notification, linked-device and payment boundaries — recorded in `docs/architecture/progressive-trust.md` § Boundary ownership: one canonical owner, table, HTTP surface and state per boundary, plus the deliberately inert trusted-contact adapter gap in `contactSyncService`. Every file, function and flag named there was verified to exist.
- [ ] Implement the trusted-contact provider adapter and complete consent lifecycle
- [ ] Cleanly restart the mobile preview and clear stale watcher health noise
- [ ] Prepare and execute real-device notification, linked-device and payment activation tests
- [ ] Add realistic production substrate, preserve OS contracts and document remaining activation gates

## Cross-platform visual consistency audit

<!-- The "Cross-platform visual audit" block below this one was byte-identical and
     has been merged here. Two copies of the same open items made the ledger
     ambiguous about which was authoritative and double-counted the open work. -->

- [x] Inventory frontend website, web app/PWA, iOS, and Android route/style authorities
- [x] Capture Chat at desktop, laptop, tablet, iPhone, and Android reference widths — SPA guest gate captured at 1440×900, 1280×800, 768×1024, 390×844 and 412×915 in `.artifacts/spa-chat-guest-*.png` (TanStack SPA via vite dev; unauthenticated, so the correct Log-in gate renders, centered with no overlap at every width). The gate copy it exposed used the retired name “Your Perch”; fixed to “Your Field” in `frontend/src/routes/__root.tsx` in the same change. Authenticated-state captures need a session and remain open.
- [x] Compare frontend Chat and mobile Chat against the canonical Chat visual system
- [x] Audit Partner page for accidental mobile screen-set composition inside the frontend visual set
- [x] Trace CSS token, typography, spacing, radius, icon, and responsive breakpoint inconsistencies
- [x] Produce an evidence-based cross-platform remediation plan and validation matrix
- [x] Implement the approved convergence fixes without collapsing web and mobile interaction models
- [ ] Re-run route-by-route responsive visual validation and update the audit record
