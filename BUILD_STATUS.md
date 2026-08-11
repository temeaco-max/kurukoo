# Kurukoo — Current Build Status

**Status:** Economic OS safety/consolidation refactor merged to `main`; the legacy route boundary is now being removed and canonical public/composition boundaries are being enforced.
**Blueprint:** `BLUEPRINT.md` v5.62 (with the current implementation clarifications below)
**Date:** 2026-08-11
**Latest implementation branch:** `refactor/remove-legacy-boundary`

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

The application composition root is `src/index.ts`. Canonical route modules under `src/routes/*` own HTTP boundaries. `src/legacyApp.ts` has been removed; SEO/static/admin compatibility responsibilities must live in their explicit existing boundaries rather than returning to a catch-all legacy module.

Artists/creators are **not a separate economic system**. Artist booking is a category-specific policy adapter over the shared Economic Request lifecycle. Representation verification, technical riders, contracts, travel and negotiation are requirements/capabilities of that request.

## Completed in the Economic OS and route-consolidation work

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
- Complete universal catalogue/inventory matching for catalogue-bearing skills using the existing provider/product data model rather than creating per-skill ordering systems.
- Expand economic integration tests so each canonical category proves the same lifecycle with category-specific requirements.
- Strengthen attachment storage/access controls before production-scale media uploads.
- Keep CSS, messaging, services, skills, security and economic audits behavioural rather than presence-only where practical.
- Keep documentation aligned with the implementation; stale historical claims must not be treated as current architecture.

### P2 — scale when justified
- PostgreSQL when concurrent/multi-instance write load requires it.
- Redis/queue workers when presence, rate limiting or asynchronous fulfilment requires distributed coordination.
- Object storage/CDN when attachment volume and retention requirements justify them.

## Cost-effective operating rule

Do not introduce infrastructure merely because the blueprint names it. Adopt PostgreSQL, Redis, queues, object storage and additional external services when workload, reliability, regulatory requirements or real transaction volume justify them. Until then, the single-instance SQL.js architecture remains the low-cost launch path.

## Verification

The current legacy-boundary removal and its dependent remediation work must pass the full repository CI suite before either is merged to `main`. The dependency audit may retain the documented upstream-only `sharp` advisory until a compatible upstream package releases a safe fix; all other validation must pass.

**Rule for future implementation:** Before creating or changing a file, inspect the current repository implementation and confirm that the intended capability does not already exist. Never introduce a second architecture for a capability that already has a canonical implementation.
