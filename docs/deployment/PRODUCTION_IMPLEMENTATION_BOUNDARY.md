# Kurukoo Production Implementation Boundary

**Status:** Operational boundary guidance. This document is subordinate to `BLUEPRINT.md` and `docs/architecture/CURRENT_PRODUCT_TRUTH.md`.

The repository can prove code, ownership, buildability and deterministic contracts. Human/operator access is required for provider activation, credential rotation, cloud infrastructure, device testing, compliance and real-world outcome evidence.

## What repository work can establish

1. Explicit separation between repository, runtime and real-world verification.
2. Pilot readiness signals for attachment storage, object storage, multi-worker/scale transition and production-secret strength.
3. Fail-closed production defaults for autonomous/high-risk features and payments.
4. Ordered owner actions that cannot be performed honestly by source code alone.
5. Scale-transition readiness without pretending that PostgreSQL/Redis/object storage are active.
6. Explicit Cloud Run persistence blocking when SQL.js remains the canonical owner.

## What the repository cannot complete alone

| Action | Why it requires an operator/external system |
|---|---|
| Rotate historical provider/GitHub credentials | Provider console access and audit-log review |
| Enable GitHub branch protection and required reviews | Repository-owner settings access |
| Activate live WhatsApp/Meta Cloud API | Business verification, phone identity and signed webhook secrets |
| Activate live payment/settlement | Merchant account, KYC, webhook and compliance evidence |
| Provision production Postgres/Redis/object storage | Cloud project, networking, secrets and operations ownership |
| Prove real device push delivery | Firebase project, device tokens and field testing |
| Complete human curation for the student model | Human review of candidate trajectories |
| Perform real load/chaos testing | Deployed environment and controlled traffic |

## Non-negotiable truth rules

1. A database escrow row is **not** proof that money is held.
2. A configured secret is **not** proof that a provider is live.
3. A sandbox payment is **never** a production payment.
4. SQL.js remains single-process; multiple workers require an approved shared persistence/rate-limit boundary.
5. Cloud Run container-local storage is **not** durable canonical application storage.
6. Cloud Storage FUSE must **not** be used as a transactional SQL.js database.
7. Chat and UI must never claim external fulfilment, verification or delivery without evidence.

## Owner P0 sequence

1. Rotate historically exposed credential types and review provider/GitHub audit logs.
2. Protect `main` with required CI, PRs and review.
3. For Cloud Run, provision the shared durable database and validate the persistence adapter **before** treating any Cloud Run service as a durable production deployment.
4. Start with one Cloud Run instance/concurrency-1 as a conservative rollout profile only after the shared database owner is active; scale only after distributed coordination is validated.
5. Keep payments disabled or configure one real adapter with verified webhooks; never enable sandbox payment in production.
6. Activate one external channel only after its signature/challenge boundary is verified.
7. Run the canonical repository truth gate plus the deployed core-journey runtime suite; fix truthfulness regressions before inviting users.

## Scale transition criteria

Move beyond the initial Cloud Run single-instance profile only when concurrent multi-instance writes, sustained marketplace-scale traffic, distributed rate limiting/presence/agent workers, or stronger recovery/HA requirements justify it.

The current SQL.js + local-file implementation is the low-cost development/single-process path, not the durable Cloud Run production path.
