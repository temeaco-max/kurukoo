# Kurukoo Page Architecture Matrix

**Status:** Active product specification
**Purpose:** Ensure Kurukoo's visual convergence never removes information, functionality, navigation, SEO structure, state coverage, or truth boundaries that a real-world page or capability requires.

## Governing rule

**Visual design governs presentation, not product completeness.** A visual reference may determine hierarchy, spacing, typography, component treatment, density, colour, motion and composition. It may not be used as the reason to remove a section, workflow, state, action, navigation path, SEO requirement, data relationship, evidence boundary, or capability that belongs to the page's real-world purpose.

Every surface must satisfy all of these dimensions before it can be marked complete:

1. Purpose and audience are explicit.
2. Real-world user jobs are covered.
3. Required information architecture is present.
4. Primary, secondary and recovery actions exist.
5. Navigation and cross-surface continuation exist.
6. Empty, loading, pending, needs-input, success, failure, unavailable, cancelled and recovery states are appropriate to the surface.
7. Canonical data/authority ownership is explicit.
8. Trust/evidence boundaries are visible where relevant.
9. SEO/indexability is correct for the surface type.
10. Accessibility, focus, keyboard and touch requirements are satisfied.
11. Desktop and responsive composition use the shared visual system without deleting content.
12. The visual surface does not claim an external/provider/payment/fulfilment outcome without canonical evidence.

## Surface classes

### Public discovery / SEO surfaces

These pages are public, searchable, shareable and should answer a defined user/search intent before asking the user to enter Chat.

| Surface | Primary purpose | Required content | Required actions / navigation | SEO requirements |
|---|---|---|---|---|
| `/` Homepage | Explain Kurukoo and establish the conversation-first value proposition | Hero/value proposition; what Kurukoo is; how conversation coordinates work; core capabilities; trust/evidence explanation; network/people/services/products explanation; examples; how it works summary; FAQs; final Chat CTA; footer discovery links | Start Chat; Explore; Discover; Network; Topics; Resources; Help; About; legal/privacy | Unique title/description; canonical; meaningful H1; structured data where applicable; crawlable internal links; FAQ where truthful |
| `/explore` | Let visitors explore what Kurukoo can help with | Search/discovery intent; capability families; example requests; category navigation; related Topics/Resources; Chat handoff | Search; open category; start Chat; related content | Search-intent title; category/index text; crawlable links |
| `/discover` | Public discovery of nearby/useful opportunities | Discovery explanation; candidate/result cards; source/provenance; availability/truth boundaries; map/list when applicable; Topics/Offers relation | Inspect; continue in Chat; filter/search; location permission explanation | Discover intent; location/availability claims must be truthful |
| `/network` | Explain the opportunity/fulfilment network | Network roles; provider; contributor; business; agent; opportunity; verification; evidence; lifecycle from request to outcome; what Kurukoo does not guarantee | Join/participate; explore providers/opportunities; Chat | Network/fulfilment intent; Organization/FAQ/Breadcrumb schema where appropriate |
| `/channels` | Explain access through channels | Web Chat; WhatsApp; Telegram; SMS; Email; USSD; voice; linked-device boundaries; provider-readiness truth | Connect/readiness; Chat; channel-specific help | Channel intent; no false activation claims |
| `/topics` | Community shared knowledge/discovery | Topic categories; search; topic list; source/context; moderation/reporting; related content; Chat continuation | Open topic; reply when authenticated; report; start related Chat | Topic/listing SEO; canonical; pagination/indexation strategy |
| `/topics/:slug` | Answer a durable shared question/report | H1; author/context boundary; replies; timestamps; moderation/reporting; related topics/resources; related Chat prompt; source/claim labels | Reply; report; save; continue in Chat | Unique title/description; Article/Discussion schema where appropriate; canonical |
| `/resources` | Curated knowledge/library | Resource categories; search; editorial summaries; freshness; source attribution; related topics; related Chat prompts | Open resource; search; continue in Chat | Resource listing SEO; indexable collection structure |
| `/resources/:slug` | Provide useful long-form resource | H1; summary; sections; sources; updated date; author/editorial ownership; related resources/topics; FAQ where appropriate; Chat continuation | Search within; share; Chat; related links | Strong content SEO; Article schema where appropriate; canonical; internal linking |
| `/how-it-works` | Explain Kurukoo's real interaction model | Tell Kurukoo; understand; clarify; discover; verify; confirm; execute; evidence; continue; examples; edge/failure truth; FAQ | Start Chat; Explore; Network; Help | How-to/product intent; structured headings; FAQ |
| `/about` | Establish identity, mission, principles and trust | Mission; product philosophy; conversation-first OS explanation; truth/evidence principles; company/team context that is actually publishable; contact/legal links | Chat; Help; Contact; Careers | Organization/AboutPage schema where appropriate |
| `/help` | Self-service support | Getting started; navigation; auth; requests; memory; reminders; safety; channels; payments; privacy; troubleshooting; contact/escalation | Search help; start Chat; contact; relevant route deep-links | Help centre SEO; breadcrumbs |
| `/contact` | Human support/contact | Reasons to contact; form; identity/field explanation; response expectations; anti-spam; alternate support path; success/error states | Submit; Help; Chat | ContactPage schema; indexability as appropriate |
| `/careers` | Recruit/apply | Mission; roles; culture; role list; process; contact/application route; legal/privacy | View/apply role; contact | JobPosting schema only for real roles |
| `/partners` | Explain partner/provider participation | Partner types; capabilities; requirements; evidence; onboarding; commercial truth; verification; support | Apply/join; provider info; Chat | Partner intent; organization schema where applicable |
| `/advertise` | Advertising product/eligibility | Who can advertise; formats; placement; pricing/readiness; targeting/privacy boundaries; creative requirements; moderation; campaign lifecycle; contact | Start campaign; contact sales; policy | Advertising intent; no private-Chat targeting claims beyond canonical boundary |
| `/pricing` | Explain product/plan economics | Plans; entitlements; points vs cash distinction; provider-facing vs consumer; what is included; external payment state; FAQs | Compare; subscribe; Chat | Pricing/Product schema where truthful; exact plan names; canonical |
| `/blog` | Product, ecosystem and community editorial | Published updates, stories, guides and references; date and author/source where available; related resources; unavailable/empty state | Browse; open article; return to resources or Chat | Article/Collection metadata only for published canonical content; no fabricated update claims |
| `/legal/*` | Legal disclosure/readability | Active document; section nav; effective date; version; contact; privacy/security references; print-friendly reading | Navigate sections; Help; Contact; privacy/cookies | LegalDocument/Article-style metadata; no thin content |
| `/api-docs` | Developer integration docs | Overview; auth; API concepts; endpoints; request/response examples; webhooks; errors; rate limits; security; SDK/contact; versioning; changelog | Copy examples; navigate sections; contact; status | Developer/docs SEO; canonical; code snippets accessible |
| `/offline` | Truthful offline state | What is unavailable; what remains local; retry; return; install/update context; no false delivery | Retry; return Chat | noindex / operational |

### Authenticated conversational OS surfaces

These surfaces are private and should optimize for work completion and continuity, not public SEO.

| Surface | Primary purpose | Required sections / components | Primary actions |
|---|---|---|---|
| `/app` / `/app/agent` | Universal personal control surface | Current conversation entry; active goals; pending attention; recent continuity; reminders/tasks summary; notifications summary; request summary; agent status; recovery/return-to-Chat | Open Chat; resume goal/request; inspect pending item; create/continue |
| `/app/discover` | Personal discovery | Search/filter; nearby/discovery results; source/provenance; availability state; Topics/Opportunities; saved/follow/watch; location consent; Chat handoff | Inspect; save; follow/watch; continue in Chat |
| `/app/topics` | Personal Topic interaction | Topic list; search; category; saved/followed; authored/replied items; moderation/reporting | Open; reply; report; save; Chat |
| `/app/requests` | Manage Economic Requests | Attention queue; active; waiting/deferred; needs input; completed; cancelled; detail; originating conversation; provider/evidence; quote/payment state; next action; cancel/dispute/recover | Open detail; continue Chat; supply missing info; cancel; retry/recover |
| `/app/reminders` | Manage reminders | Today/upcoming/overdue/completed; reminder detail; originating conversation; notification state; recurrence; pause/resume/cancel | Create/edit/pause/resume/cancel; Chat |
| `/app/saved` | Owner-scoped saved context | Saved items/offers; source; date; follow/watch state; originating conversation/topic; remove/save; stale/unavailable treatment | Open; continue; remove; move to request/cart where permitted |
| `/app/cart` | Prepare economic action | Cart groups; sourced item/offer provenance; quantity/options; availability truth; request transition; subtotal where canonical; payment boundary; empty/error states | Review; remove/edit; request/checkout; return Chat |
| `/app/tasks` | Manage tasks/contributions | Today/upcoming/overdue/completed; source; reminder relationship; agent relationship; evidence; attachment/artifact; task detail | Complete; pause; reschedule; attach evidence; open originating context |
| `/app/connect` | Manage connected resources/channels | Storage; channels; linked devices; source permissions; readiness; connection health; pairing; revoke; last sync; unsupported/unconfigured states | Connect; pair; authorize; revoke; retry; inspect readiness |
| `/app/agents` | Agent directory/runtime | Agent identity; role/persona; active goals; runtime state; tool/capability scope; risk/approval; budget/usage; pause/resume/cancel; retry/failure; evidence | Create/manage goal; pause/resume/cancel; inspect |
| `/app/capabilities` | Capability portfolio | Roles/capabilities; evidence; availability; skill coverage; profile completeness; contributor/provider/buyer/seller roles; verification state | Add/update capability; verify; manage availability |
| `/app/opportunities` | Opportunity view | Opportunity source; fit/relevance; eligibility; evidence; invitation/claim/participation state; related capability; expiration | Inspect; accept/decline/claim; Chat |
| `/app/wallet` | Economic account state | Balance; ledger/history; pending/failed; top-up boundary; Points separation; subscription/entitlement relationship; payment readiness | Inspect; top up; open points/subscription; recovery |
| `/app/points` | Closed-loop Points | Balance; earn/spend/reward history; qualifying actions; contributor rewards; non-cash disclosure; disputes/reversals where applicable | Inspect; earn/spend where supported; history |
| `/app/top-up` | Add funds | Amount; payment method readiness; fees if canonical; review; confirmation; failure/retry; sandbox/unconfigured state | Review; authorize; retry; return Chat |
| `/app/subscriptions` | Plans/entitlements | Current plan; features; renew/cancel/change; billing readiness; trial/expiry; payment evidence | Compare; subscribe/change/cancel; recover |
| `/app/checkout` | Final economic review | Request identity; sourced offer; item/quantity; provider/evidence; price/quote; payment state; confirmation boundary; cancellation; recovery | Confirm; pay when available; edit/cancel; return |
| `/app/confirmations` | Outcome/continuation | Request identity; lifecycle; evidence; payment; provider coordination; notifications; completion/cancellation; recovery; originating Chat | Continue; cancel; dispute; repeat; Chat |
| `/app/memory` | Owner-scoped memory | Active facts; categories; provenance semantics; scope; confidence; proposed/suggested; revoke/delete; privacy/retention; empty/error | Inspect; revoke; manage; Chat |
| `/app/artifacts` | Manage generated/connected artifacts | Files; recordings; transcripts; owner scope; source; storage readiness; download/open; retention; delete/revoke | Open/download/delete; Connect storage; Chat |
| `/app/prayer` | Prayer companion | Current request/context; prayer content; routines; reminders; artifacts; voice boundary; privacy | Start prayer; save; reminder; voice |
| `/app/call` | Voice/peer communication | AI voice readiness; peer-call readiness; consent; participant identity; session status; connection/recovery; recording/artifact disclosure | Start/end; retry; inspect; artifact where available |
| `/app/notifications` | Notification centre | Urgent/attention; request/reminder; channels; read/unread; originating object; delivery state; permission/device state | Open; mark read; continue; settings |
| `/app/safety` | Safety/check-in management | Check-in status; trusted contacts; consent; overdue; resolution; emergency boundary; incident continuity | Start/update/end check-in; manage contacts; emergency path |

### Chat and conversation surfaces

Chat is not merely another page; it is the universal interaction surface. Its information architecture must cover:

- conversation list/history;
- new conversation;
- active conversation;
- message stream;
- typing/activity state;
- voice state;
- composer/actions/attachments;
- context inspector;
- current request/goal;
- memory context;
- Nearby/discovery context;
- notifications;
- continuation cards;
- skill requirement capture;
- Economic Request cards;
- deferred/waiting states;
- provider/evidence states;
- confirmation/cancellation;
- errors and retries;
- guest/authenticated boundary;
- sign-in continuation;
- channel continuation;
- offline/reconnect;
- safety/emergency interruption;
- agent pause/resume/cancel;
- natural-language clarification without forcing users through forms unnecessarily.

The Chat visual system may change layout density, but none of those product responsibilities may disappear because they were absent from a visual reference frame.

### Admin / Control Room

Admin is an operational OS, not a consumer surface.

Every Admin module uses the pattern:

`scope/header → search/filter → queue/list/table → detail → evidence → action → confirmation → audit trail → recovery`

| Admin area | Required real-world content |
|---|---|
| Control Room | platform health, readiness, operational integrations, queues, incidents, major metrics, audit/recovery links |
| Conversations | search, conversation identity, participant/context, safety/policy state, messages/metadata as permitted, handoff/escalation, audit |
| Providers | provider search, profile, capabilities, verification/evidence, availability, trust, requests, disputes, sanctions |
| Economic | requests, orders, quotes, payment/escrow, fulfilment, disputes, cancellation, evidence |
| Moderation | reports, queue, content/user context, decision, reason, appeal/audit |
| Compliance | policy exceptions, evidence, retention/privacy, access, review queue, audit |
| Notifications | queue, delivery/read state, provider/device status, failures, retry/cancel, audit |
| Integrations | provider readiness, credentials/config state (never raw secrets), health, activation gates, test actions, evidence |
| Agents | agent identity, goals, runtime, tools, risk, approvals, actions, retries, pause/cancel, evidence |
| Users | search, profile, trust/evidence, memory/privacy status, activity, economic history, flags, controls, audit |
| Pricing | plans, entitlements, regional pricing, copy/state, billing readiness, experiments/audit |
| Referrals | attribution, qualification, fraud checks, rewards, pending/approved/reversed, audit |
| Commissions | rules, earned/pending/paid/reversed, contributor/provider, audit |
| Partnerships | applications, organizations, contracts/status, capabilities, readiness, contacts, audit |
| Scam & trust | reports, risk signals, evidence, decisions, restrictions, recovery, audit |
| Social | moderation and community/creator operations |
| Creators | profile, content, campaigns, eligibility, payouts/rewards, moderation |
| Celebrity | profile, representation, requests, availability, evidence, campaigns, privacy |
| Analytics | product/operational metrics, filters, cohorts, source definitions, export, data freshness |
| Revenue | gross/net/reconciled, payment/provider evidence, subscriptions, commissions, refunds/disputes |
| Marketing | campaigns, audience boundary, creatives, approvals, spend/serving state, audit |
| Advertising | campaigns, inventory, targeting boundary, creative review, placement, serving, spend, moderation |
| Content | content queue, SEO content, topic/resource status, moderation, publication, revision history |
| Curation | discovery/resource/topic curation queue, ranking signals, evidence, editor decisions |
| Settings | feature flags/readiness, policy, operator settings, integrations, audit |
| SEO | URL inventory, title/meta, canonical, index state, redirects, schema, content completeness, warnings |
| Roadmap | product priorities, status, dependencies, evidence and owner |

## Cross-system feature inventory

The page matrix must also account for capabilities that do not have a standalone page. These must appear in the correct conversation, workspace, Admin, channel, or native surface rather than being lost because they do not have a page mockup.

### Identity, trust and account

Phone-first authentication; email OTP where enabled; magic links; push approval; trusted devices; progressive identity; guest continuation; channel evidence; QR referral/context attribution; account/profile; privacy; logout; auth challenge recovery; session expiry; re-entry.

### Conversation intelligence

LLM semantic interpretation; context arbitration; reference resolution; topic switching; interruption; clarification; conversation-only exploration; action proposals; exact-object resolution; natural correction; confirmation; cancellation; follow-up; cross-turn goal preservation; model selection; local model fallback; template fallback; quality/repair; truth boundaries.

### Capability catalogue

All canonical skills and operations in `skillFlows.ts` and the canonical capability catalogue are included by reference. The registry currently covers the repository's 205 skills across 46 families and projects the broader capability vocabulary used by model reasoning and execution. Every skill family must map to a surface contract, outcome/lifecycle contract, UI-state contract, canonical owner, and recovery path. Presence in a registry or route is not completion evidence.

### Economic/network capabilities

Discovery; provider matching; worker/services; products/inventory; seller/buyer; ordering; requests; quote; payment; escrow; fulfilment; dispatch; delivery; cancellation; dispute; reviews; ratings/trust; contributors; events/evidence; opportunities; referrals; commissions; Points; subscriptions; Wallet; Top Up; Money Circle; promotion/advertising; sponsored discovery; saved/follow/watch.

### Personal OS capabilities

Memory; reminders; tasks; notifications; safety; check-ins; trusted contacts; artifacts; voice; call/WebRTC boundary; Connect; channels; linked devices; Nearby Pulse/Radar; location consent; daily picks; Topics; prayer companion; agents; capabilities; opportunities.

### Content and community

Topics; replies; reports; moderation; resources; articles; source attribution; editorial freshness; public discovery; legal; privacy; help; contact; careers; partner information; developer/API documentation; SEO/admin content lifecycle.

### Channel/network capability surfaces

Web Chat; PWA; WhatsApp adapter/readiness; Telegram bot/personal linked-device boundary; SMS; Email; USSD; FCM/PWA push; voice; WebRTC; QR context; linked devices; connected resources; Google Drive; Sheets; Notion; Microsoft sources; MQTT/IoT foundation.

### State language that must exist everywhere it applies

`Ready`, `Needs setup`, `Needs your input`, `Pending`, `Waiting`, `Deferred`, `Connected`, `Not connected`, `Verifying`, `Verified`, `Unavailable`, `Blocked`, `Failed`, `Retry`, `Cancelled`, `Completed`, `Saved`, `Paused`, `Expired`, `Delivery unavailable`, `Payment unavailable`, `Provider unavailable`, `Awaiting provider`, `Awaiting confirmation`, `Awaiting evidence`.

These semantic states must map consistently to visual treatment, copy, accessible labels and allowed actions.

## SEO architecture

Public/indexable surfaces must have:

- unique search intent and H1;
- title and meta description that answer that intent;
- canonical URL;
- sensible internal-link graph;
- descriptive URLs/slugs;
- breadcrumbs where useful;
- structured data only when truthful;
- image/social metadata where appropriate;
- index/noindex strategy per surface class;
- pagination/canonical strategy for listings;
- source/author/date/update semantics for editorial material;
- no thin placeholder page manufactured only to match a design board;
- meaningful content above and below the fold;
- related resources/topics/Chat continuation where appropriate.

Authenticated and private operational pages should use appropriate `noindex`/access controls and are not required to become SEO landing pages. API/admin/private implementation surfaces are operational documentation rather than public consumer SEO pages unless explicitly designated otherwise.

## Navigation architecture

Every page must answer:

- Where am I?
- What can I do here?
- What is the next best action?
- How do I return to the originating conversation or object?
- Where do I go for adjacent tasks?
- What happens if the action cannot proceed?

Public site navigation, authenticated Web App navigation, Chat navigation and Admin navigation remain separate authorities but must provide deliberate cross-plane bridges where appropriate.

## Completion rule

A feature/page/component/functionality/aim may only be marked **complete** when its purpose, information architecture, interaction flow, canonical owner, data/state semantics, visual treatment, navigation/recovery, accessibility, and required external/SEO boundaries are all accounted for.

A design reference cannot reduce this contract.

## Canonical source hierarchy

When sources disagree, use this order:

1. canonical runtime owner and route/component implementation;
2. `docs/architecture/BLUEPRINT_TRUTH.md` and `CURRENT_PRODUCT_TRUTH.md`;
3. canonical skill/capability registries and feature flags;
4. active design system/screen-set specifications;
5. historical design boards/screenshots;
6. historical TODO/roadmap prose.

Historical visuals must never delete functionality that the active runtime/product truth requires.
