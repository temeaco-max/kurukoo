# Kurukoo — Current Build Status

**Status:** Economic OS safety/consolidation refactor merged to `main`; follow-up hardening and real-world integration work continues.
**Blueprint:** `BLUEPRINT.md` v5.62 (with the current implementation clarifications below)
**Date:** 2026-08-11
**Current main merge:** `a940503976db3a364f2eabcb82ff3d7ddf51c00e`
**Merged PR:** #1 — `fix: enforce truthful Economic OS lifecycle`

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
- `legacyApp.ts` is a transitional page/SEO boundary rather than a place for new business APIs.
- `/health` and canonical route modules are wired through the application composition root.

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

### P1 — architecture and behavioural completeness
- Finish deleting any genuinely dead legacy route bodies after extraction coverage proves they are unused.
- Complete universal catalogue/inventory matching for catalogue-bearing skills using the existing provider/product data model rather than creating per-skill ordering systems.
- Expand economic integration tests so each canonical category proves the same lifecycle with category-specific requirements.
- Strengthen attachment storage/access controls before production-scale media uploads.
- Keep CSS, messaging, services, skills, security and economic audits behavioural rather than presence-only where practical.
- Keep documentation aligned with the implementation; stale historical claims must not be treated as current architecture.

### P2 — scale when justified
- PostgreSQL when concurrent/multi-instance write load requires it.
- Redis/queue workers when presence, rate limiting or asynchronous fulfilment requires distributed coordination.
- Object storage/CDN when attachment volume and retention requirements justify it.

## Cost-effective operating rule

Do not introduce infrastructure merely because the blueprint names it. Adopt PostgreSQL, Redis, queues, object storage and additional external services when workload, reliability, regulatory requirements or real transaction volume justify them. Until then, the single-instance SQL.js architecture remains the low-cost launch path.

## Verification

The merged Economic OS refactor passed the repository CI suite before merge, including lint, build, route tests, CSS audit, messaging audit, skills audit, economic audit, services audit, security audit, email tests, FastText verification and secret scanning.

**Rule for future implementation:** Before creating or changing a file, inspect the current repository implementation and confirm that the intended capability does not already exist. Never introduce a second architecture for a capability that already has a canonical implementation.
