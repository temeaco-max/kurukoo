# Kurukoo Blueprint Implementation Addendum — 2026-08-11

This addendum records implementation decisions that must be treated as the current interpretation of `BLUEPRINT.md` v5.62. It exists because the blueprint contains historical version notes as well as current architectural intent; this file records the implementation truth after the latest Economic OS refactor.

## 1. Universal Economic Request model

Kurukoo is one economic coordination system, not a collection of vertical transaction products.

```text
Conversation
  → intent
  → canonical skill
  → progressive requirement capture
  → Economic Request
  → shared capabilities
  → provider/inventory discovery
  → real availability
  → quote
  → user confirmation
  → trusted payment
  → fulfilment
  → completion
  → rating / dispute / memory
```

Category-specific requirements are configuration/data. They are not separate economic engines.

Shared capabilities include:

- discovery
- availability
- verification
- quote
- reservation
- payment
- escrow
- contract
- fulfilment
- tracking
- evidence
- cancellation
- dispute
- completion
- execution_request

### Generic Execution & Explicit Connector Authorization

The platform provides a provider-neutral execution request service (`src/services/executionConnector.ts`) and explicit connector authorization (`provider_execution_connectors`). 
- Execution requests tie action execution (e.g. `dispatch_delivery`) to an existing Economic Request and a verified participant.
- Execution **fails closed** unless an active authorization record exists for the exact provider and capability.
- Idempotency keys prevent duplicate dispatches.
- Evidence is recorded with typed payloads, `connector_reported` sources, and `pending_review` verification states, without altering the underlying request status, quote, or single-recipient escrow model.

## 2. Artist / creator / celebrity policy

Artist, creator, celebrity, DJ, MC, athlete appearance and similar talent requests are **ordinary Economic Requests**.

They must use the same customer-facing conversation and economic lifecycle as rides, food, keke, repairs, cars, tickets, workers, accommodation and product sourcing.

Artist-specific requirements are allowed where genuinely necessary, for example:

- artist or talent identity
- event type
- event date
- venue
- audience size
- performance duration
- budget
- representation/manager contact
- technical rider
- travel/accommodation requirements

Artist-specific capabilities are also allowed where justified, for example:

- representative verification
- contract generation/review
- negotiated availability
- travel coordination
- technical-rider capture
- escrow/cooling-off policy

These are **capabilities/policies on the shared Economic Request**, not a separate artist booking system.

A public artist profile does not imply availability, representation, authenticity or price. Kurukoo must verify those facts before making such claims.

## 3. Economic truth requirements

The implementation must never convert an internal database state into an unsupported real-world claim.

```text
Escrow ledger row       ≠ money held
Provider row            ≠ verified provider
Provider availability   ≠ current availability
Listed starting rate    ≠ confirmed quote
Fulfilled DB state      ≠ verified external fulfilment
Sandbox payment         ≠ production payment
```

The UI and chat copy must use precise states such as:

- verification pending
- verified
- verification expired
- provider unavailable
- starting rate
- quote requested
- awaiting payment
- payment verified
- escrow ledger active
- fulfilment in progress
- completion confirmed

## 4. Canonical skill catalogue

`src/services/skillFlows.ts` is the canonical source for:

- economic categories
- skill-to-category mapping
- requirement definitions
- capability definitions
- skill flows

Other routes/services may validate or consume this metadata, but must not create competing requirement catalogues.

## 5. Provider discovery

Provider discovery must:

1. match the requested canonical skill or valid provider capability;
2. require an explicit verification state when the UI claims verification;
3. respect the supplied location/service-area constraint;
4. use shared presence/availability where the skill requires live availability;
5. never invent distance, availability or verification data.

Precise geospatial/radius matching may be introduced when reliable coordinates/geocoding are available. Until then, text service-area matching must not be presented as GPS precision.

## 6. Universal catalogue/product ordering

Catalogue-bearing requests should converge on the shared Economic Request flow. Do not create separate order engines for food, groceries, car parts, clothing, equipment or other catalogue categories.

The intended progression is:

```text
item + quantity + location
  → provider/product match
  → product/inventory confirmation
  → real quote
  → user confirmation
  → trusted payment
  → optional delivery leg
  → completion
```

Where the current provider data model does not yet contain sufficient structured inventory data, the system must request confirmation rather than fabricate catalogue availability or price.

## 7. Chat mandate

Chat remains the primary interface. A category must not launch a separate visible "system" when the shared conversational flow can capture its requirements.

The PWA, WhatsApp, Telegram, SMS, USSD and email adapters should converge on the same underlying conversation/economic request semantics appropriate to the capabilities of each channel.

## 8. Legacy architecture

`src/index.ts` is a composition/startup boundary. `src/legacyApp.ts` is transitional page/SEO infrastructure only. New business APIs, economic engines or category-specific transaction systems must not be added to the legacy module.

Dead legacy handlers may be deleted only after route extraction and integration coverage prove they are unreachable.

## 9. Production infrastructure boundaries

The low-cost SQL.js/single-instance architecture remains valid for launch where its operational constraints are acceptable.

Move to PostgreSQL, Redis, queues, object storage/CDN or additional external services when one of these becomes a real requirement:

- multi-instance writes
- concurrent worker coordination
- production-scale presence/rate limiting
- high-volume media
- payment/transaction volume
- regulatory/provider requirements

Do not add infrastructure solely to satisfy a technology checklist.

## 10. Definition of done for economic capabilities

A skill is not considered fully implemented merely because it appears in the canonical catalogue or audit.

A production-ready skill must demonstrate, as applicable:

1. canonical intent routing;
2. requirement capture;
3. shared Economic Request creation;
4. correct provider/inventory discovery;
5. real availability semantics;
6. truthful quote semantics;
7. trusted payment integration when payment is required;
8. fulfilment/dispatch integration;
9. completion evidence;
10. cancellation/dispute handling;
11. Memory Profile integration;
12. unified conversation integration;
13. behavioural integration tests.

## 11. Implementation rule for future agents

Before changing or creating anything:

1. inspect the current repository file and relevant services;
2. search for an existing implementation of the requested capability;
3. reuse/extend the canonical implementation if it exists;
4. create a new file only when the required boundary genuinely does not exist;
5. never create a parallel artist, ride, food, car, ticket, repair or worker economic engine.

## 12. Phase 4: Frontend & Product Experience Convergence

### Core Principle
"Tell Kurukoo what you need. Kurukoo figures out who or what can fulfil it."

### Information Architecture Redesign
- **Navigation**: Simplified to Discover, How it works, Network, Channels, Resources, About.
- **Primary CTA**: "Start chatting" - seeds conversational intent.
- **Access Points**: Reframed as channels (Web, WhatsApp, USSD) into one underlying orchestration network.

### Identity & Onboarding
- **Conversation First**: Users can start requests as guests.
- **Auth Gate**: Identity intercepted only when protected actions (booking, quotes) are required.
- **Continuity**: Seamless migration of guest data to authenticated profiles via OTP verification.

### Key Terminologies
- **Orchestration Network**: The product model.
- **Request / Conversation**: The user-facing interaction.
- **Fulfillment**: The outcome.
- **Capability**: The functional match.

### Visual System
- **Canonical Hero**: Exact language hierarchy enforced on homepage.
- **Icon Language**: Consolidated semantic icons for fulfillment, providers, and agents.
- **Dashboard**: Rethought as "Request Hub" focusing on active conversations.

239	## 13. Phase 5: Product Truthfulness & Integration Boundaries
240	
241	### Truthful Availability
242	The public surface must not guarantee verified availability, payment, or fulfillment where its integration adapters are not configured.
243	- **Channel Availability**: Homepage, Channels, and Help pages must show only Web Chat as active. WhatsApp, USSD, and SMS are "not connected" until their messaging/carrier adapters are configured.
244	- **Fulfillment Promises**: Claims of "instant matching," "verified providers," "secure escrow," or "real-time dispatch" must be reframed as conditional request paths.
245	- **SEO/SEO Copy**: Programmatic and Explore category pages must use conditional language ("eligible requests," "next supported action") rather than guaranteeing outcomes.
246	
247	### Identity & Intent Continuity
248	- **Guest Auth Gate**: The guest identity gate must retain the safe "continuation card" (e.g., a storefront projection) so it can be restored immediately after the user authenticates.
249	- **Onboarding Bypass**: Profiles claimed from a guest session are marked `onboarding-complete` to prevent the conversational flow from being diverted into a generic welcome survey.
250	- **Auth Consolidation**: Authentication routes are owned by `src/routes/authRoutes.ts`. The Chat Router must not own duplicate auth endpoints.
251	
252	### Deployment-Specific Content
253	- **Pricing & Points**: The pricing page must truthfully state that no payment provider is configured for the current deployment.
254	- **Contact Guidance**: The contact page directs all operational support through Web Chat and provides only conditional guidance for other channels.
255	- **Partnership Scope**: Partnership claims are framed as "scoped roles" and "discussions" rather than pre-existing deployment promises.


## 14. Phase 6 & 7: Native Assistance Within the Conversation

Native assistance is a first-class part of the conversation-first product, but it is not an Economic Request by default.

- **Reminders** are persisted against the authenticated phone-based Memory Profile, written back to the shared `messages` conversation, and processed by the existing single-instance background worker. They use `src/services/reminderService.ts` and the owner-scoped `/api/reminders` boundary.
- **Conversational Parsing**: Reminders support relative units (minutes, hours, days) and absolute times (e.g., "tomorrow at 9am").
- **Identity Gating**: A guest may express a reminder intent, but persistence is gated until the user has an authenticated profile. The auth gate preserves the conversational intent without creating an anonymous reminder record.
- **Economic Boundary**: A reminder must never create a lead, provider request, payment action, escrow record, or Points charge. `chatRouter` explicitly excludes the `reminder` skill from generic order finalisation.
- **Personal safety contacts and check-ins** use the owner-scoped `/api/safety/*` boundary.
- **Consent Activation**: Safety contacts default to `pending` and require explicit owner consent through the `/api/safety/contacts/:id/activate` endpoint before they can be used for check-ins.
- **Escalation Boundary**: A missed check-in becomes `escalation_pending` until an authorised delivery adapter produces evidence. The application must not claim a contact or emergency service has been notified without that evidence.
- **Discovery and Management**: The canonical Web Chat context inspector (right sidebar) provides a unified surface for listing, creating, and cancelling reminders and safety contacts/check-ins.
- **Route Ownership**: Reminder and safety routers attach `authenticateUser` to their declared endpoints. They must not use a router-wide authentication middleware when mounted at `/api`, because that would intercept unrelated API routes and violate canonical route ownership.

These capabilities reuse the single profile, conversation, and background-worker boundaries. They do not introduce a second user model, notification system, safety-dispatch system, or economic lifecycle.

**Validation:** `scripts/test-native-assistance.ts` covers owner isolation, guest gating, route authentication, scheduled-message idempotency, fail-closed escalation, absolute parsing, and the prohibition on reminder-created economic lead orders.

## 15. Phase 9: Final Convergence Hardening

The final convergence pass confirmed that Kurukoo already had the canonical shared rate-limiting middleware in `src/middleware/rateLimit.ts`. OTP requests use `authRateLimit`, payment and escrow mutation routes use `paymentRateLimit`, AI and webhook boundaries have dedicated buckets, and authenticated routes retain their separate authenticated-request guard. A second sensitive limiter was deliberately not retained because it would duplicate policy and create inconsistent throttling semantics.

The Request Hub remains the only authenticated `/web` request-management surface. `public/dashboard.html` is the current Request Hub shell and routes users back to the canonical Web Chat, discovery, resources, and profile boundaries; no application-level GitHub workspace service or GitHub admin route remains in `src`.

Economic Request transitions now append structured `economic_request_transition` records to `audit_logs`, including request ID, owner phone, skill, prior status, and next status. The local audit trail improves lifecycle traceability without asserting that it is an immutable compliance log or replacing production observability.

The sandbox payment boundary remains intentionally non-production. It can validate local ledger and escrow invariants, but it does not represent a real PSP, regulated escrow account, external payment settlement, or provider payout. Those integrations remain deployment work rather than fabricated product capability.

**Validation:** `npm run lint`, `npm run build`, `npm run test:routes`, `npm run test:native-assistance`, `npm run test:conversation-first-auth`, `npm run test:economic-lifecycle`, `npm run test:provider-entities`, `npm run test:execution-boundary`, `npm run audit:security`, `npm run audit:economic`, and `npm run audit:services` all passed on the convergence branch.


## 16. Phase 10: Deferred Fulfilment, Notifications, and Observability

Deferred Economic Request continuity is handled by the existing `open_intentions` service and background worker. Due requested, awaiting-match, and partially matched intentions are re-checked within the configured attempt and TTL boundaries; expired intentions are marked `abandoned` with an `expired` resolution. When a provider is found, the worker may progress the linked Economic Request to matching and quoting only when the provider data supports a positive quote. A provider match without a valid quote remains explicitly partial and does not create a payment or escrow effect.

External push delivery remains unconfigured and is not represented as successful. Instead, the existing push boundary now persists an owner-scoped `internal_notifications` inbox record as a durable fallback, while returning `false` to preserve the distinction between queued internal delivery and external FCM delivery. Authenticated users can retrieve and mark their own records through `/api/notifications` and `/api/notifications/:id/read`; no user can read or mutate another user's notification.

The public `/health` endpoint now reports active Economic Requests, scheduled reminders, and active safety check-ins in addition to database and payment-adapter state. The authenticated admin `/api/admin/stats` endpoint reports grouped request, reminder, safety-check-in, and unread internal-notification counts. Both observability surfaces use the service-owned table names and fail safely when an optional table has not yet been initialized.

High-value category flows now include idempotent tailored records for `taxi_quick`, `street_food_cart`, `food_nearby`, `phone_repairer`, and `roadside_mechanic`. These flows refine questions, post-match action, payment model, and fulfilment guidance while retaining the shared capability source, provider authorization, Economic Request transitions, quote boundary, escrow boundary, and completion controls. Existing seeded aliases such as `rider`, `phone_repair`, and `emergency` are mapped into the canonical taxonomy rather than treated as parallel economic systems.

**Validation:** In addition to the Phase 9 checks, `npm run test:notification-queue`, `npm run test:skill-flows`, `npm run test:native-assistance`, `npm run audit:services`, `npm run audit:security`, `npm run audit:economic`, `npm run test:routes`, and the full TypeScript/build validation passed after these changes.


## 17. Phase 5/6 Final Truthfulness and Native Assistance Hardening

The final public-surface audit confirmed that the active deployment boundary is Web Chat plus the authenticated internal notification inbox. Public templates, generated opportunity links, SEO fallback copy, onboarding questions, admin campaign actions, and admin observability panels no longer generate or claim WhatsApp, USSD, SMS, FCM, app-store, IoT, autonomous-hardware, guaranteed wholesale, or unsupported payment/delivery behavior. Where external channels are mentioned for transparency, they are explicitly marked unavailable or conditional on a configured adapter and delivery evidence.

The legacy external-channel keep-alive analytics route and its unreferenced service were removed. Startup no longer launches the external-channel session scheduler. Conversation activity now updates the generic Memory Profile activity timestamp only; it does not create channel-fee analytics, deep links, FCM pushes, or session-reset claims. Admin analytics now reads canonical `/api/admin/stats` data for internal notifications, reminders, safety check-ins, and Economic Request counts. The admin safety count uses the canonical `safety_checkins` table.

The primary Web Chat now contains an accessible live Native Assistance status region. Active reminders due within 24 hours and safety check-ins expiring within two hours are surfaced without requiring the context inspector to be opened. Safety messaging preserves the non-emergency boundary and explicitly states that no contact is notified automatically without a configured delivery service. The context inspector retains owner-scoped consent, completion, revocation, and error feedback behavior.

Deferred matching is now guarded against overlapping worker passes. Partial matches consume a bounded retry attempt and schedule a future check, while malformed intentions also consume an attempt rather than remaining permanently due. A provider match without a valid quote remains partial and cannot create a payment or escrow effect.

**Validation:** `npm run lint`, `npm run build`, `npm run test:admin`, `npm run test:chat-dom-safety`, `npm run test:native-assistance`, `npm run test:economic-lifecycle`, and `npm run test:notification-queue` passed after this hardening. `FRONTEND_PAGES.md` and `homepage_copy.md` remain synchronized with the current extensionless route registry and Web Chat-only deployment boundary.

## 18. Phase 5/6: Login via Chat, Request Hub Dynamic Data, and CSS Consolidation

The login-via-chat flow was hardened by consolidating guest migration logic into the canonical `authRoutes.ts` and removing the redundant `/claim` route in `chatRouter.ts`. The `auth_gate` card in the chat interface was refined with better UX and consistent semantic tokens, ensuring a seamless handoff from guest intent capture to authenticated session resumption.

The Request Hub (`dashboard.html`) was upgraded from static placeholders to dynamic data fetching. It now retrieves the user's Memory Profile (name, points) and their 10 most recent Economic Requests via a new `GET /api/chat/economic-requests` endpoint. The "Profile" link was corrected to avoid redundant login prompts, and already-authenticated users are now redirected from `/login` to their destination.

CSS was consolidated across the core authentication and management surfaces. New standardized stylesheets `kurukoo-auth.css` and `kurukoo-hub.css` were created using the shared platform tokens. This ensures visual consistency across the homepage, login page, chat interface, and Request Hub while removing internal style blocks and inline styles.

**Validation:** `npm run lint`, `npm run build`, and the existing `test:conversation-first-auth` regression suite passed. The Request Hub and Login surfaces now align with the "Living Economic Profile" aesthetic and use canonical platform boundaries for all data and authentication.

## 17. Phase 11: Complete Platform Convergence (Final)

I have completed the exhaustive implementation of Phase 6, ensuring the platform works as a coherent, conversation-first fulfillment network.

### Key Convergence Accomplishments
- **Conversational Identity**: Guests are no longer diverted to a separate login page. The identity capture (Name -> Phone -> OTP) happens entirely within the chat stream, preserving context and intent.
- **Unified Workspace**: The chat interface now features a collapsible sidebar with the actual Kurukoo logo, providing direct access to Requests, Reminders, Safety Contacts, and Settings.
- **Dynamic Request Hub**: The `/web` surface is now a data-driven dashboard that aggregates the user's active requests, upcoming reminders, and personal safety contacts from canonical backend sources.
- **Truthful Availability**: The Channels page and sidebar panel dynamically reflect the status of Web Chat (Connected) vs. WhatsApp/SMS (Coming Soon) without misleading the user.
- **Professional Hardening**: Scrubbed "instant", "guaranteed", and unconfigured channel claims from all service prompts, SEO copy, and marketing materials.
- **Architecture Integrity**: Consolidated auth migration, removed legacy keep-alive analytics, and tokenized all remaining frontend styles.

**Validation:** Full build, lint, and regression suites passed, including `test:conversation-first-auth`, `test:native-assistance`, and `audit:economic`. The platform is now fully converged and truthful.
