# Approved Independent-Agent Handoff: Kurukoo Screen-Set Recheck and Correction

## Mission

Independently recheck the current Kurukoo Web/PWA and Expo mobile implementations against the authoritative screen-set references and correct only confirmed visual, functional, accessibility, or responsive drift. This is a visual-convergence pass, not a redesign. The canonical references, shared design system, current service owners, and Chat protocol remain authoritative over the current implementation.

The objective is **visual convergence with functional preservation**: each corrected surface should match its assigned reference at the reference viewport and continue to route through the existing canonical services, owner-scoped context, authentication boundaries, and Chat stream protocol.

## Authority and repository scope

Use the current shared worktrees as the source of truth. Do not assume a single repository contains every surface:

| Area | Working authority |
|---|---|
| Expo mobile | `/home/ubuntu/kurukoo-mobile` |
| Desktop/public Web client | `/home/ubuntu/kurukoo-website/client` |
| Canonical backend and design references | `/home/ubuntu/Kurukoo-develop` |
| Visual references | `/home/ubuntu/Kurukoo-develop/docs/design/authoritative-assets/` and the design documents under `/home/ubuntu/Kurukoo-develop/docs/design/` |
| Shared tracker | `/home/ubuntu/kurukoo-website/todo.md` |

Inspect current worktree state, recent commits/checkpoints, concurrent edits, and existing audit documents before changing code. Never overwrite unrelated work. Never use `git reset --hard`; use normal history, shared-worktree coordination, or the checkpoint workflow. Do not create a second CSS, logo, Chat, analytics, transaction, discovery, or persistence authority.

The exact terracotta interlocking loop-and-person Kurukoo mark is authoritative. Reuse the current canonical image asset and shared brand primitives. Do not recreate it with text, emoji, generic icons, approximated SVG geometry, or a legacy petal mark.

## Canonical design rules

Use `docs/design/kurukoo-cross-platform-design-system.md`, `authoritative-visual-inventory.md`, `authoritative-implementation-map.md`, the mobile handoff, and the screen-set images as the visual contract. The canonical tokens are terracotta `#B95D3C`, warm background `#F7F2EC`, raised surface `#FFFFFF`, ink `#24221F`, muted ink `#6D665F`, border `#E6DED5`, success `#2E8060`, warning `#B87928`, error `#B5483D`, and info `#3C6F91`. Use Inter for interface text and Space Grotesk for headings and identity labels.

The Chat composer is a shared authority: warm raised surface, persistent bottom placement, keyboard/safe-area awareness, 44px minimum Ask target, terracotta primary action, Kurukoo mark before the Ask label, explicit focus and pressed states, reduced-motion handling, and truthful Stop/Unavailable/Offline states. Chat remains the primary operating surface. Do not replace canonical Chat handoffs with isolated handlers or invented navigation.

## Required audit matrix

Before editing each covered surface, record a matrix row with the following fields: surface family, reference asset/document, exact reference viewport, device class, state, route or screen, current implementation owner, CSS/component authority, known functional boundary, comparison result, mismatch classification, correction, and validation evidence.

Audit the families requested by the product owner, but split the work into independently verifiable surfaces rather than treating a composite reference board as one page:

| Family | Required coverage |
|---|---|
| Public Web | Homepage hero/opening board, Explore/Discover, Channels, About, Help, pricing, auth entry, and country-aware states |
| Conversational OS | Guest and authenticated Chat, composer, messages, action cards, clarification, reminders, resumption, and exact-context flows |
| Workspace | Tasks, notifications, Connect, Requests, Reminders, Memory, Safety, Agents, and detail states |
| Transactions | Cart/Checkout, Confirmation, payment/evidence/pending/review states, and truthful failures |
| Discovery | Nearby Radar/Pulse map/list, source attribution, approximate location, loading/empty/stale/unavailable states, and Chat contexts |
| Partners and opportunities | Partners, Agents, Opportunities, onboarding, capabilities, availability, evidence, impact, and role selection |
| Admin | Login, dashboard, campaigns, users, providers, channels, agent controls, queues, readiness, audit, and error states |
| PWA/mobile | Responsive web/PWA states, Expo equivalents, navigation, safe areas, offline/update/installed states, and one-handed layouts |

Only audit surfaces that have an authoritative reference or an explicit documented contract. If a reference is missing, contradictory, or belongs to another platform, stop that row and document the ambiguity instead of guessing.

## Exact comparison method

Capture the current implementation at the exact reference dimensions. Use the actual asset dimensions for the board being compared; do not compare a composite reference to a single viewport. Where the reference shows multiple states, capture each state separately. Include desktop/PWA, iPhone SE, and Pixel 7 only when those device references exist. Capture both the initial viewport and the full scrollable surface when the reference covers the full page.

Compare structure before cosmetics: shell geometry, column ratios, container width, section order, card heights, alignment, fixed/sticky elements, mobile collapse, overflow, and action visibility. Then compare typography, line height, weight, icon/logo scale, tokens, borders, shadows, radii, spacing, state language, focus treatment, and motion. Classify each difference as reference mismatch, intentional responsive adaptation, content/state mismatch, functional defect, accessibility defect, performance defect, or accepted rendering variance. Do not chase anti-aliasing noise or undo a correct responsive adaptation.

For every correction, preserve before/after captures or a written non-actionable rationale. Pixel differences are evidence, not a reason to invent a new design.

## Functional and truth boundaries

Do not fabricate provider availability, payment settlement, notification delivery, linked-device pairing, device verification, inventory, opportunity execution, or external integration success. External providers remain `Ready for External Activation` unless verifiable provider evidence exists.

The real authenticated device-verification callback must use the canonical authentication/service boundary. The first-launch screen may persist only a documented local gate state; it must not mark a device as verified merely because a local button was pressed. A callback is complete only after the canonical service returns verifiable success, and failure must return to an explicit pending/error state.

Preserve owner-scoped identities, exact context IDs, canonical route parameters, authenticated Chat continuation, and fail-closed access checks. The Brain may interpret intent, but canonical services mutate state. Preview fixtures must be opt-in, labelled, isolated from production defaults, and must not resemble real user/provider records in a way that implies live data.

## Implementation priorities

Correct in this order: wrong composition or shell, wrong logo, wrong viewport behavior, wrong typography scale, wrong hierarchy, incorrect state semantics, broken action visibility, then spacing, density, colors, borders, icons, loading states, motion, accessibility, and low-bandwidth behavior.

For mobile, enforce portrait-first one-handed layouts, safe areas, readable wrapping, no horizontal overflow, 44px touch targets, keyboard-aware composer placement, and visible bottom actions. For Web/PWA, preserve the responsive desktop composition, keyboard focus, reduced motion, offline/reconnect/update states, and low-bandwidth behavior.

## Validation commands and repository-specific adaptations

Run the commands available in the owning repository rather than assuming one package manager:

| Area | Required checks |
|---|---|
| Expo mobile | `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm exec expo export --platform web`, plus deterministic route/state tests |
| Canonical backend | The configured `npm` type/lint scripts, protected route contracts, authenticated context tests, feedback/privacy tests, and relevant domain integration tests |
| Desktop Web | Use the available workspace tooling or source-level contract checks when no standalone manifest exists; do not claim an independent build if no package manifest is present |
| Visual | Exact viewport screenshots, before/after comparisons, responsive captures, focus/pressed/reduced-motion checks, and CSS authority scans |
| Functional | Public/authenticated route contracts, Chat stream/stop/regenerate/edit behavior, offline guards, owner scope, provider readiness, and preview-fixture isolation |

Record unrelated failures separately, including unavailable proxy services, dependency-owned warnings, or missing credentials. Do not relax a real regression merely to obtain a green aggregate command.

## Required deliverables

Produce a surface-by-surface audit matrix, before/after captures or written non-actionable reasons, a concise file-level change log, a functional-boundary report, a validation report with commands/results/known unrelated failures, and a recoverable checkpoint containing only the work completed in this correction pass.

## Acceptance criteria

The pass is complete only when every covered surface has an explicit comparison result; every actionable mismatch is corrected or documented; the canonical logo and CSS authorities are reused; no parallel visual or service authority is introduced; exact reference sizes are checked for desktop/PWA and mobile where available; accessibility and responsive behavior remain valid; Chat identity and owner-scoped context are preserved; no external capability is claimed without evidence; and the relevant build, type, route, functional, and regression checks pass or have clearly documented environment-owned failures.
