# Kurukoo Controlled Human Pilot Threat Model

**Scope:** A supervised Nigerian pilot of 5–10 adult testers, 2–5 manually verified providers or businesses, and 1–2 authenticated operators. This is a repository threat model, not evidence that any human, provider, payment provider, emergency service, or external channel has operated successfully.

## Pilot configuration assumed by this review

| Control | Required controlled-pilot setting | Meaning |
|---|---|---|
| Pilot admission | `KURUKOO_CONTROLLED_PILOT=true` | Only operator-enrolled customers and providers may enter pilot request or coordination paths. |
| Payments | Disabled for real collection | Quote acceptance may progress only to `awaiting_confirmation`; it is not payment, escrow, booking, dispatch, or fulfilment. |
| External execution | `KURUKOO_EXTERNAL_EXECUTION_ENABLED=false` | No real dispatch, fulfilment connector, emergency delivery, or automatic external action may run. |
| External channels | Unconfigured by default | Internal queue state must never be represented as external delivery. |
| Autonomous agents | Disabled unless separately approved | Model or agent output is untrusted inference and cannot create authoritative economic or provider state. |
| Supply | Manual, provenance-bearing review | No scraping, bulk import, automatic outreach, or claim that a public business is a Kurukoo provider. |

## Evidence hierarchy

> A UI label, client request, profile field, declared availability, Trust Score, rating, LLM text, or mutable boolean is not sufficient authority for a high-impact claim.

| Claim | Minimum authoritative evidence | Explicitly insufficient alone |
|---|---|---|
| Public business exists in registry | Provenance-bearing public supply record reviewed under source policy | Directory text, imported record, name similarity |
| Business is a Kurukoo provider | Approved claim plus evidence-backed provider verification and active capability | Public listing, claim token use, `verified_provider` projection |
| Provider is eligible now | Current verification, approved capability, geography, fresh scoped availability, active pilot enrolment | Opening hours, profile availability flag, prior invitation |
| Provider responded or quoted | Provider-owned idempotent response/quote record linked to the invitation | LLM assertion, operator belief, indicative rate |
| Customer selected/accepted a quote | Customer-owned idempotent selection/acceptance record with eligibility recheck | Provider statement, browser state, status label |
| Payment occurred | Verified payment-provider webhook and matching immutable payment evidence | Client callback, query string, accepted quote, internal ledger label |
| External delivery occurred | Adapter request plus external provider receipt | Internal notification queue, operator intention, connector configuration |
| Fulfilment/completion occurred | Authorised evidence path and canonical lifecycle transition | Payment evidence, provider quote, availability, model text |

## End-to-end attack surfaces

| Stage | Primary adversary or failure mode | Required repository property |
|---|---|---|
| Public entry and chat | Prompt injection, false model assertion, repeated anonymous requests | Model output cannot mutate authority; rate and size boundaries hold; canonical request path remains singular. |
| Guest identity and OTP | Replay, guessing, fixation, guest-account mix-up, stale cookie | Progressive state machine, owner-scoped migration, expiry, rate limit, logout, and no second auth route. |
| Economic Request | Cross-user access, duplicate creation, invalid transition, fake completion | Server-side ownership, idempotency, canonical transitions, audit events without raw identity. |
| Supply record and claim | Scraped/duplicate/old listing becomes active provider; impersonation | Provenance, review, claim-token hash/expiry, separate verification and capability lifecycle. |
| Provider availability and invitation | Stale/mis-scoped availability, wrong capability/geography, replayed response | Freshness bounds, scope check, expiry, eligibility revalidation, idempotent response. |
| Quote and selection | Wrong currency/amount, expired quote, double accept, customer or provider ID swap | Provider-owned quote authority, customer-owned selection/acceptance, server-side ownership, NGN/positive amount and expiry validation. |
| Payment and execution boundary | Fake success, replayed callback, disguised dispatch or escrow | Signed evidence, idempotent verification, fail-closed adapter and execution flags. |
| Notifications and safety | Internal queue presented as delivery, unsafe emergency claim | Distinct queue/delivery states, no adapter activation by credentials alone, explicit non-emergency language. |
| Operators | Excessive data, evidence manufacture, unscoped action | Authentication, role checks, actor/reason/evidence references, minimised audit projection and attention queue. |
| Workers, AI, agents and recovery | Duplicate worker, runaway cost, stale execution, unrecoverable restart | Feature flags, bounded retries/idempotency, ownership, cancellation, health, restart/backup procedure and operator handoff. |

## Red-team success condition

Each tested high-impact transition must either be rejected safely or leave an auditable canonical record whose state can be distinguished from pending, claimed, verified, available, selected, accepted, paid, dispatched, fulfilled, and completed. Any path that collapses those states, exposes another user’s data, or manufactures external evidence is a pilot-blocking repository defect.
