# Kurukoo Pilot Runtime Audit

**Branch:** `integration/main-convergence-audit`
**Audited head:** `bb6f91a`
**PR:** #31
**Audit type:** controlled human-pilot observability and failure-discovery pass

## Verified canonical path

The current repository has one canonical path from homepage and `/chat` through guest conversation, progressive name/phone/OTP identity, guest-to-authenticated migration, conversation restoration, FastText/rule intent classification, `intentRouter`, shared `skillFlows`, progressive requirements, Economic Request creation and state transitions, evidence-gated discovery, quote/payment boundaries, fulfilment/execution boundaries, reminders, Living Memory, QR context, Web Voice, internal notifications, logout, export/delete, PWA shell, bounded agent runtime, referrals/Points, safety, provider verification, admin routes, health, and background workers.

Existing route and service contracts verify that QR activation does not create a request or Points reward, voice remains attached to the shared conversation, agents are owner-scoped and bounded, providers require authoritative verification evidence, payments fail closed without a configured adapter, and external execution requires `KURUKOO_EXTERNAL_EXECUTION_ENABLED=true`.

## Findings before this pass

| Severity | Finding | Status before this pass | Planned treatment |
|---|---|---|---|
| P0 | Important failures and user recoveries are not consistently captured in a privacy-safe structured event stream. | Gap | Add one bounded pilot event ledger using the existing database and admin boundary. |
| P1 | Operator stats exist but do not expose authentication funnel, abandonment, unavailable-capability, error, rate-limit, voice, payment, webhook, or feedback counters as one aggregate pilot view. | Gap | Extend existing admin stats; do not create a second admin product. |
| P1 | There is no lightweight in-conversation helpful/not-helpful or “something went wrong” feedback path. | Gap | Add minimum-data feedback storage and authenticated/guest-safe route. |
| P1 | Human pilot results are not available and must not be fabricated. | Open | Prepare a naturalistic tester script and record this explicitly. |
| P1 | Public exposure cost controls rely partly on deployment-level IP/WAF limits; in-process rate limits exist for auth, AI, webhooks, payments, and voice. | Configuration/operations | Document required deployment controls and instrument rate-limit hits. |
| P2 | Recovery wording and retry context are inconsistent across older fallback surfaces. | Partial | Audit and fix only verified user-facing dead ends. |
| P2 | SQLite backup/restore and operator incident sequence are documented but not drilled against a live pilot cohort. | Open | Create a recovery runbook and execute a local file-level drill. |
| P3 | Aggregate funnel and latency reporting is limited where timestamps are not already stored. | Open | Add only measurable counters; never claim precise cost or latency without authoritative data. |

## Privacy constraints for new observability

The event layer must never store OTPs, passwords, JWTs, API keys, payment credentials, full phone numbers, raw addresses, safety details, private memory content, raw audio, or raw conversation bodies. Event records use a bounded event name, timestamp, pseudonymous owner/session key, optional conversation/request reference, coarse status/context, and a small metadata object with allow-listed keys. Retention is limited and must be purged by the existing data-retention worker.

## Operator surface constraints

The pilot dashboard must remain inside the existing authenticated admin architecture and expose aggregates only. It must not expose provider API keys, secrets, raw user conversations, raw memory, raw safety notes, or surveillance-style per-user timelines. A dashboard value is shown only when the repository has authoritative data; unavailable metrics are labelled unavailable rather than estimated.

## Human validation status

No human cohort was available during this audit. No usability, completion-rate, latency, or confusion results are claimed. The next required evidence is a controlled 5–10 person invited pilot using the scripted tasks and privacy-minimised observation fields in `PILOT_TEST_SCRIPT.md`.
