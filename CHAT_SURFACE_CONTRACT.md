# Kurukoo Central Chat Surface Contract

**Status:** Current implementation contract as of 2026-08-16.

## Purpose

Kurukoo uses Chat as the canonical workspace shell. Secondary dashboard destinations are not separate user journeys inside the Chat experience; they are content surfaces rendered into the central `#chat-content` region while the left navigation, Chat header, composer, and right context rail remain stable.

## Surface routing

The canonical client maps are in `public/js/kurukoo-primary-chat.js`:

| View | Source route | Central title |
|---|---|---|
| `tasks` | `/tasks` | Tasks |
| `requests` | `/requests` | Requests |
| `reminders` | `/reminders` | Reminders |
| `saved` | `/saved` | Saved & offers |
| `cart` | `/cart` | Cart |
| `points` | `/points` | Points |
| `daily-picks` | `/daily-picks` | Daily Picks |
| `discover` | `/discover` | Discover |
| `connect` | `/channels` | Connect |
| `memory` | `/memory` | Memory |
| `safety` | `/safety` | Safety & check-ins |
| `settings` | `/settings` | Settings |
| `topics` | `/topics` | Topics |

Every Chat navigation control must use `data-surface-view`. `wireSurfaceActions()` intercepts it and calls `renderWorkspaceSurface()` without full-page navigation. Server-rendered workspace pages remain useful as source templates and direct-access fallbacks, but Chat navigation must stay inside the central surface.

## Surface hierarchy

Each loaded surface has one return row followed by one compact context kicker and the page title:

> **Back to conversation → Your Kurukoo → surface title**

The fetched `.workspace-header` is removed before the workspace content is inserted into the surface. This prevents duplicate headers and excessive vertical space. The composer remains mounted below the content and is always available for the next request.

## Continuing work without leaving a surface

When a user opens Tasks or another surface and sends a message, `state.surfaceView` remains active. The request uses the normal `/api/chat/stream` lifecycle while the current content remains visible. Agent completion, errors, and questions requiring user input appear in closeable notifications anchored at the upper-right of the central Chat content area. Dismissing one does not navigate or clear the surface; the composer is focused again and ready for the next message.

The same canonical composer owns guest identity onboarding. A standalone name is handled before intent classification, including names containing numeric characters. The flow then collects phone and OTP conversationally. Controlled development authentication identifies its local test code and states that no external SMS was sent; production-like flows distinguish an actually configured delivery adapter from a merely generated verification request. The streaming route flushes response headers only after any HttpOnly authentication-cookie migration is attached, so an in-chat OTP success cannot produce a post-auth `ERR_HTTP_HEADERS_SENT` connection failure.

This model is recommended because it combines task context with the conversational agent rather than forcing the user to return to the conversation screen for every step.

## Header overflow menu

The Chat header overflow menu is ordered as follows:

1. Pin.
2. Saved & offers — central surface.
3. Reminders — central surface.
4. Delete — destructive conversation operation and always last.

Any future non-destructive workspace link added to this menu must use `data-surface-view`. Delete must retain confirmation and authentication guards.

## UI system

Central surfaces reuse `kurukoo-chat.css` and `kurukoo-workspace.css`. Do not create a competing visual system. Use the established variables and fonts:

| Token | Role |
|---|---|
| `--chat-primary` | Terracotta action and emphasis color |
| `--chat-surface` | White/light surface or dark-mode equivalent |
| `--chat-border` | Quiet separators and card borders |
| `--chat-muted` | Secondary text |
| `--chat-charcoal` | Main text |
| `--chat-font-heading` | Space Grotesk |
| `--chat-font-body` | Inter |

Workspace actions returning to Chat use **logo → Ask**. The Kurukoo logo silhouette is preserved; the robotic quality is an external ring/sensor accent around the unchanged mark.

Responsive behavior must support 360px and wider screens. Multi-column content collapses to one column on narrow viewports, long text wraps, images are fluid, and interactive controls remain touch-friendly. Horizontal overflow is not permitted for a surface itself.

### PWA cache freshness

The Chat PWA caches an offline shell, but its canonical Chat controllers and shared style assets are freshness-sensitive. The service worker therefore keeps versioned static, page, and shell caches, while fetching `/js/kurukoo-primary-chat.js`, `/js/kurukoo-workspace.js`, `/css/site.css`, `/css/kurukoo-chat.css`, `/css/kurukoo-workspace.css`, and `/sw.js` network-first with cached fallback. This allows an installed app to recover offline without allowing an old controller or stylesheet to override a later deployment. The Chat entrypoint continues to reference canonical asset paths; temporary alias assets are not part of the product contract.

## Advert representation

Sponsored, Daily Picks, discovery, workspace promotion, and inline advert images must be active admin-managed campaigns or approved local assets seeded by `src/services/adManager.ts`. Frontend-only placeholder image URLs are not permitted. Campaign records define image, placement, category, audience/keyword, disclosure, priority, schedule, destination and CTA. The Admin advert image library exposes approved Kurukoo assets, including local informal-economy and diaspora-focused creatives.

## Rebuild checklist

When adding a new page or surface, update the route maps, title map, navigation control, central rendering behavior, shared responsive styles, tests, and this contract. Verify that the page does not introduce a second header, second composer, independent typography system, untracked image placeholder, or full-page navigation from within Chat.

## Context-aware header and inspector

When a workspace surface is active, the Chat header displays the active surface title instead of the default Agent label and reveals a compact back icon. The loaded surface itself must not add another Back to conversation control, Your Kurukoo kicker, or generic workspace sentence. This keeps the distance from the Chat header to the surface title compact and avoids duplicate navigation chrome.

The right inspector adapts to the active surface through `data-context-card` tokens and transitions between states with a short opacity/translation swap. Tasks shows request context, task status, and reminders; Discover shows discovery and nearby context; Memory and Settings show profile context; Safety shows safety controls; and the default conversation view restores the general context set. Cards must remain truthful and hidden when they are not relevant to the active surface.

Task card headings use the compact shared workspace type scale. `Verify a location`, `Update a price`, `Confirm an incident`, and `Was your recent request resolved?` must not use display-sized typography inside the central Chat surface.

## Inspector transition and in-place task execution

The right inspector is a contextual companion to the active central surface. Surface changes stage relevant cards with `is-context-entering` and `is-context-leaving`, allow the transition to settle, then hide irrelevant cards. This prevents a hard visual jump when moving between Conversation, Tasks, Discover, or another workspace. All transitions use the existing Chat tokens and stop transforming when the user prefers reduced motion.

When Tasks is active, the user can send a message without returning to Conversation. The client captures the active surface, keeps the workspace mounted, streams the agent response in the background, and publishes a bounded top-right `Kurukoo update` toast. The toast can be dismissed independently, expires automatically, and must never reset `state.surfaceView`, replace the task cards, or disable the composer after the stream finishes.

The acceptance scenario is: open Tasks; send `Please check my current task status`; confirm the Tasks title, task cards, right-rail Tasks/Reminders context, and composer remain present; confirm the top-right agent update appears; dismiss or wait for expiry; confirm Tasks remains active and the composer is ready for another message.

## Advert and workspace representation

Sponsored cards in the left rail, Daily Picks in the right rail, and promotion cards inside Daily Picks are fed from active admin-managed campaigns. Generated local-economy and diaspora creatives are approved assets with audience, disclosure, placement, category, priority, destination, and CTA metadata. No legacy placeholder image URL may be used when an active managed asset exists.


## Typography and contextual activity additions

Central surfaces use the shared responsive type scale. The Chat-generated surface title and workspace hero/panel headings use bounded `clamp()` values, balanced wrapping, and `overflow-wrap:anywhere`. Header-copy and panel-heading containers use `min-width:0` so long titles cannot expand the central grid. Task card headings remain compact, and narrow layouts step down the scale without creating horizontal overflow.

The Tasks surface may render a Community activity section from the existing public Topics authority. The client requests `/api/topics?limit=5` and renders only returned public Topic records. Each row shows the source type/location metadata, title, short body excerpt, and an Open Topic action. An empty result must show `No recent public Topics match this view yet.`; the UI must not fabricate topics or call them personalized when the source provides no matching records.

The right inspector may render Suggested next steps from the authenticated `/api/proactive/feed` endpoint. The endpoint delegates to `getOpportunitiesForFeed`, which is owner-scoped and excludes dismissed records. The card is context-filtered to Requests, Tasks, Discover, Daily Picks, and Cart via `data-context-card`; it is hidden on non-fitting surfaces. CTAs preserve the engine-provided destination and are not relabeled as completed actions.

The workspace EJS template must tolerate missing campaign data by treating an absent campaign collection as empty. This keeps central Tasks and other non-ad surfaces renderable while preserving the admin-managed campaign rule for promotional placements.


## Discover activity and shared Ask placement

Discover is the presentation surface for the canonical Discovery & Opportunity Network, not a second provider registry or map-owned source of truth. The shared `src/services/discoveryNetwork.ts` boundary owns source-attributed discovery entities, freshness, approximate location, evidence level, pagination, clustering inputs, lifecycle and attributable contributor invitations. The current Pulse presence source is synchronized into the owned discovery cache; future cached or licensed geospatial providers must implement the same provider seam, and systematic/bulk public Nominatim use is not permitted.

Discovery entities retain the lifecycle `discovered → candidate → opportunity → invited → claimed → onboarded → verified → available → executing → completed`. A discovered business, place or event is not a Kurukoo user, provider or available service until the canonical claim, onboarding, verification and availability evidence exists. The map and list expose only safe, approximate coordinates, source, freshness, evidence and lifecycle metadata. Exact coordinates and internal source references never reach the browser. `/api/discover/map` and `/api/discover/entities` use bounded viewport/radius queries, pagination, short private caching and optional clustering; stale Pulse availability expires rather than remaining visible.

Every entity selection carries an explicit Chat action descriptor such as `open_discovery_entity` with the canonical entity ID and optional conversation context. The Chat stream validates that exact ID through the Discovery Network before presenting it as context; it does not replace the entity through recency or generic semantic similarity. After the explicit open action, subsequent turns return to the normal Brain/context-arbitration path. The right-rail Nearby card remains a compact read-only projection of the same network and must not create a duplicate discovery feed.

Every central surface receives the same logo → Ask action in the generated surface heading, in the same right-aligned position. The fetched page header is still removed before insertion, so the surface cannot create a second Ask button or a second header action.

The Current request inspector copy is intentionally concise: `Request details and next actions appear here as Kurukoo works.` The redundant `Web Chat · other channels are shown only when connected` line beneath the composer is removed; the footer retains only the safety disclaimer.

## Header and product-flow boundary

The Chat header should reserve space for high-frequency, low-risk context controls. Good candidates are the existing Cart and Points actions, Notifications, Context, and overflow menu, followed only by capability-aware actions such as Call, Video, Storefront, or channel messaging when that capability is actually enabled. A disabled integration must not be represented as an active icon.

Product requests enter through natural language and are classified into `order_food`, `universal_vendor_order`, `find_worker`, or the shared product-sourcing path. The agent returns an `agentic_storefront` card containing only authoritative fields such as requirements, known seller offers, delivery candidates, provider references, indicative quotes, execution state, and bounded actions. A known offer can start one Economic Request; the card does not imply stock, availability, confirmed price, payment, or fulfilment until those authorities return their state.

A conservative product card should support progressive disclosure: show item/offer title, seller, price only if sourced, availability note, provenance/state, and one primary action such as Choose offer, with optional delivery choice and details expansion. Cart is a review surface, not proof of inventory or a checkout. The current implementation has request/offer, provider, delivery, Economic Request, payment-reference, escrow, completion, delivery-status, and dispute boundaries, but it is not a complete consumer product checkout: there is no fully implemented product catalog-to-cart-to-payment flow covering inventory reservation, confirmed quote, payment, delivery dispatch, and final fulfilment end to end. Product ordering should therefore remain marked as `ready to continue` or `awaiting confirmation` until those integrations are verified.


## Connect, Top up, Subscription, and message presentation

Connect is a setup and activation surface, not a generic channel brochure. It explains that WhatsApp, Telegram, SMS, USSD, Email, Push and Voice use the same Kurukoo identity but become connected only after provider credentials, callbacks and delivery verification are present. When Connect is active, the right inspector shows a compact Channel setup card with the current Web Chat, WhatsApp and Telegram capability states and a Manage channels action.

If a workspace route redirects a guest to login, the Chat shell must not inject that login document into the central surface. It renders a view-specific guest panel instead. Discover explains source-attributed entities and verification lifecycle; Connect explains channel evidence; and Topics explains community-context limits. The same rule applies to every auth-gated central surface: retain the shared shell and composer, present the correct surface context, and never create persistent state until authentication succeeds.

Top up and Subscription are central Chat surfaces reachable from the More navigation group. Top up explains Points and credit review while preserving payment-gated language; it must not imply that opening the surface completes a payment. Subscription explains plan review and routes the user back into conversational review, with a payment reference required before any change. Both surfaces use the same generated logo → Ask heading action and the same central surface shell.

The live Chat message presentation follows the homepage request-preview language without copying its legacy green user bubble. Assistant content remains a quiet white surface with the Kurukoo avatar, while user content uses a clean white surface with compact rounded geometry, a restrained neutral border, and icon-only actions that appear more clearly on hover or keyboard focus. Existing copy, edit, retry, delete, pin, streaming, accessibility labels and message safety behavior remain unchanged.


## Full Chat-first route and role wiring audit

All operational user surfaces are expected to load inside the central Chat shell through the shared `renderWorkspaceSurface` flow. The verified workspace registry includes Requests, Reminders, Saved & offers, Cart, Points, Top up, Subscription, Tasks, Daily Picks, Discover, Connect, Memory, Safety & check-ins, Call, Settings and Topics. Discover, Connect and Topics retain their dedicated server templates but are parsed and injected into the same central shell with the active header, shared composer and contextual inspector.

Central-surface Ask actions use the existing composer rather than navigating away. Generated surface Ask buttons focus the composer directly; imported workspace `Ask Kurukoo` actions now prevent navigation, restore their prompt into the composer, dispatch the normal input event and focus the field.

Cart is an explicit review boundary. It loads owner-scoped offer rows from `/api/cart`, supports removal, and exposes a Continue to checkout review action. Adding an offer requires an authoritative Economic Offer, preserves seller/source/provenance/media/external URL data, and uses `/api/cart/items`. Affiliate destinations are tracked through `/api/cart/affiliate-click`; the product is not represented as a local paid order when an external affiliate checkout is required. Local checkout remains payment-gated and returns the existing canonical Economic Request/payment boundary rather than creating a second order engine.

Role journeys converge on the same identity and Chat surface: consumers express requests and review offers; providers and businesses use existing verified skills, provider subscriptions, Economic Requests and offer authorities; contributors use Tasks and the existing task routes; channel users configure adapters through Connect; safety users use authenticated Safety and trusted-contact routes; referrals use the existing referral QR and idempotent reward service; administrators remain behind their existing admin routes. No guest path creates persistent reminders, orders, cart items, payment records or role-specific data without authentication.


## Hardening pass and protected Chat contract

The August 2026 mandate-hardening pass audits and repairs backend wiring, authorization, role journeys, route contracts, payment boundaries, provider evidence, channel prerequisites, referral behavior, safety persistence, and test alignment without changing the established Chat-area interface. Central surface routing, header behavior, inspector transitions, composer behavior, message presentation, workspace injection and responsive Chat layout remain protected contracts.

Production startup must fail closed when `JWT_SECRET` is missing or shorter than 32 characters. Local controlled tests may use the explicit development-only fallback with a warning. Capability readiness must continue to distinguish code present from provider configured, and no external delivery, payment, affiliate completion, KYC, verification, voice, or autonomous-agent claim may be made without the corresponding configured authority and evidence.


## Red-team runtime and advertising contract

The Chat surface must remain stable when autonomous functionality is enabled or disabled. Goal creation may preserve a bounded plan when the general runtime flag is enabled, but background evaluation and deferred re-entry require both `KURUKOO_AGENT_ENABLED=true` and `KURUKOO_AGENT_AUTONOMOUS=true`. The worker must not overlap cycles, exceed action/concurrency/retry/cooldown limits, or execute tools outside the policy registry. Tools must retain owner checks, risk declarations, idempotency declarations, and concise evidence records.

Autonomous notifications are owner-scoped and preference-aware. They must not be queued when the user has disabled agent/autonomous notifications. Goal notifications use an idempotency key derived from goal, state, and message, while generic identical internal notices are suppressed within a bounded ten-minute window. Inbox and admin unread views return one latest record per identical owner/message tuple. External delivery remains distinct from durable internal queueing and must never be represented as delivered without provider evidence.

The proactive right rail must consume the authoritative opportunity feed without creating duplicate visual cards or repeated same-day records. Suggestions are deduplicated by owner, type, and title, and dismissed suggestions must not immediately reappear unchanged. This logic must not alter the central Chat message or composer styling.

Advertising is an admin-controlled mutation. Campaign creation requires an approved non-empty asset and explicit disclosure. Public rendering accepts only active, scheduled campaigns with `asset_status=approved` and a valid local `/assets/` or validated HTTPS image URL. Placeholder, dummy, data-URI, and known stock-placeholder assets are excluded. Campaign disclosure, advertiser identity, CTA, destination, placement, and targeting remain data fields from the campaign authority rather than client-created claims. `getRenderableCampaigns()` in `src/services/adManager.ts` is the canonical eligibility boundary for public, workspace, sponsored Chat, and keyword-matched campaigns; route-level consumers must not reimplement a weaker filter.

The runtime status endpoint is administrative observability and must not disclose activation flags or worker limits to unauthenticated callers. User goal and timeline routes remain authenticated and owner-scoped. The Chat shell retains its existing header, composer, central surface, inspector, responsive, and accessibility contracts during these backend hardening changes.


## Completion milestone: secure rendering and runtime observability

The autonomous administration surface includes a shared-token, responsive Autonomous runtime readiness panel. It reads the protected `/api/agent/status` and `/api/admin/pilot-readiness` authorities and distinguishes Runtime, Autonomous worker, Concurrency, and Notifications states. It must never present autonomous execution as ready when feature flags or external prerequisites are absent.

The AI Agents console renders agent names, skills, identifiers, status badges, usage, and action controls through safe DOM construction. Agent-provided values must not be interpolated into HTML or inline event-handler strings. The console uses the shared `admin-console.css` token system, responsive grids, keyboard-visible focus states, and compact mobile breakpoints.

The central Chat workspace loader and Nearby radar renderer must not assign fetched or dynamic content through `innerHTML`. Workspace templates are cloned as DOM nodes, scripts are removed before activation, and links are wired through the existing surface contract. Dynamic radar labels use `textContent`. This security rule must preserve the existing Chat header, composer, central surface routing, message actions, inspector, responsive behavior, and visual language.


## Autonomous goal controls and runtime truthfulness

The right inspector's Current objective card may expose Pause, Resume, and Stop follow-up actions for an authenticated, owner-scoped goal. These controls use the existing `/api/agent/goals/:id/{pause|resume|cancel}` endpoints, retain the active central surface, and update the card in place. Pause changes the goal to a non-due waiting state with an evidence event; Resume schedules the next bounded check; Stop follow-up cancels the goal. Destructive cancellation must not be inferred from a generic navigation action.

The Chat client must not expose persistent autonomous-goal controls to guests, must not show a goal as connected or active without the authenticated timeline response, and must display provider/channel limitations truthfully. Runtime readiness is an admin concern and is represented through the admin-only status endpoint; it includes both activation flags and worker health telemetry rather than a vague connected badge. No user-facing surface may claim external delivery, payment, stock, dispatch, or fulfilment unless the canonical provider or request authority returned that state.


## Worker history boundary

Worker history is an admin-only operational surface. The Chat client may show the current authenticated goal state and user controls, but it must not expose worker-run records, internal cycle counts, stack traces, or provider credentials to ordinary users. Administrative runtime views may consume `/api/agent/status` and `/api/agent/runs` to distinguish disabled, idle, completed, and failed cycles without presenting provider-gated capabilities as connected.


## Deterministic failure presentation

The Chat surface must prefer a truthful, bounded error state over a synthetic fallback response. If a provider-dependent action cannot run, the user must see that the capability is unavailable or requires setup, with a clear next step when one exists. The client must not claim that a provider was dispatched, a price was checked live, a payment was completed, a reminder was delivered externally, or an account was connected unless the canonical authority returned evidence. Development-only compatibility must never be presented as production capability.


## Autonomous command and economic failure contract

When an authenticated user writes a direct autonomous control command, the Chat surface must show the resulting persisted goal state in the current conversation and must not create a duplicate intent or economic request. If economic configuration is missing or invalid, the central surface must present a truthful setup or failure state and must not display an arbitrary commission, apparent completion, or payment-ready result.


## Red-team verification and deterministic workspace behavior

The live quality harness must verify agent readiness through the admin status boundary before exercising autonomous control commands. When `KURUKOO_AGENT_ENABLED` is false, the harness must stop with an actionable configuration error; it must not report an empty autonomous objective as if the user request had been accepted without a goal.

The development-only operator reset boundary may clear stale ciphertext for the explicitly controlled operator identity before a test launch. This is test isolation only and must never alter production profile decryption semantics or clear ordinary user profiles.

The More utility navigation is collapsed by default. Its native `hidden` state must result in `display:none` and zero layout height until the user activates More. The expanded state must expose the existing utility links without changing the protected header, composer, or central-surface navigation. Every workspace Ask action must return focus to the shared Chat composer.


## Explicit skill-flow modes

The central Chat surface consumes explicit skill-flow definitions for every canonical skill. Each flow declares its requirement schema, questions, lifecycle action, payment boundary, fulfillment instructions, and one mode: `economic`, `information`, `safety`, or `coordination`. Information, safety, and coordination flows render truthful guidance or coordination surfaces without creating Economic Requests, payment states, provider matches, or external execution claims. Existing `skill_flows` rows are upgraded idempotently during initialization so legacy defaults cannot survive silently.


## Exact asynchronous continuation

Internal notifications are not merely inbox text. When an asynchronous result has a canonical context, the notification stores the owner-scoped context ID, conversation ID, canonical action, object type, object ID, owner scope, idempotency key, and surface. Its Chat link carries the same exact identity. Chat validates the referenced object through the canonical owner before reopening it; inaccessible, stale, malformed, or cross-owner references fail closed and are never replaced by a recent or semantically similar object.

The supported continuation action is `resume_canonical_context`. It is one extension of the universal Chat action protocol, not a second notification workflow. Current validated object/action pairs include agent goals, Economic Requests, discovery entities, and notifications.


### Replay-safe Economic Request actions

Structured storefront decisions such as slot submission, cancellation, quote requests, escrow confirmation, delivery dispatch, completion, and dispute review re-enter through the canonical Economic Request owner. Chat sends a bounded deterministic idempotency key derived from the active conversation, exact request ID, action, and submitted fields. The owner validates the request against the authenticated phone, persists the resulting card in `economic_request_action_events`, and returns the persisted card for a replay. In-process duplicate clicks are coalesced; later retries use the durable owner-scoped record. This protects consequential actions from duplicate execution without creating a second transaction or Chat action system.

The idempotency record is evidence of the canonical action response, not evidence that an external connector, payment provider, delivery service, or fulfilment partner completed its work. External completion still requires the existing connector and evidence boundaries.


### Assistance-to-action convergence

Question-form assistance is routed through the existing content and Topic authorities before direct provider matching or generic AI fallback when a relevant source exists. The Chat projection is source-attributed and explicitly carries `noProviderClaim` and `noExecutionClaim` truth markers. It may offer `Find verified help` as the next conversational step, but it does not convert editorial guidance, a public Topic, an affiliate reference, or a sponsored placement into a provider recommendation or availability claim. An explicit user request to find, hire, book, order, or get someone retains the canonical Economic Request flow.

This keeps the path `assistance → information/guidance → optional discovery → selection → Economic Request → execution/evidence/recovery` inside the same Chat relationship. Native Resources, Help, Topics, Discover, Requests, Tasks, Notifications and product cards remain projections of their canonical owners rather than independent state systems.


## Universal capability result integration

The central Chat surface consumes the same canonical capability/action contract used by the backend and configured channel adapters. A turn may return ordinary text, an existing structured card, a `capability_result`, progress, confirmation, evidence, failure or recovery actions. The result is presented inside the existing assistant message/workspace renderer; no second action renderer is introduced. The authenticated `POST /api/chat/action` route is the explicit execution boundary for universal capability proposals: it validates the owner, exact canonical object, conversation scope, confirmation policy and idempotency key before dispatching to the existing canonical service owner.

The browser stores only the returned presentation state and exact canonical identity needed for continuation. It does not authorize or execute actions. Supported authenticated Economic Request card decisions such as update, cancellation and provider selection re-enter through `/api/chat/action`; the returned canonical card projection is rendered in place. Other Economic Request decisions and provider-dependent actions continue through their existing canonical Economic Request route until their corresponding universal adapter is implemented, and are not treated as externally completed merely because a card was clicked. Notification, workspace, reminder, memory and agent actions preserve the explicit `contextId`, `objectType` and `objectId` or fail closed. A user can move between conversation, Economic Request, provider selection, reminder, notification, memory, agent, payment and channel context without silently switching canonical objects.

Guest surfaces remain view-specific and do not inject login documents into Chat. Capability status is displayed using the shared Chat message styles. External activation states remain visible as unavailable or externally pending until provider evidence exists.


## Emergency interrupt surface

Emergency is evaluated before onboarding, authentication and unrelated active contexts. The canonical Chat surface must not render an authentication card before initial emergency assistance. Guests can receive the emergency assessment, verified directory number, location prompt, dial option and truthful limitation state without registration. Ordinary guest actions remain subject to their normal authentication requirements.

Emergency responses render an `emergency-chat-card` inside the existing assistant message bubble. The card exposes the selected service, location state, dial state, verified number, fallback guidance, a browser dial control where supported, an approximate-location action, and an end-emergency control. The card must not claim connection, dispatch, responder acceptance, ambulance availability, diagnosis or emergency-service authority without external evidence. Returning from emergency mode preserves the prior conversation and active canonical contexts.


## Policy-first interruption contract — 17 August 2026
Before the Chat composer enters onboarding, context arbitration, FastText/Intent routing, SmolLM2 or hosted generation, the canonical turn resolves `conversationPriorityService`. The result determines whether the turn is ordinary conversation, a reminder or agent interruption, security interruption, emergency interruption, or a normal capability route. The result is persisted in canonical Chat telemetry and must not be discarded by downstream branches.

Emergency turns are guest-safe for initial help. The UI renders the existing emergency card with service, authoritative route, location state, dial state, truthful limitation copy and controls. It must not require name, phone or OTP before providing initial guidance. A browser `tel:` control is a dial option only; the card must never imply ringing, connection, dispatch or responder acceptance without evidence.

Security turns such as “My phone was stolen” and “I do not recognize this payment” render a protective `security_interruption` card immediately. The response must advise against sharing OTPs or recovery secrets and provide verified next-step guidance. It must explicitly state that ownership changes, refunds, payment cancellation, recovery and other mutations have not occurred; those actions re-enter the canonical authenticated owner, exact identity and confirmation boundaries.

An interruption must not overwrite unrelated contexts. Ending emergency mode preserves prior conversation history, while unrelated later turns are not claimed by an ended emergency session. Exact object actions continue to use the universal Chat action protocol and fail closed if the referenced object is stale, foreign, inaccessible or no longer owned.

## Attachment continuity

The canonical composer accepts a request `attachment` (image/file) per turn. Attachments are inspected by `inspectAttachmentSecurity` before they enter a turn, persisted to a `chat_attachments` ledger (sha256, mime, size, message link, owner phone, `expires_at`), and swept by the expiry job. Verified semantics:

- An attachment accompanies exactly one canonical chat turn (`processCanonicalChatTurn`), keeping evidence for the request that created it.
- Attachment byte streams are bounded by `CHAT_ATTACHMENT_BODY_LIMIT` for both `urlencoded` and JSON routes; oversized bodies fail closed at the express body layer.
- Expired attachments are removed from `stored_path` and the ledger; the message text remains but the attachment evidence is gone by design.

## Detail surfaces and identity continuity

`/topics/:slug` and `/resources/:slug` are SPA-owned detail routes served by `spaSsrService.serveSpaDetail`: the prerendered document is preferred, otherwise the built Node server entry renders the route, otherwise the route returns a truthful 503. Each route keeps its own existence guard (`getPublicTopic`, `getResourceBySlug`), so an unknown slug is 404 rather than an empty page. `/p/:providerSlug` is retired; provider content remains available through the JSON content API.
