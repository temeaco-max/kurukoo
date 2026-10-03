# Kurukoo Master Product Completeness Ledger

**Status:** Active, repository-level product memory and completion authority.
**Purpose:** Prevent any feature, capability, page, component, state, user job, navigation path, monetisation surface, client representation, Admin control, content/SEO requirement, or truth boundary from being forgotten during visual convergence, refactors or cross-client implementation.

## Governing rule

Visual design is a presentation authority, never the product-completeness authority.

A feature/page/component is not complete because:
- it appears in a visual reference;
- it has a route;
- it has a feature-registry entry;
- it has a backend service;
- its happy path works;
- its UI is visually polished.

A product capability is complete only when the applicable dimensions below are covered:

1. Purpose and audience.
2. Real-world user jobs/outcomes.
3. Information architecture/content.
4. Primary, secondary and recovery actions.
5. Empty/loading/pending/needs-input/success/failure/unavailable/cancelled states.
6. Canonical data/service authority.
7. Identity/permission/consent boundaries.
8. Evidence/truth boundary.
9. Navigation/deep-link/continuation path.
10. Chat/Agent handoff when applicable.
11. SEO/indexability/metadata/schema for public surfaces.
12. Accessibility/focus/keyboard/touch requirements.
13. Web/PWA/iOS/Android representation where applicable.
14. Admin/operator representation where operational control is required.
15. Monetisation/payment/commercial truth where economic.
16. Observability/audit/recovery where consequential.
17. Behavioural/regression coverage.
18. External activation status explicitly separated from repository readiness.

## Product definition

Kurukoo is a conversational operating system for coordinating everyday intentions with people, services, products, places and bounded agents. The conversation is the universal control surface; Desk is the authenticated personal operating environment; Agent is the conversational intelligence; durable objects such as Requests, Tasks, Opportunities, Agents, Providers, Connections, Memory and Artifacts carry persistent state. External fulfilment is always evidence-gated. See `CURRENT_PRODUCT_TRUTH.md`, `BLUEPRINT_TRUTH.md` and `AGENTS.md`.

## URL/product hierarchy

```text
Public product/discovery
  / /about /features /discover /network /channels /topics /resources
  /how-it-works /help /contact /pricing /partners /advertise /careers /blog
  /developers /legal /cookies

Authentication
  /login /signup

Conversation
  /chat /chat/:conversationId /share/:shareId

Authenticated operating environment
  /desk
  /discover /topics /requests/:id /tasks/:id /reminders/:id /saved /cart
  /connect /connections/:id /agents/:id /capabilities /opportunities/:id
  /wallet /points /top-up /subscriptions /checkout /confirmations
  /memory/:id /artifacts/:id /prayer /call /notifications /safety /settings

Operator control plane
  /admin/*

Backend contract
  /api/v1/*
```

Legacy `/app/*`, `.html` Admin modules, and legacy aliases are compatibility mechanisms, not product-facing canonical architecture.

## Surface families that must remain represented

### Public product/content

Home; About/Overview; Features; Explore; Discover; Network; Channels; Topics list/detail; Resources list/detail; How It Works; Help/Support; Contact; Pricing; Partners; Advertise; Careers; Blog/Media; Developers/API docs; Legal/Terms/Privacy/Safety; Cookies; disclaimers and product/claim disclosures; offline and operational public states.

Public pages must have search intent, semantic heading structure, meaningful copy depth, internal links, canonical URLs, indexability policy, structured data where appropriate, truthful examples and a contextual Chat/Agent continuation where useful.

### Desk/authenticated OS

Desk; Agent/Chat; Discover; Topics; Requests; Reminders; Saved; Cart; Tasks; Connect; Agents; Capabilities; Opportunities; Wallet; Points; Top Up; Subscriptions; Checkout; Confirmations; Memory; Artifacts; Prayer; Call; Notifications; Safety; Settings.

Private screens optimise for work completion and continuity, not public SEO.

### Agent/conversational intelligence

Natural semantic interpretation; conversation context; reference resolution; topic switching; interruptions; corrections; ambiguity; multi-goal continuity; clarification; proposal vs execution distinction; confirmation/cancellation; tool/action cards; request/goal state; context inspector; search; attachments; voice; notifications; safety interruption; auth continuation; offline/reconnect; deferred work; provider/evidence state; truthful unavailable states.

### Agents/autonomy

Agent identity/persona; owner; goals; plans; tool/capability scope; approval policy; risk; runtime; action history; retry; pause/resume/cancel; budget/quota; evidence; escalation; learning/curation boundaries; admin operator controls.

### Providers/network

Provider profiles; entity type; capabilities; verification; evidence; availability; presence; coverage; trust; ratings/reviews; provider leads; offers/quotes; communications; requests; fulfilment; disputes; participation roles; onboarding; partner relationships.

### Monetisation/economy

Points; wallet/payment; Top Up; subscriptions; plans/entitlements; provider leads; commissions; referrals; advertising; promoted discovery; seller offers; cart; checkout; quotes; Economic Requests; escrow; refunds; disputes; cancellations; affiliate boundaries; agent economy; Money Circle; regional pricing.

Every monetary surface separates review/authorization/provider acceptance/settlement/fulfilment and never claims payment success without canonical evidence.

### Admin/control plane

Control Room; Conversations; Providers; Economic; Requests/Orders; Moderation; Compliance; Notifications; Integrations; Agents; Users; Pricing; Referrals; Commissions; Partnerships; Trust/Scam; Social; Creators; Celebrity; Analytics; Revenue; Marketing; Advertising; Content; Curation; Settings; SEO; Roadmap; configuration/key readiness; operator/test actors; platform readiness; external activation status; audits.

Admin follows `scope/header -> search/filter -> queue/list/table -> detail -> evidence -> action -> confirmation -> audit/recovery`.

### Cross-client parity

Web; PWA; iOS; Android; Admin. Shared semantic/product contracts; native-specific layout/navigation mechanics; one canonical identity/memory/request/payment/agent/provider source of truth. Canonical web resources deep-link into native screens where supported.

## Demo-data requirement

The development operator/test environment must contain deterministic, clearly seeded data for:
- active, requested, quoted, in-progress, fulfilled and cancelled Requests;
- providers with verification, capabilities, ratings, availability/presence;
- offers/provenance and quote states;
- cart items and economic transitions;
- Saved items;
- reminders in multiple states;
- notifications read/unread and deep links;
- Agent goals active/paused/completed;
- realistic multi-turn conversations and corrections/topic switches;
- Topics and replies;
- Tasks in available/completed states;
- provider/network and commercial states needed to render dense screens.

Seed data must be development-only, idempotent, versioned, resettable and excluded from automated test state.

## Admin configuration/key management

Admin must have a secret-safe configuration catalogue with:
- environment variable name;
- subsystem;
- sensitivity class;
- required/optional state;
- configured/unconfigured status;
- dependent capabilities;
- safe public/internal display where appropriate;
- explicit `never expose secret` policy;
- readiness and external activation semantics.

Actual secret mutation must occur through the deployment/secrets-management boundary, not a browser-visible `.env` editor.

## Brand/UI system

One site-wide Kurukoo brand primitive authority must govern:
- logo/wordmark/icon variants;
- header/footer/auth/Desk/Admin usage;
- favicon/app icon;
- icon family and semantic naming;
- optical icon sizes and alignment;
- button/icon-label spacing;
- accessibility labels;
- light/dark and background rules;
- no route-specific re-drawn logo/icon systems.

Visual designers may change placement, spacing and hierarchy while preserving the semantic primitive identity.

## Status vocabulary

Use repository truth vocabulary consistently:
`IMPLEMENTED_AND_VERIFIED`, `IMPLEMENTED_PARTIALLY_WIRED`, `IMPLEMENTED_FEATURE_FLAGGED`, `PROVIDER_DEPENDENT`, `FOUNDATION_ONLY`, `NOT_IMPLEMENTED`, `SUPERSEDED`, `OBSOLETE`.

Never collapse provider-dependent or feature-flagged work into a success state in product copy/UI.

## Evidence sources that must remain synchronized

- `BLUEPRINT.md`
- `BLUEPRINT_IMPLEMENTATION_ADDENDUM.md`
- `docs/architecture/BLUEPRINT_TRUTH.md`
- `docs/architecture/CURRENT_PRODUCT_TRUTH.md`
- `docs/architecture/CAPABILITY_MATRIX.md`
- `docs/architecture/CAPABILITY_MODEL.md`
- `docs/architecture/CLIENT_APPLICATION_CONVERGENCE.md`
- `docs/architecture/CLIENT_FEATURE_COVERAGE.md`
- `docs/architecture/ACTIVE_AGENT_BOUNDARIES.md`
- `CHAT_SURFACE_CONTRACT.md`
- `docs/architecture/KURUKOO_PAGE_ARCHITECTURE_MATRIX.md`
- `src/services/platformFeatureVisualRegistry.ts`
- `src/services/clientSurfaceRegistry.ts`
- `src/services/canonicalUrlRegistry.ts`
- `src/services/pageContentContracts.ts`
- `src/services/productCompletenessContract.ts`
- `src/services/adminConfigMetadata.ts`
- `src/services/crossClientCompletenessContract.ts`
- `src/services/demoWorkspaceSeed.ts`

## Current known completion classes

### Strong repository foundations

Conversation-first Chat; semantic-first interpretation; canonical intent/action boundary; Economic Request lifecycle; notification authority; Topics; referrals; Points; advertising; canonical skill registry; capability projection; native/Web shared contracts; clean URL registry; provider verification boundaries; PWA shell/offline architecture; controlled development actors; deterministic demo workspace fixtures; product/page/content completeness gates.

### Implemented but partial/feature-flagged/provider-dependent

Agents/autonomous execution; live subscriptions/payments; FCM/push approval; WhatsApp/Telegram linked-device activation; email/phone OTP delivery; provider onboarding/availability; WebRTC; private number masking; MQTT/IoT; some PWA installed-device behaviours; location/background device behaviour; external storage; external fulfilment/dispatch.

### Must not be forgotten in visual/content rebuild

The page may require more content/controls than the visual reference contains. Restore purpose-specific information architecture, states, actions, recovery, provenance, evidence, navigation and truthful disclaimers before applying visual polish.

## End-to-end completion gate

A future completion claim must answer all of these:

1. What is Kurukoo's purpose here?
2. What user outcome does this enable?
3. Where is the capability represented?
4. What is the canonical owner?
5. What data/state is shown?
6. Which states exist?
7. What actions can the user take?
8. How can they recover/cancel/continue?
9. How does Chat/Agent continue the work?
10. What are the evidence/truth boundaries?
11. What are the public SEO/content requirements?
12. How do Web/PWA/iOS/Android represent it?
13. What does Admin control or observe?
14. What monetisation/payment boundaries apply?
15. What external activation is still required?
16. What behavioural test proves the repository path?
17. What live/device/provider validation remains?

If any applicable answer is missing, the capability is not end-to-end complete.
