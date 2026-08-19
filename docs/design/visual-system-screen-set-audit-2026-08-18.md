# Kurukoo Visual System Screen-Set Audit

**Date:** 18 August 2026
**Purpose:** Compare every authoritative Kurukoo visual screen set with the current repository surfaces and identify what remains to be refactored.
**Status vocabulary:** `Covered` means the principal composition and reusable visual authority are implemented and have current evidence. `Partial` means the route or surface exists but one or more reference states, responsive variants, or authenticated comparisons remain. `Missing` means the screen family has no corresponding high-fidelity implementation. `Blocked` means the design can be specified but final validation depends on an external device, credential, provider or environment boundary.

> The existence of a design board does not constitute implementation. A screen is only considered covered when its route/component owner, state semantics and validation evidence are all present.

## Executive conclusion

Kurukoo has a strong visual foundation and a structurally converged public shell, Chat shell, discovery foundation and mobile surface system. The remaining work is predominantly **surface-level convergence**, not a new architecture. The largest gap is that the visual system is broader than the set of screens currently refactored: public secondary pages, authenticated commerce states, operational/admin depth, channel/linking states, trust and memory surfaces, and platform lifecycle states still need to use the same high-fidelity component grammar.

The most important remaining refactors are the following. First, the new Trust & Continuity, Network & Fulfilment, Operations and Platform States boards are design references but have not yet been applied systematically to production routes. Second, Checkout and Confirmations now have authenticated owner-scoped hydration and controlled populated-fixture browser comparison; remaining work is live provider/payment evidence and production-device comparison, not a second checkout or confirmation architecture. Third, the public secondary route family—Explore/How it works/Network/Resources/Topics/Pricing/Contact/Legal/Advertise/Careers—does not have dedicated screen-set coverage at the same fidelity as Homepage, Discover, Channels, About and Help. Fourth, the PWA and native lifecycle, notification, linked-device and offline states remain partially implemented or externally blocked.

## 1. Authoritative screen-set coverage

| Visual set | Intended surfaces | Current implementation owner | Status | Evidence and remaining work |
|---|---|---|---|---|
| Frontend Website | Homepage, Explore/Discover, Channels, About, Help | `views/index.ejs`, `views/discover.ejs`, `views/channels.ejs`, `views/about.ejs`, `views/help.ejs`, `site-authority.css` | **Partial / near-covered** | Homepage, Discover, Channels, About and Help have been live-checked and share the public shell. The first viewport is converged, but Homepage lower content, Help lower-guide styling and secondary public pages remain outside the same dedicated screen-set fidelity. |
| Web Chat | Guest Chat, active conversation, context inspector, Ask composer, workspace return | `public/chat/index.html`, `public/css/kurukoo-chat.css`, `public/js/kurukoo-primary-chat.js` | **Partial** | Three-region shell and canonical selectors are present; DOM/accessibility/runtime contracts pass. Remaining refactor is visual density and spacing at reference dimensions, especially header/action scale, composer/message hierarchy and authenticated workspace transitions. |
| PWA | Desktop/tablet/mobile shell, install, offline, reconnect, update | `public/chat`, `public/sw.js`, `public/offline.html`, manifest/service-worker routes | **Partial / blocked for final proof** | Repository lifecycle contracts exist, but installed standalone states, browser notification permission, update/reopen continuity and low-bandwidth behavior require device/browser validation. The new Platform States board is not yet applied as a unified visual layer. |
| iOS | Welcome, Chat, task continuation, memory/privacy, sheets and safe areas | `/home/ubuntu/kurukoo-mobile/app`, `components/kurukoo-ui.tsx`, `KurukooContextProvider` | **Partial / blocked for final proof** | Native surfaces and deterministic tests exist; exact logo, typography and date-picker dependency are aligned. Physical-device rendering and native notification actions still block final device proof. Trust & Continuity now has a shared context/evidence band across Tasks, Requests, Reminders and Notifications. |
| Android | Trust/onboarding, Chat, Discover, Notifications, adaptive navigation | `/home/ubuntu/kurukoo-mobile/app`, shared native primitives | **Partial / blocked for final proof** | Core routes and deterministic tests exist. Native build/device verification, notification actions and system-back behavior remain; the date-picker dependency now resolves in TypeScript and lint. Shared Trust & Continuity treatment is implemented across task and notification surfaces. |
| Admin | Dashboard, campaign operations, users, content, pricing, referrals, SEO, revenue and moderation | `public/admin/*.html`, `public/css/admin-pages/*.css`, admin APIs | **Partial** | Admin route inventory is broad and the base visual language exists, but only a subset is represented in the original admin board. Remaining work is page-by-page convergence for Ads, Users, Content, SEO, Pricing, Revenue, Referrals, Partnerships, Curation, Scam, Social and future/analytics states. |
| Agents | Agent directory, goal queue, runtime detail, policy-reviewed tools, pause/cancel | agent admin pages and agent runtime surfaces | **Partial** | The agent board covers the conceptual hierarchy, but the full runtime, goal detail, bounded-autonomy metadata, failure/retry and notification-continuation states need exact implementation comparison. |
| Partners | Provider profile, contributor, opportunity, business workspace | `views/partners.ejs`, `views/provider-profile.ejs`, provider/network/workspace surfaces | **Partial** | Partner and provider routes exist and lifecycle boundaries are documented. The new Network & Fulfilment board adds states not yet refactored into these routes: evidence review, invitation, claim, onboarding, verified and available transitions. |
| Checkout | Cart, sourced offer, request review, payment boundary | workspace/cart/request/payment services | **Improved / partial** | The authenticated workspace now hydrates owner-scoped review-cart records, preserves sourced-offer provenance, allows only one auditable offer-to-request transition, shows explicit non-payment state, and directs a linked request to its confirmation. Controlled populated-fixture browser comparison passed. Live quote, payment, provider and device evidence remain external gates. |
| Confirmations | Proposal, confirmation, notification, continuation | canonical executor, notification queue, Chat/workspace | **Improved / partial** | The authenticated workspace now hydrates owner-scoped canonical request identity/status and provider coordination evidence, groups internal/provider/payment states, requires a second cancellation confirmation, and creates request-specific Chat continuation. Controlled populated-fixture browser comparison passed. Provider callbacks, notification delivery and native/device proof remain external or separate-surface gates. |
| Nearby Radar | Discover map/list, Radar status, Go Live, invitation | discovery network, MapLibre/OpenStreetMap, radar and go-live routes | **Partial** | Map/list and approximate-location boundaries are implemented and documented. Discovery detail, opportunity invitation, contributor attribution and low-bandwidth/mobile states need the new Network & Fulfilment treatment. |
| Trust & Continuity | Identity, context, memory, safety, tasks, notifications | auth, Chat, memory, safety, tasks, reminders, notification queue | **Implemented / partial** | Mobile Tasks, Requests, Reminders, Notifications and the shared Connect, Memory, Safety, Checkout, Confirmation, Partners, Agents and Admin surfaces now use a reusable context/evidence band. Web/PWA parity, reference-size comparison and physical notification-action verification remain. |
| Network & Fulfilment | Channels, QR pairing, discovery lifecycle, provider readiness, fulfilment | channels, linked-device, discovery, provider, economic request and payment owners | **Improved / partial** | Mobile Connect now has a reusable fail-safe pairing-readiness composition, while provider, discovery and fulfilment lifecycle states remain to be converged across Web/PWA and native detail screens. |
| Operations | Admin overview, campaigns, evidence, audit, SEO/content | admin static pages and APIs | **Partial / missing depth** | The basic Admin shell exists. The board’s campaign review, serving health, evidence review, audit trail and SEO editor states remain uneven or absent as high-fidelity screens. |
| Platform States | Install, offline, reconnect, update, notification action, recovery | service worker, offline page, native notification service, readiness boundary | **Improved / blocked for device proof** | The canonical PWA status region now has explicit loading, online, offline, update, installed and error tones with reduced-motion-safe transitions. The service-worker lifecycle contract passes; installed standalone, permission and low-bandwidth device validation remain open. |

## 2. Route-level gap map

### Public Web and PWA

The following public routes are implemented but do not yet have a dedicated high-fidelity screen-set comparison at the same level as Homepage, Discover, Channels, About and Help:

| Route family | Refactor status | Required visual work |
|---|---|---|
| `/explore`, `/how-it-works`, `/network` | **Partial** | Create one coherent public information architecture: Explore intent cards, How it works conversation timeline and Network lifecycle explanation. Reuse the public shell and link every action to Chat or Discover. |
| `/resources`, `/resources/:slug`, `/topics`, `/topics/:slug` | **Partial** | Apply a resource/article/topic template with source attribution, reading hierarchy, related Chat prompts and mobile typography. Avoid generic blog defaults. |
| `/pricing`, `/points`, `/resources/points`, `/subscription`, `/top-up` | **Partial** | Refactor pricing, points and subscription surfaces into one truthful commerce-information family. Distinguish information, sandbox balance, payment readiness and actual settlement. |
| `/contact`, `/careers`, `/advertise`, `/partners` | **Partial** | Apply public shell, form states, response readiness and confirmation/error states. Remove any generic marketing-card drift. |
| `/legal/*` | **Partial** | Create a compact legal reading template with active section navigation, print/readability mode and clear return to Help or Chat. |
| `/api-docs` | **Missing visual set** | Create a developer-facing but Kurukoo-consistent documentation layout without allowing technical vocabulary into the consumer Homepage. |
| `/offline`, service-worker update and installed PWA states | **Improved / partial** | PWA runtime now presents truthful loading, online, offline, update, installed and error feedback through the existing status-region owner. Apply the same visual grammar to the offline fallback and complete installed-device validation. |

### Authenticated Web Workspace

| Surface | Status | Refactor focus |
|---|---|---|
| `/requests`, `/tasks`, `/reminders` | **Partial** | Merge list/detail visual grammar, preserve exact object identity and use one context-aware return-to-Chat action. |
| `/memory`, `/saved` | **Partial** | Use Trust & Continuity memory cards with provenance, scope, proposal, revoke and fail-closed states. |
| `/safety` | **Partial** | Apply safety check-in, overdue and resolution states with explicit external escalation boundaries. |
| `/connect`, `/whatsapp-linked-device`, Telegram linked-device surfaces | **Improved / partial** | Mobile Connect now presents explicit WhatsApp, Telegram and Email/push readiness states with a fail-safe pairing-boundary action; it never claims a QR scan, linked device or delivery. Real provider sessions, QR rendering and callback evidence remain activation boundaries. |
| `/cart`, `/subscription`, `/top-up` | **Partial / authenticated comparison blocked** | Refactor to Checkout/Confirmations rhythm; validate signed-in states at reference sizes. |
| `/workspace` and central surface panels | **Partial** | Reduce internal padding, align inspector spacing and keep the Ask composer visually anchored across narrow widths. |

### Native Mobile

| Surface | Status | Refactor focus |
|---|---|---|
| Chat and tabs | **Partial** | Core shell exists; complete visual comparison for header, composer, message grouping and context continuation. |
| Tasks, Requests, Reminders and Notifications | **Improved / partial** | A shared Trust & Continuity band now exposes exact context identity, preserved state and evidence language across Tasks, Requests, Reminders and Notifications. Remaining work is reference-size comparison and physical notification-action verification. |
| Discover, Discovery Detail and Go Live | **Partial** | Apply Network & Fulfilment lifecycle language, approximate location and source attribution at portrait sizes. |
| More, Connect, Memory, Safety, Checkout and Confirmation | **Improved / partial** | Shared SurfaceDetail now applies the Trust & Continuity band to these existing surfaces, including explicit checkout/confirmation non-fulfilment language. Remaining work is reference-size comparison, deeper state variants and native sheet/action hierarchy. |
| Native date-picker flow | **Implemented / device validation open** | `@react-native-community/datetimepicker` is installed and the mobile project passes TypeScript, lint and deterministic tests. Physical iOS/Android interaction validation remains open. |
| Push notifications and installed lifecycle | **Blocked** | Repository readiness exists; physical device, permission, EAS identity and real delivery remain activation/validation boundaries. |

## 3. Systemic visual drift found across the boards

The boards share the correct warm palette and restrained card language, but implementation drift remains concentrated in five areas. **First**, the production route family is broader than the visual system: many secondary pages still use generic page templates instead of a screen-set-specific composition. **Second**, the exact same semantic state is rendered differently across Chat, workspace, native cards and admin tables; `Pending`, `Needs your input`, `Unavailable`, `Verified`, `Connected`, `Saved` and `Paused` need one shared visual mapping. **Third**, context identity is visually underrepresented outside Chat: request IDs, conversation IDs, source attribution and `resumeTarget` should appear in detail headers and action cards without exposing sensitive payloads. **Fourth**, authenticated checkout, confirmations and linked-device states lack final reference-size comparison. **Fifth**, PWA/native lifecycle states are documented and partially wired but not yet treated as first-class visual surfaces.

The visual boards also reveal that the operations density is appropriate for admin but must not leak into consumer Chat. Conversely, consumer surfaces must not use generic admin tables for request, memory or notification detail. The refactor should therefore converge shared primitives rather than flatten every surface into one layout.

## 4. Prioritized refactor backlog

| Priority | Refactor package | Screens included | Why it comes first |
|---:|---|---|---|
| P0 | Fix platform validation blocker | Native date picker, mobile check/lint/Metro | Current error prevents clean native validation and obscures visual regressions. |
| P0 | Converge Trust & Continuity | Login/onboarding, context rail, tasks, reminders, notifications, memory, safety | These screens determine whether the OS feels like one continuous relationship instead of disconnected mini-systems. |
| P0 | Authenticated Checkout & Confirmation comparison | Cart, offer, payment boundary, confirmation, notification continuation | **Repository increment completed 19 August 2026:** owner-scoped hydration, request/payment/evidence states, cancellation confirmation, request-specific Chat return, deterministic contract and controlled populated-fixture browser comparison are present. Live provider/payment and physical-device evidence remain external activation gates. |
| P1 | Converge Channels and linked devices | Connect directory, WhatsApp QR, Telegram QR, connected device, failure | Channel readiness and device pairing currently span multiple visual owners and must share one state system. |
| P1 | Converge Discovery & Opportunity | Discovery detail, candidate, invite, claim, provider readiness, Go Live | This protects the discovered-versus-provider distinction and makes the spatial network coherent. |
| P1 | Complete public secondary templates | Explore, How it works, Network, Resources, Topics, Pricing, Contact, Advertise, Careers, Legal | The primary public set is aligned, but the broader website still has unrefactored route families. |
| P1 | Complete Admin and Operations | Ads, analytics, users, content, SEO, pricing, referrals, partnerships, curation, audit | Admin has many routes but not one consistent visual review/detail/audit pattern. |
| P2 | Complete PWA lifecycle | Install, offline, reconnect, update, browser notification and re-entry | Repository boundaries are present; final visual and device behavior must be validated. |
| P2 | Complete native parity | iOS/Android safe areas, sheets, back behavior, notification actions, checkout and confirmations | Native implementations exist but need exact reference-size and device comparison after P0 repairs. |
| P2 | Create API/docs and legal reading sets | API docs, legal, privacy, trust/safety | These are important for completeness but do not block the core conversational operating system journeys. |

## 5. Acceptance criteria for the refactor

A screen-set refactor is complete only when the implementation uses the shared Kurukoo mark and tokens, has a named route/component owner, renders every required state variant, preserves exact canonical object identity for explicit actions, provides a visible return-to-Chat path, passes responsive checks without horizontal overflow, meets minimum touch-target and focus requirements, and does not imply an external success that the canonical service has not confirmed.

For authenticated, external or device-dependent screens, repository readiness is distinct from live activation. The visual system may show `Needs setup`, `Pending`, `Not connected`, `Delivery not configured` or `Awaiting confirmation`; it must not show `Connected`, `Delivered`, `Paid`, `Verified` or `Available` without corresponding evidence.

## References

1. [Kurukoo cross-platform design system](./kurukoo-cross-platform-design-system.md)
2. [Kurukoo OS surface screen-set handoff](./kurukoo-os-surface-screen-set-handoff.md)
3. [Frontend website visual convergence findings](./frontend-website-visual-convergence-findings.md)
4. [Mobile visual convergence audit](../../../kurukoo-mobile/docs/visual-convergence-audit.md)
5. [Mobile handoff](../../../kurukoo-mobile/docs/kurukoo-mobile-handoff.md)
6. [Remaining OS screen-set catalogue](../../../kurukoo-design/kurukoo-remaining-os-screen-sets.md)
