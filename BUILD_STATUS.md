# Kurukoo — Current Build Status

**Status:** Economic OS safety/consolidation refactor merged to `main`; follow-up hardening and real-world integration work continues.
**Blueprint:** `BLUEPRINT.md` v5.62 (with the current implementation clarifications below)
**Date:** 2026-08-11
**Current main merge:** `a940503976db3a364f2eabcb82ff3d7ddf51c00e`
**Merged PR:** #1 — `fix: enforce truthful Economic OS lifecycle`

## 2026-08-11 convergence verification

**Candidate branch:** `fix/convergence-release-readiness`
**Integration target:** `integration/near-completion` — **not `main`**
**Verified commit:** `93ede899a46340ce027a84a574c25c88262a33b6`

This convergence candidate assembles the reviewed security, lifecycle, dispute/escrow, public-route, navigation/onboarding, canonical chat, CSS-token, DOM-safety, and homepage/Explore truthfulness work. It removes the deployable GitHub workspace service and all corresponding `/api/admin/github/*` routes, tests, and maintenance-script mutation patterns. The built application uses one canonical chat client; the unused legacy client was deleted.

The final clean-build verification completed `npm ci --ignore-scripts`, `npm run lint`, `npm run clean && npm run build`, `npm run test:routes`, `npm run audit:security`, `npm run audit:services`, `npm run audit:skills`, `npm run audit:messaging`, `npm run audit:css`, `npm run test:chat-dom-safety`, and `npm run test:email`. The public production runtime was exercised on the built server: homepage, onboarding, `/chat` and `/chat/`, Explore, a category detail page, Discover, the PWA dashboard, pricing, country routes, content/legal routes, and all internal homepage navigation/CTA destinations returned their expected rendered or redirected results. Responsive captures at 360px, 390px, 768px, 1024px, and 1280px showed no visible initial-viewport overflow or clipped primary CTA.

> **Integration status:** Suitable for a pull request into `integration/near-completion`; it is not a claim that external production infrastructure is configured or that `main` should be merged.

Known non-blocking validation debt is documented rather than hidden: the non-strict CSS audit reports 217 legacy inline-style occurrences across 13 files; the production dependency audit reports two high-severity `sharp`/`@huggingface/transformers` advisories with no currently safe npm fix. These require follow-up but did not invalidate the assembled route, lifecycle, or public-runtime contracts.

## Current architecture

```text
Conversation / channel
        ↓
Intent routing
        ↓
Canonical skill + requirement schema (`skillFlows.ts`)
        ↓
Economic Request
        ↓
Shared capabilities
(discovery / availability / verification / quote / reservation /
payment / escrow / fulfilment / tracking / evidence / dispute / completion)
        ↓
Provider / inventory adapter
        ↓
Real-world execution
```

Artists/creators are **not a separate economic system**. Artist booking is a category-specific policy adapter over the shared Economic Request lifecycle. Representation verification, technical riders, contracts, travel and negotiation are requirements/capabilities of that request.

## Completed in the latest Economic OS refactor

- Canonical skill requirements are consumed from `src/services/skillFlows.ts`; duplicate requirement definitions were removed from the economic request route.
- Provider discovery requires an explicit verification state and applies the supplied service location constraint.
- Fabricated/default monetary quotes were removed. Provider-listed rates are explicitly marked indicative; otherwise a real quote is required.
- Storefront cards no longer claim escrow protection before verified payment.
- Internal escrow ledger creation requires a `paid` request with a verified payment reference.
- Artist booking remains on the shared Economic Request lifecycle; no artist-only transaction engine remains.
- Browser OTP verification no longer exposes the JWT to client JavaScript.
- Production cannot silently select the sandbox payment provider.
- Development/demo providers are not seeded into production databases.
- CI is read-only and cannot rewrite or push `main`.
- Customer lifecycle transitions are restricted to customer-owned states; provider/system transitions stay in the service layer.
- `/health` is owned by `src/routes/healthRoutes.ts`.
- `/`, `/explore`, and `/p/:providerSlug` are owned by `src/routes/publicRoutes.ts`.
- Referral endpoints remain in the existing authenticated `userRoutes.ts` boundary rather than a legacy module.
- The composition contract test now fails if `legacyApp` or `registerLegacyRoutes` is reintroduced.
- `src/legacyApp.ts` has been deleted after its remaining route responsibilities were accounted for.
- Economic Request user-owned routes now apply explicit `authenticateUser` middleware; orchestration and memory lifecycle endpoints apply explicit `authenticateAdmin` middleware and are covered by HTTP behavior tests.
- Dynamic provider, opportunity, promotion, and optimistic chat content is rendered through DOM nodes and `textContent`, not untrusted HTML interpolation or inline event attributes.
- npm is the documented package manager; `package-lock.json` is committed and CI uses `npm ci --ignore-scripts` for reproducible installs.
- The unused `uuid` and deprecated unused `multer` dependency paths were removed. The active local SmolLM2 path still requires `@huggingface/transformers`, whose transitive `sharp` advisory has no safe npm fix at this time.
- SQL.js persistence writes to a temporary file before atomic replacement. This improves interrupted-write durability but does not convert the architecture into a multi-instance data store.
- The canonical `/api/orders` boundary now uses paths relative to its `/api` composition mount. Provider-driven delivery changes require the authenticated phone to match the order’s assigned provider and reject invalid lifecycle jumps deterministically.
- The existing authenticated WebRTC signaling router is mounted at `/api/webrtc`; its composition test proves anonymous callers are rejected.
- The existing API documentation asset is served by `systemRoutes` at `/api/docs`; health remains owned solely by `healthRoutes`.
- Direct client escrow creation is disabled. The reusable ledger requires a non-empty verified payment reference, and the legacy order-finalizer path fails closed rather than creating an unreferenced held ledger.
- Deferred re-matching uses the shared Economic Request and Open Intention services. A matched provider without a real listed rate leaves the request partially matched; no worker fallback can invent a payable quote.
- Escrow release awards the bounded canonical job-completion Points reward (1–5), keyed to the released escrow event for idempotency; the monetary escrow amount is never converted into Points.
- SMS and Telegram share the canonical channel handler with an identity-aware intent route. SMS normalizes its phone key before persisting messages or creating an Economic Request.
- Pulse statistics are derived from the shared active-presence service and do not emit fabricated match, dispatch, payment, or escrow events.
- An unconfigured FCM adapter fails closed and redacts device tokens from logs. It is not described as a delivery confirmation until a real provider adapter is installed.
- The authenticated trust boundary is mounted at `/api`: a buyer can list only their own escrow records and open an idempotent dispute against only their own order.
- Opening a dispute freezes the existing held escrow, transitions its linked Economic Request from `completed` to `disputed` during cooling-off, and blocks escrow release. A duplicate open dispute does not create another dispute or escrow ledger row.
- Generic customer Economic Request transitions cannot set `disputed`; disputes enter only through the buyer-owned trust boundary so escrow freezing is not bypassed.

## What is intentionally not claimed as implemented

The application does **not** simulate unavailable real-world infrastructure. In particular:

- A local escrow ledger is not described as money being held unless a trusted payment adapter has already confirmed payment.
- A provider is not described as verified without an explicit verification state.
- A missing provider price is not replaced with a fake currency amount.
- Real PSP settlement, regulated escrow, identity verification, external inventory feeds and other third-party capabilities remain adapter/integration work until credentials and production contracts are available.

## Remaining implementation work

### P0 — production truth/safety
- Wire and certify a real PSP/payment adapter before enabling production payment/escrow claims.
- Add real provider/identity verification adapters and evidence/expiry/revocation semantics.
- The repository owner must rotate and review the GitHub, Gemini, Hugging Face, and Groq credential types exposed in reachable historical Git history. Rotation cannot be performed by source code or inferred from the current clean tree.
- Track an upstream `@huggingface/transformers` release that moves `sharp` to a fixed version; do not apply an untested forced override merely to make dependency audit output green.
- Configure GitHub branch protection for `main` with required build, FastText, and secret-scan checks, pull requests, and review. This repository change cannot enforce a GitHub setting without owner authorization.

### P1 — architecture and behavioural completeness
- Finish deleting any genuinely dead legacy route bodies after extraction coverage proves they are unused.
- Complete universal catalogue/inventory matching for catalogue-bearing skills using the existing provider/product data model rather than creating per-skill ordering systems.
- Expand economic integration tests so each canonical category proves the same lifecycle with category-specific requirements.
- Implement the Blueprint §15.1 multi-factor trust-score recalculation and `trust_ledger` audit record on provider completion, dispute resolution, and the documented daily pass; the current profile field alone is not evidence that the formula runs.
- Strengthen attachment storage/access controls before production-scale media uploads.
- Keep CSS, messaging, services, skills, security and economic audits behavioural rather than presence-only where practical.
- Keep documentation aligned with the implementation; stale historical claims must not be treated as current architecture.
- Add a real FCM provider and channel fallback/receipt workflow before treating deferred-match or session nudges as delivered notifications.

### P2 — scale when justified
- PostgreSQL when concurrent/multi-instance write load requires it.
- Redis/queue workers when presence, rate limiting or asynchronous fulfilment requires distributed coordination.
- Object storage/CDN when attachment volume and retention requirements justify it.

## Cost-effective operating rule

Do not introduce infrastructure merely because the blueprint names it. Adopt PostgreSQL, Redis, queues, object storage and additional external services when workload, reliability, regulatory requirements or real transaction volume justify them. Until then, the single-instance SQL.js architecture remains the low-cost launch path.

## Verification

The current legacy-boundary removal and its dependent remediation work must pass the full repository CI suite before either is merged to `main`. The dependency audit may retain the documented upstream-only `sharp` advisory until a compatible upstream package releases a safe fix; all other validation must pass.

**Rule for future implementation:** Before creating or changing a file, inspect the current repository implementation and confirm that the intended capability does not already exist. Never introduce a second architecture for a capability that already has a canonical implementation.

## Current integration: Web Voice and QR contextual entry

The current integration branch adds browser Web Voice to the canonical `/chat` relationship and QR/deep-link contextual entry through `QrContext`, `/start`, `/api/qr/activate`, `/api/qr/generate`, and `/referral-qr/`. Voice uses the normal conversation, guest-first identity flow, FastText/intent router, skills, Economic Request lifecycle, memory, reminders, Points, safety, and structured chat cards; it is not a phone, IVR, channel, or separate request product. QR opens the normal chat with a contextual greeting and may continue through text or voice; it is not authentication, payment, a Points award, a referral-reward engine, a channel adapter, or an economic action.

A real browser Live session remains conditional on owner-managed provider configuration and applicable quota. When unavailable, the chat remains functional by text and reports a plain-language voice fallback. QR referral attribution is registered only after the existing OTP success and is still qualified and rewarded solely by the existing referral and Points services.


## Current integration: Bounded Autonomous Agent Runtime

The current `integration/main-convergence-audit` branch adds **one** feature-flagged Kurukoo Autonomous Agent Runtime. It persists owner-scoped goals and concise operational events, creates goals only after the canonical conversation/intent/storefront path, evaluates owned Economic Request state through a restricted tool registry, and re-enters due goals and existing deferred intentions through the established background-service lifecycle. It does not introduce a second AI, memory, task, provider, workflow, payment, referral, voice, QR, or Economic Request system.

| Surface | Current status | Truthful boundary |
|---|---|---|
| `agent_goals` and timeline events | Implemented | SQLite persistence is suitable for the current single-instance deployment; every goal is phone-owned and events carry only action, result, evidence, and state metadata. |
| Chat and inspector | Implemented | An eligible authenticated conversation can create one idempotent goal; the inspector shows a concise objective/timeline and allows cancellation. |
| Web Voice continuity | Implemented | The existing `route_user_intent` voice tool now creates the same bounded conversation goal after canonical intent routing; it does not create a voice-specific request, memory, or workflow. |
| Memory and request observation | Implemented | Existing bounded Living Memory and owned canonical request reads are used through the tool registry. |
| Waiting and deferred re-entry | Implemented | Existing background services process due goals and existing open intentions when the runtime flag is enabled. |
| Autonomous re-check | Implemented but disabled by default | Only existing eligible unresolved requests may be rechecked, and only when the low-risk flag is explicitly enabled. |
| Payment, escrow, dispatch, emergency, deletion, arbitrary tools | Intentionally unavailable | Existing confirmation, authorization, connector, and safety boundaries remain mandatory. |
| Reminder/proactive/provider/contributor/QR/channel event adapters | Backend dependent | Existing systems remain authoritative; each source needs a reviewed adapter, ownership check, evidence policy, and user-preference policy before it may wake a goal. |
| Multi-instance worker coordination | Backend dependent | A shared queue/lease is required before horizontally scaled workers can process due goals. |

The feature remains inactive unless `KURUKOO_AGENT_ENABLED=true`. Limits are controlled by `KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE`, `KURUKOO_AGENT_MAX_RETRIES`, `KURUKOO_AGENT_MAX_CONCURRENT_GOALS`, `KURUKOO_AGENT_COOLDOWN_SECONDS`, and `KURUKOO_AGENT_AUTONOMOUS_LOW_RISK`. With the flag disabled, Kurukoo continues operating as the normal conversational assistant.

### Stripe UK Collection Adapter — Blueprint §52.2 / PA-5

The Blueprint-designated diaspora collection rail is now implemented as a **fail-closed Stripe adapter**. An authenticated owner may begin a PaymentIntent only for an owned, currently quoted canonical Economic Request. The adapter uses a stable request-and-amount idempotency key, sends only a non-sensitive Economic Request reference as provider metadata, and returns only the PaymentIntent client secret to that authenticated user. A client-side success assertion never changes Kurukoo state.

Stripe webhook processing uses the raw request body, a timestamped `Stripe-Signature` HMAC check, a five-minute replay window, provider event de-duplication, and amount/currency/request-reference parity before it records `payment_verified` and advances the existing Economic Request. The internal escrow ledger is created only after that verified transition. Reconciliation failures remove the event marker and return a retryable server failure rather than losing an authoritative payment event.

This adapter is **not activated** until `KURUKOO_PAY_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are deployed as server secrets and a public HTTPS webhook endpoint is registered. The Blueprint’s OPay/Moniepoint Nigerian settlement rail, FX-locking, regulated escrow custody, payout/KYC onboarding, and cross-border compliance remain separate production certifications; no code path claims that Stripe collection alone creates live payout, regulated escrow, or fulfilment.
