# Kurukoo Blueprint Implementation Truth

This document is the current convergence index between the Blueprint and the repository. It does not replace `BLUEPRINT.md`; it records what the repository can truthfully claim today and what remains gated, partial or externally dependent.

## Current product definition

Kurukoo is a **conversational operating system for coordinating everyday intentions with people, services, products, places and bounded agents**. It can help directly, preserve context, discover options, coordinate participants, prepare an Economic Request or continue work over time. External fulfilment remains conditional on availability, authorization, evidence, configured providers and real-world confirmation. The implementation and activation bridge is documented in [`MULTI_AGENT_NETWORK_ARCHITECTURE_AND_ACTIVATION_ROADMAP.md`](./MULTI_AGENT_NETWORK_ARCHITECTURE_AND_ACTIVATION_ROADMAP.md).

## Canonical status vocabulary

- **IMPLEMENTED_AND_VERIFIED** — repository implementation and relevant behavioural coverage exist.
- **IMPLEMENTED_PARTIALLY_WIRED** — meaningful implementation exists but one or more product surfaces/lifecycles remain incomplete.
- **IMPLEMENTED_FEATURE_FLAGGED** — repository capability is present but deliberately disabled until prerequisites are satisfied.
- **PROVIDER_DEPENDENT** — repository boundary is implemented; real-world activation depends on a configured external provider or operational prerequisite.
- **FOUNDATION_ONLY** — low-level foundation exists but the complete product lifecycle is not implemented.
- **NOT_IMPLEMENTED** — no adequate repository implementation exists.
- **SUPERSEDED** — the Blueprint design was replaced by the converged architecture.
- **OBSOLETE** — historical requirement no longer belongs in the active product.

## Core architecture truth

| Capability | Current truth | Status |
|---|---|---|
| Conversation-first Chat | `canonicalChatTurnService` is the shared conversation/action orchestration authority. | IMPLEMENTED_AND_VERIFIED |
| Intent routing | FastText + deterministic routing + configured AI escalation. | IMPLEMENTED_AND_VERIFIED |
| FastText | Real model path exists and is used for representative routing; fallback remains truthful. | IMPLEMENTED_AND_VERIFIED |
| Local SmolLM2 | Local generation boundary exists and remains optional/cost-controlled; the memory-safe 360M q4 checkpoint is covered by direct, unifiedAiEngine, canonical Chat, and first-class persona integration tests. | IMPLEMENTED_FEATURE_FLAGGED |
| Unified AI | Existing provider-neutral AI layer supports configured hosted providers. | IMPLEMENTED_AND_VERIFIED |
| Skill catalogue | `skillFlows.ts` is canonical for skill/category/requirements/capabilities. | IMPLEMENTED_AND_VERIFIED |
| Universal Economic Request | Shared request lifecycle is the canonical economic orchestration model. | IMPLEMENTED_AND_VERIFIED |
| Deferred requests | Open intentions/deferred request machinery exists with bounded re-evaluation and notification boundaries. | IMPLEMENTED_AND_VERIFIED |
| Memory Profile | Single canonical user/profile authority exists; fabricated location/balance defaults were removed. Authenticated users can list active fact-level context and revoke their own retained facts without exposing source references or affecting another account. | IMPLEMENTED_PARTIALLY_WIRED |
| Living Memory | Bounded multi-tier working context and lifecycle jobs exist. Current retrieval uses a launch-efficient relevance implementation; Blueprint fidelity to FastText embeddings must be treated as a measured optimisation choice, not an automatic requirement. Admin lifecycle jobs and owner-scoped fact revocation preserve the retention boundary. | IMPLEMENTED_PARTIALLY_WIRED |
| Agents | Bounded autonomous goal runtime, tool registry, ownership, risk and lifecycle exist. First-class persona delegation emits a typed Brain event and receives policy-reviewed local-model preflight before its stored persona instruction is sent to SmolLM2 for both guest and authenticated Chat; only authenticated owners enter owner-scoped points charging, and admin execution remains operator-controlled. | IMPLEMENTED_FEATURE_FLAGGED |
| Notifications | Internal notification authority exists; external push remains separately configurable. | IMPLEMENTED_AND_VERIFIED |
| Presence / Nearby Pulse | Nearby Radar is ready by default for local discovery without claiming a live broadcast. Authenticated eligible providers can explicitly Go Live through the canonical Pulse route; location is supplied explicitly, public display is fuzzed, sessions expire, and Chat nudges reuse the internal notification surface. External/device behaviour remains deployment-dependent. | IMPLEMENTED_FEATURE_FLAGGED |
| Topics | Bounded shared Topic authority exists with moderation/privacy/SEO boundaries. | IMPLEMENTED_AND_VERIFIED |
| Advertising | Canonical campaign/ad placement authority exists, including first-party campaign support and private-Chat ad boundary. | IMPLEMENTED_AND_VERIFIED |
| Referrals | Referral attribution, qualification and idempotent reward path exists. | IMPLEMENTED_AND_VERIFIED |
| Points | Points ledger/contributor rewards exist with bounded reward semantics. | IMPLEMENTED_AND_VERIFIED |
| Subscriptions | Consumer/provider plan boundaries and sandbox/QA paths exist; live payment is external. | IMPLEMENTED_FEATURE_FLAGGED |
| Money Circle | Circle foundations and tests exist; live monetary transfer remains gated. | IMPLEMENTED_FEATURE_FLAGGED |
| PWA | Installable PWA, shared Chat-first shell, offline fallback, version-safe asset caching, install/update prompts, reconnect messaging, and foreground service-worker refresh exist. Actual installed iOS, Android, macOS, and Windows behavior and push delivery remain external device-validation tasks. | IMPLEMENTED_PARTIALLY_WIRED |
| Progressive trust | Provider-neutral trusted-device records, independent push challenges, channel evidence, and time-bound location consent exist behind explicit production gates. | IMPLEMENTED_PARTIALLY_WIRED |
| Guest/authenticated personalization | The Chat client hides private workspace actions for guests and exposes profile-linked context after authentication; direct protected APIs remain fail-closed. | IMPLEMENTED_PARTIALLY_WIRED |

## External/channel truth

| Capability | Current truth | Status |
|---|---|---|
| Web Chat | Active canonical UI/channel. | IMPLEMENTED_AND_VERIFIED |
| WhatsApp | Adapter and parity/webhook boundaries exist; real provider activation remains external. | PROVIDER_DEPENDENT |
| Telegram | Bot API adapter plus an explicit personal MTProto linked-device boundary exist; real provider activation remains external. | PROVIDER_DEPENDENT |
| SMS | Adapter boundary exists; carrier/provider activation remains external. | PROVIDER_DEPENDENT |
| USSD | Repository boundary exists; carrier/shortcode activation remains external. | PROVIDER_DEPENDENT |
| Email | Canonical email channel and Resend boundary exist; email OTP request/verification is implemented behind `KURUKOO_EMAIL_OTP_ENABLED` and still requires provider activation. | PROVIDER_DEPENDENT |
| Phone OTP delivery | OTP record generation, hashing, expiry, attempt limits and verification are wired through the canonical SMS adapter. Africa’s Talking acceptance is required before Kurukoo claims that a phone code was sent; absent credentials remain explicitly unavailable. | PROVIDER_DEPENDENT |
| FCM/PWA push | Internal notification persistence and authenticated device registration exist; real external push and approval delivery require Firebase configuration, device permission, and delivery evidence. | PROVIDER_DEPENDENT |
| Device trust / push approval | Device registration, status, pending challenges, approve/deny actions, inventory, and revocation bind trusted devices without treating browser access as phone ownership. | IMPLEMENTED_FEATURE_FLAGGED |
| Channel evidence | Signed/validated WhatsApp, Telegram, email, SMS and other canonical inbound adapters record bounded evidence through the shared channel boundary; the authenticated Connect workspace shows provider readiness separately from owner-scoped personal linked-device state; evidence does not replace phone verification automatically. | IMPLEMENTED_PARTIALLY_WIRED |
| Location consent | Discover requests browser permission only for authenticated users, stores coarse purpose-bound consent with expiry, and does not claim background location. Nearby Pulse also requires an explicit valid location for provider broadcast; Radar readiness does not infer location. | IMPLEMENTED_PARTIALLY_WIRED |
| Voice | Repository voice boundary exists; real provider activation remains external. | PROVIDER_DEPENDENT |
| Private-number masking | Owner-scoped proxy allocation, resolution, expiry/release, execution-connector integration, and protected Coordinator lifecycle telemetry exist; a local proxy number is not a routable real telephony number. | PROVIDER_DEPENDENT |
| WebRTC | Authenticated signalling foundation exists, but create/peer/signal endpoints now fail closed unless `FF_WEBRTC=true` and an approved STUN/TURN or relay prerequisite is configured. TURN/STUN, client media lifecycle, consent, browser interoperability, and production relay remain external activation tasks. | FOUNDATION_ONLY |
| MQTT / IoT | Owner-scoped connected-resource registration, pairing, capability gating, persistent command records, idempotent command replay, and truthful broker readiness now exist through the canonical connected-resource owner. Secure device identity, discovery, inbound state synchronization, durable broker operations and production broker architecture remain incomplete. | FOUNDATION_ONLY |

## Economic / network truth

Every economic skill is considered fully implemented only when it satisfies the shared definition of done in the Blueprint Addendum: routing, requirement capture, Economic Request, provider/inventory discovery, availability semantics, quote semantics, payment where required, fulfilment/dispatch where required, evidence, cancellation/dispute, Memory Profile integration, conversation integration and behavioural tests.

The presence of a skill tag, route or card alone is not completion evidence.

## PWA truth

The PWA is the reference application experience for future iOS/Android clients. The current repository should continue converging toward:

```text
Public Web
  = discovery / SEO / resources / marketing / public network

PWA / native application family
  = conversation / personal workspace / requests / reminders / memory /
    notifications / Discover / tasks / Points / safety / account
```

The installed application should launch into the conversation-first experience rather than a dashboard-first experience. The repository now provides the bounded shell behavior for install prompts, service-worker updates, cached public/app surfaces, truthful offline messaging, reconnect messaging, and foreground refresh. Native clients should inherit this same design system and interaction model. This does not claim that an installed app has been independently validated on a real iOS, Android, macOS, or Windows device, nor that push delivery is live.

## Progressive trust contract

Kurukoo preserves phone as the primary channel identity while allowing users to establish trust progressively. A supplied phone number, an authenticated browser, a trusted device, a linked WhatsApp session, a verified email, a social-account connection, and verified phone ownership remain separate evidence types. Each evidence type may unlock only the capabilities it actually supports.

Production activation is explicit through `KURUKOO_PROGRESSIVE_TRUST_ENABLED`, `KURUKOO_PUSH_APPROVAL_ENABLED`, `KURUKOO_CHANNEL_EVIDENCE_ENABLED`, and `KURUKOO_LOCATION_CONSENT_ENABLED`. These flags default to fail-closed in production when absent. FCM registration may bind an authenticated device, but push delivery is not claimed unless the provider accepts the message and delivery evidence exists.

The central Chat surface is personalized by state. Guests receive public conversation and discovery affordances without private reminders, memory, Points, tasks, saved context, or account notifications. Authenticated users receive their own workspace state. Discover may request coarse, purpose-specific location permission while open; the system does not silently collect background location from the browser.

## Feature flags

`src/services/featureFlags.ts` now contains a typed registry with lifecycle and prerequisite metadata. Feature flags are not a substitute for external readiness: a flag may remain disabled because a provider, broker, relay, market or risk prerequisite is missing.

## Cost truth

Kurukoo remains aligned with the launch cost strategy:

- SQL.js/single-instance while the workload permits it.
- deterministic routing/FastText before expensive inference.
- local models before paid inference when quality is sufficient.
- hosted providers behind explicit configuration and quota controls.
- WebRTC/precise location only when a high-value use justifies the cost.
- Redis/PostgreSQL/queues/object storage only when actual workload or regulatory/provider requirements justify them.

## Remaining convergence priorities

1. Keep `BLUEPRINT.md`, Addendum, Ecosystem and product documents synchronized to the same current truth.
2. Complete the product-grade PWA experience and make it the reference for future native apps.
3. Continue end-to-end behavioural completion of the broad skill/category catalogue rather than treating routing coverage as completion.
4. Finish real provider activation and delivery validation for Telegram personal MTProto sessions, WhatsApp linked devices, FCM push approval, Resend email, and any phone-dependent channel.
5. Finish provider-independent portions of private number masking, WebRTC and MQTT/IoT and keep them feature-flagged until real infrastructure is present.
6. Continue actor/scenario testing across contributors, providers, businesses, agents and users so every canonical flow behaves as one ecosystem.
7. Keep external activation boundaries truthful and explicit.


## Outcome-completeness truth

The executable outcome matrix is generated from the canonical skill-flow and feature registries with `npm run audit:outcome-completeness`; its machine-readable and Markdown evidence lives at `data/audits/outcome-completeness.json` and `data/audits/outcome-completeness.md`. `npm run test:outcome-completeness` enforces 205 canonical skills, 46 families, zero missing canonical flow definitions, populated lifecycle states, canonical owners, execution boundaries and recovery paths.

The matrix classifies every current skill as **REPOSITORY_READY_EXTERNAL_ACTIVATION** when its canonical repository path exists but a capability-specific provider, operational, delivery or evidence boundary remains deployment-dependent. This does not mean that external execution, payment, messaging, voice, fulfilment, provider availability or completion is live. It means the repository-side lifecycle and activation seam are present and truthfully bounded.

The outcome unit is the user's objective across the applicable lifecycle, not the presence of a skill tag, route or card. Brain/context arbitration remains semantic and planning authority; canonical services remain the sole mutation and authorization owners. The matrix is evidence of convergence and gap detection, not a second orchestration subsystem.


## SmolLM2 training-universe truth

The repository now generates `ml/datasets/kurukoo-core-v1.jsonl` and its manifest from the canonical Kurukoo ontology through `npm run ml:generate-universe`. The current candidate universe contains **1,845 synthetic examples covering all 205 skills, 46 families, 9 scenario variants, 6 actor roles and 9 transport/channel surfaces**. It includes normal requests, ambiguity, interruption, correction, unavailable capability, consent, channel continuation, recovery and linked-device continuation cases.

The generated data is provenance-labelled, contains no production user data, marks teacher output as untrusted candidate material, and explicitly forbids models from inventing availability, verification, payment, evidence or direct canonical state mutation. `npm run ml:test-universe` verifies these invariants. This is a validated candidate dataset and not proof of a trained, evaluated, quantized, exported or promoted SmolLM2 artifact. Training, evaluation, resource benchmarking, model manifest creation, shadow/canary promotion and runtime activation remain independent gates.


## Continuous convergence directive implementation

The offline SmolLM2 candidate-data path now emits deterministic `all`, `train`, `validation`, and `test` JSONL splits plus a manifest containing SHA-256 hashes. The current `kurukoo-core-v1` manifest contains 1,845 examples across 205 skills and 46 families, with 9 ambiguity/interruption/recovery variants, 6 actor roles, 9 channels including linked devices, 7 configured locale/dialect labels, and 18 platform surfaces covering memory, reminders, notifications, Points, subscriptions, Topics, media, support, products, orders, cart, discovery, provider interaction, safety, consent, payment boundaries, locale and dialect.

This is deterministic synthetic candidate material derived from the canonical ontology. It is not a trained model, model weight, evaluation result, quantized export, promoted registry entry or runtime authority. Teacher/critic output remains optional untrusted candidate material and cannot alter policy or canonical state.


## SmolLM2 evaluation-set truth

The ontology generator now emits a 205-example golden candidate set and a 1,435-example adversarial candidate set alongside the deterministic train, validation and test splits. Both sets are hash-recorded in `ml/datasets/kurukoo-core-v1.manifest.json` and remain explicitly marked `candidate_requires_human_curation`. They are not golden truth until curated and approved, and they are not evidence of trained model weights or runtime activation.

## Universal execution and conversation reconciliation truth

The canonical capability catalog is a single projected vocabulary assembled from the canonical skill registry, canonical operation definitions, and policy-reviewed agent tools. Skills describe user-facing capability domains; operations describe canonical owner actions; agent tools describe bounded runtime tools. They are projected into one catalog for model reasoning and inspection, while mutation remains owned by canonical services. The current catalog exposes 226 descriptors in this repository state; this count is a projection count, not a claim that all descriptors are equally externally activated.

Canonical action execution follows `proposal -> validation -> exact owner/context verification -> canonical service -> structured result -> conversational presentation -> continuation`. `canonicalCapabilityExecutor` owns validation, idempotency, confirmation, exact identity, and truthful external-activation boundaries. Models and agent planners may propose actions but do not mutate canonical state or reinterpret an explicitly identified object.

Context arbitration now treats exploratory language such as “I’m thinking about getting a cleaner” as conversation-only, accepts natural reminder phrasing such as “set a reminder for Friday” as an explicit domain switch, and recognises affirmative variants such as “Yes, go ahead” against the selected Economic Request. Relative price language remains attached to the exact request and cannot be stored as a location, provider, quote, payment, or fulfilment value without canonical evidence. The permanent regression is `npm run test:conversation-reconciliation`.

The permanent acceptance boundary remains truthful: a confirmation can be recorded while dispatch, payment, provider selection, fulfilment, delivery, or completion remain blocked by missing fields, evidence, or external activation. Repository tests and local browser acceptance establish repository readiness only; they do not establish external provider activation or real-world fulfilment.


## SmolLM2 local runtime and output-boundary truth

The local SmolLM2 runtime targets `smollm2:360m` via the Ollama REST API when `KURUKOO_SMOLLM2_LOCAL=true`. The default fallback is the same checkpoint, so a load problem cannot silently downgrade to a smaller model. A smaller checkpoint remains possible only when explicitly configured and reviewed; the fallback regression continues to exercise that explicit boundary.

The model-facing conversation guidance is deliberately written as natural-language private instructions rather than self-describing key/value labels such as `model_tier=`, `requirement=` or `instruction=`. This prevents the student model from echoing internal contract metadata into a user response. The output boundary still strips role labels, prompt delimiters, memory markers and known internal-generation language, and retains the bounded Kurukoo template only when a model response cannot be made safe and user-facing. A model being loaded successfully does not by itself make its output suitable for presentation.

The repository-side 1.7B acceptance path has been verified through direct `smolLm2Service`, `unifiedAiEngine`, and canonical Chat execution using the cached q4 checkpoint. The test reports the actual local model and does not claim hosted-provider activation, production quota, or deployment cache availability.

## Student-model proving boundary

The SmolLM2 programme now distinguishes corpus generation, explicit candidate curation, actual training, evaluation and registry promotion. Synthetic scenarios and teacher output are candidate material only. Admission requires both `reviewed=true` and `accepted=true`; the curator never assigns approval. The production Chat path remains provider-neutral and canonical services remain the only mutation authority.

On 17 August 2026 the current generators produced a 24,000-trajectory provider-outcome laboratory with 943,188 synthetic turns, 205 skills and 46 families. Structural corpus thresholds passed, but no model improvement is inferred from that result. The current accepted corpus contained zero explicitly approved examples, so QLoRA training was blocked before model loading. The cached q4 SmolLM2-1.7B base was measured separately on the critical conversational benchmark; no Kurukoo-trained adapter was produced, registered, promoted or activated.

The model registry remains unchanged. Any future candidate must provide an immutable adapter artifact, base-model and accepted-dataset hashes, training metadata, golden/adversarial/long-horizon/capability/safety/resource evaluations and a human-reviewed candidate-to-shadow-to-canary decision. No model may bypass canonical identity, confirmation, truthfulness, authorization or execution boundaries.


## Student-model curation truth — 17 August 2026

| Capability | Current truth | Status |
|---|---|---|
| Teacher candidate queue | Existing teacher candidates can be imported into the protected Admin Control Room queue with trajectory, provenance, metadata, scores, failure dimensions and pending review status. | IMPLEMENTED_AND_VERIFIED |
| Human review surface | `/admin/curation.html` reuses the existing admin authentication boundary and lets an authorized reviewer inspect, accept, reject, request rewrite, or request second review with notes and reasons. | IMPLEMENTED_AND_VERIFIED |
| Rewrite lineage | A rewrite creates a new pending candidate linked to the original through `rewrite_of`, `original_id`, version, provenance and audit records. | IMPLEMENTED_AND_VERIFIED |
| Accepted-corpus gate | `reviewed=true AND accepted=true` is mandatory; scores, teacher confidence and provider identity never imply acceptance. Configurable coverage minimums fail closed before training. | IMPLEMENTED_AND_VERIFIED |
| Offline training | The Control Room prepares and audits corpus readiness but never launches training. QLoRA remains an explicit offline operation and no trained adapter is claimed until accepted data, coverage, training and verification exist. | IMPLEMENTED_FEATURE_FLAGGED |


## Emergency interrupt truth — 17 August 2026

Emergency is now an interruptive canonical capability at `canonicalChatTurnService`, ahead of guest onboarding, authentication, Economic Requests, provider discovery, reminders, agents, memory and ordinary conversation. The existing universal capability registry exposes `emergency` actions `assess`, `location`, `dial`, `connect`, `end` and `followup`, with `guest_initial_help` permission and existing canonical emergency/voice/WebRTC owners.

The repository directory contains the Nigeria nationwide 112 route for ambulance, police and fire, sourced from the Nigerian Communications Commission public release. The record is source-attributed and verification-labelled; Kurukoo does not invent local alternatives. Chat supports explicit service selection, approximate or unknown location, visible dial state and end/continuation. A browser `tel:112` option is repository-ready where supported, but actual dialing, ringing, connection, responder acceptance and dispatch remain **PROVIDER_DEPENDENT** and are not claimed.

Guest emergency assistance is **IMPLEMENTED_AND_VERIFIED** by regression: it does not enter name, phone or OTP onboarding, while ordinary guest economic action continues to require the existing authentication path. The emergency Chat card is now rendered through the shared Chat surface with service, location, dial state, verified number, call control and truthful limitation copy.


## Interaction policy and protective interruption — 17 August 2026

| Capability | Current truth | Status |
|---|---|---|
| Pre-routing interaction policy | `canonicalChatTurnService` resolves the existing `conversationPriorityService` before onboarding, authentication, context arbitration, generic routing and model generation; policy telemetry is persisted with the canonical turn. | IMPLEMENTED_AND_VERIFIED |
| Guest critical handling | Emergency initial help and security protective guidance can be delivered before ordinary name, phone or OTP collection; ordinary account-owned mutations remain authenticated. | IMPLEMENTED_AND_VERIFIED |
| Emergency descriptor compatibility | The registered `emergency` universal capability owns assess/location/dial/connect/end/follow-up. The existing `safety/emergency_dispatch` executor input is an exact compatibility alias, not a second engine. | IMPLEMENTED_AND_VERIFIED |
| Security interruption | Stolen/lost phone, account-access and unrecognized-payment reports produce a protective `security_interruption` response without claiming account recovery, refund, cancellation or ownership mutation. | IMPLEMENTED_AND_VERIFIED |
| Cross-capability interaction policy | Reminder, agent, remote/device, payment/subscription/order, memory, public attribution, channel and voice boundaries retain exact identity, authentication, confirmation, evidence and external-readiness rules. | IMPLEMENTED_AND_VERIFIED |
| External activation | Telephony, payment, channel, provider, device, voice and relay activation remain provider-dependent and are not represented as live without evidence. | PROVIDER_DEPENDENT |

The interaction-policy matrix covers 227 policy descriptors and passed with the full all-domains, route, security, PWA, public, build, lint and strict CSS suites. Live browser verification confirmed guest emergency presentation without onboarding and a fresh guest security card without a name, phone or OTP gate.


## Country experience and market-management truth

The supported country experience is now represented by one canonical `countryExperience` service for Nigeria (`ng`), Ghana (`gh`) and the United Kingdom (`gb`). Each market supplies shared public-path, locale, currency, minor-unit, emergency-number, pricing-management and channel metadata. Public country routes, provider profiles and rendered page context reuse this authority rather than hard-coding Nigeria or a generic English market.

The authenticated admin boundary exposes the same catalogue at `/api/admin/countries`, and the pricing management surface loads it before creating or editing plans. This keeps country selection and currency defaults consistent with the pricing service. Country metadata is management/readiness metadata, not proof that any market's external channel, payment, emergency dialing or fulfilment is live.

All supported markets use the same UI/UX shell and conversation-first journey. Differences are limited to truthful market metadata, currency, emergency directory and available channel declarations. Unsupported country codes normalize to the safe Nigeria default for compatibility; they are not silently treated as a new market.

The red-team pass also removed hard-coded NGN fallbacks from shared Chat commerce cards. When an offer does not provide a canonical currency, the UI now says `local currency` or `Price pending confirmation` rather than implying a Nigerian amount.
