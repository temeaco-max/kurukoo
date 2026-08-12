# Kurukoo Controlled Pilot Cost Surface

**Status:** Controlled Pilot Ready with external-cost controls active
**Scope:** 5–10 invited users, single-instance SQLite deployment, Web Chat Assisted Pilot profile
**Owner:** Manus AI
**Decision use:** This document defines what can create cost or operational exposure during the invited pilot and which controls must be reviewed before expanding the cohort.

## Executive position

The current deployment is suitable for a **small, controlled, non-production-money pilot** when external payment, fulfilment, outbound-channel, and autonomous-execution integrations remain disabled or explicitly configured through their existing fail-closed boundaries. The repository does not claim precise monetary cost from internal event data. The operator dashboard therefore reports activity counters and unavailable metrics rather than inventing a currency estimate.

> A pilot event count is an exposure signal, not a provider invoice. The dashboard can show how often a capability was attempted; it cannot prove external billing, fulfilment, or provider delivery.

## Cost and exposure surfaces

| Surface | What can create exposure | Current pilot posture | Observable counter | Stop or review trigger |
|---|---|---|---|---|
| AI text generation | Model/API calls, retries, long conversations, attachments | Enabled only through the existing unified AI boundary; no direct cost is inferred by observability | `request_started`, `error_boundary`, conversation counts | Repeated retry loops, unexplained latency, or a failure rate above the operator threshold |
| Web voice | Voice session minutes, model calls, browser/provider usage | Keep disabled unless the approved voice evaluation profile is active | `voice_started`, `voice_failed`, `voice_fallback`, `voice_ended` | Any unexpected voice activation, repeated fallback, or unbounded session behavior |
| Autonomous agent | Worker/model/tool calls and repeated re-entry | Disabled by default for the assisted pilot; no autonomous external execution | `agent_goal_created`, `agent_goal_waiting`, `agent_goal_failed`, `agent_goal_cancelled` | Any agent action that is not explicitly authorized, evidence-backed, bounded, or reversible |
| Payment collection | Processor fees, real-money movement, webhook retries | Fail closed unless production provider, secrets, HTTPS callback, and reconciliation contract are configured | `payment_unavailable`; verified economic state remains authoritative | Never invite real-money activity until the payment activation checklist is complete |
| External fulfilment | Provider charges, dispatch fees, third-party commitments | No external execution claim; connector boundary remains disabled unless deliberately activated | `request_created`, provider/search and fulfilment-unavailable events | Any claim of booking, dispatch, notification, or fulfilment without authoritative evidence |
| Outbound channels | SMS, WhatsApp, Telegram, USSD, push delivery fees | Unconfigured channels remain visibly unavailable; internal queue may persist notifications | `notification_created`, `notification_failed` | Any channel shown as connected without current credentials and callback evidence |
| Storage and database | SQLite growth from messages, feedback, events, attachments, backups | Single-instance pilot; bounded note/context fields and daily backup expectations | Event totals, feedback totals, database file size | Unexpected growth, failed backup, or concurrent writer pressure |
| Human operations | Review time, invite management, incident response | Daily operator review for the first cohort; one owner must be accountable | Dashboard feedback and failure counters | Any unresolved P0/P1 issue or ambiguous user-facing state |

## Event counters and interpretation

The protected `/api/admin/pilot-dashboard` endpoint exposes aggregate data for the selected 1–90 day window. It includes pseudonymous user/session counts, event counts, feedback rating counts, and cost counters for voice sessions, agent goals, rate-limit events, and payment-unavailable attempts. Owner hashes, raw conversations, secrets, and full phones are omitted from the operator response.

The `pilot_events` table is append-oriented. Identifiers are hashed with a deployment salt before persistence; the allowed context key set excludes message bodies, OTPs, JWTs, transaction amounts, and raw provider payloads. Optional feedback notes are bounded and redact email addresses, phone-like numbers, OTP/PIN/code patterns, bearer tokens, and JWT-shaped strings before storage.

| Dashboard field | Meaning | Does not mean |
|---|---|---|
| `total_events` | Number of accepted pilot event rows in the window | Number of unique human actions or provider invoices |
| `failed_events` | Events recorded with `failed`, `blocked`, or `unavailable` status | Proof that a user lost money or that a provider failed externally |
| `failure_rate` | Failed-event share of accepted event rows | A statistically representative product reliability rate at 5–10 users |
| `voice_sessions` | Number of observed voice starts | Billable minutes or successful voice outcomes |
| `agent_goals` | Number of agent goals created | External actions performed or completed |
| `payment_attempts` | Payment-unavailable observations | Payment attempts accepted, charged, or reconciled |
| `feedback` | User-submitted response-quality ratings | Ground truth about fulfilment, identity, or payment correctness |

## Operating controls

Before inviting a user, set a persistent `DB_PATH`, confirm the production secret validation policy, keep `KURUKOO_EXTERNAL_EXECUTION_ENABLED=false`, keep production payment unset unless the approved Stripe contract is ready, and verify that unavailable capabilities are described as unavailable. The first cohort should not use real money or unrestricted external fulfilment.

Review the dashboard at the end of each pilot day and after every incident. Compare event volume with the actual invite cohort and investigate sudden increases in voice, agent, payment, rate-limit, or error-boundary events. Preserve the database and relevant deployment logs before resetting or rolling back a pilot instance.

## Current GO boundary

**GO** means continue with 5–10 invited adults under the assisted Web Chat profile, with no real-money collection and no unverified external execution. It does not mean production launch, provider availability, payment readiness, or fulfilment success. The operator must move to **NO-GO** immediately for false claims, PII leakage, unauthorized external action, payment-integrity ambiguity, unsafe emergency language, failed backups, or any unresolved P0/P1 incident.

## Unavailable metrics

The implementation intentionally does not derive precise monetary cost, provider billing, real-world fulfilment rate, or a causal user-success score from local event rows. Those require provider billing exports, authoritative callback evidence, or a larger and explicitly designed evaluation study. The correct pilot behavior is to show these metrics as unavailable rather than estimate them from activity counters.
