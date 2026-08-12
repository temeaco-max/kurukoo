# Kurukoo Controlled Pilot Recovery Runbook

**Status:** Required operating document for the 5–10-user invited pilot
**Owner:** Pilot operator and deployment owner
**Primary principle:** Recover the user’s context first, fail closed on claims and side effects, and keep the next truthful action visible.

## Recovery contract

Kurukoo should preserve a conversation or request state whenever possible, tell the user what is unavailable without implying success, and offer a safe continuation such as retrying, typing instead of voice, reviewing a preserved request, or contacting the operator. A failure response must not fabricate provider contact, payment success, booking, fulfilment, emergency notification, or delivery evidence.

> If the system cannot prove the side effect, the user-facing state must remain pending, unavailable, or failed—not completed.

## Severity levels

| Level | Definition | Immediate action |
|---|---|---|
| P0 | Suspected PII exposure, unauthorized external action, false payment/fulfilment claim, unsafe emergency claim, or active data-integrity loss | Stop invites; disable voice, agent, external execution, payments, and outbound channels; preserve evidence; notify the deployment owner |
| P1 | Repeated recovery failure, unrecoverable conversation loss, payment reconciliation ambiguity, failed restore, or material misleading UI | Pause the affected capability and cohort expansion; preserve evidence; investigate before resuming |
| P2 | Localized unavailable state, transient voice/provider failure, feedback write failure, or recoverable route error | Keep the user on the canonical path, record the bounded event, retry only within existing limits, and review during the daily pilot check |
| P3 | Cosmetic, copy, or low-impact usability issue with a clear fallback | Record feedback and schedule a fix without interrupting the pilot unless the issue can mislead users |

## First five minutes of an incident

1. **Stop expansion.** Do not invite another tester until the severity is understood. For P0 or P1, pause the cohort immediately.
2. **Preserve evidence.** Record UTC time, deployment version, route or capability, browser width/network condition, opaque request or conversation reference if already displayed to the operator, dashboard window, and the exact user-visible state. Do not copy phone numbers, OTPs, JWTs, payment secrets, transaction amounts, or raw personal notes into the incident record.
3. **Confirm the truth boundary.** Check the canonical request/economic state and authoritative callback evidence. Never use a client response, screenshot, or optimistic UI state as proof of payment, fulfilment, provider contact, or delivery.
4. **Apply the narrowest kill switch.** Disable the affected capability first. For P0, use the full shutdown sequence below.
5. **Recover the user.** Keep the conversation available where safe, explain the next truthful action, and offer the typed or manual fallback. Do not ask the user to repeat sensitive information unless the prior state is genuinely unavailable.
6. **Reproduce with a safe fixture.** Use a test account or guest session and a bounded request. Do not replay real payment or external dispatch attempts.

## Failure playbooks

### Conversation or stream failure

**Signals:** `error_boundary`, a stream error state, missing completion event, repeated user send, or a user reporting that the conversation disappeared.

**Response:** Confirm the last persisted user/assistant message in the canonical conversation store. If the user message is present but the reply is absent, show that the request is preserved and allow one bounded retry. If the request was not persisted, tell the user that the message was not saved and invite them to send it again. Do not create a second conversation merely to recover a response. Review whether `conversation_started`, `conversation_resumed`, `request_started`, and `error_boundary` counts rose together.

### Guest authentication failure

**Signals:** `guest_auth_started` followed by `guest_auth_failed`, repeated OTP/name prompts, or a user returning to a request without the expected continuation card.

**Response:** Do not claim that the account was created or that the protected request advanced. Preserve the guest conversation, offer the canonical login/OTP path, and make the remaining step explicit. If migration is uncertain, stop any protected mutation and inspect the migration result before retrying. A successful `guest_auth_completed` event and authoritative session state are required before treating the user as authenticated.

### Voice unavailable or degraded

**Signals:** `voice_failed`, `voice_fallback`, session-rate-limit responses, permission errors, or a missing `voice_ended` event.

**Response:** Keep the typed composer available and say that voice is unavailable right now. Do not claim that a voice transcript was saved unless the transcript endpoint returned success. End orphaned sessions through the existing session boundary, review the voice status endpoint, and disable new voice sessions if failures repeat. Never expose provider keys or raw audio/transcript data in pilot notes.

### Payment unavailable or reconciliation ambiguity

**Signals:** `payment_unavailable`, Stripe intent failure, webhook signature failure, amount/currency mismatch, duplicate webhook, or a request that is neither clearly pending nor authoritatively paid.

**Response:** Keep the Economic Request in its current truthful state. Do not unlock escrow, mark paid, or promise settlement. Tell the user that payment is unavailable or still being verified and provide a non-payment continuation where the product supports one. For a suspected mismatch, stop payment invites, preserve the webhook/event reference without copying secrets or amounts into general logs, and require operator review before retrying.

### Provider search or fulfilment unavailable

**Signals:** empty provider results, quote unavailable, fulfilment unavailable, expired offer, or provider evidence that cannot be refreshed.

**Response:** Say that Kurukoo could not verify a suitable option at this time. Preserve the request and ask for a retry, changed constraint, or manual follow-up. Do not show a provider as available from stale or inferred data, and do not create an order or charge without the existing evidence-backed transition.

### Agent or external execution boundary

**Signals:** agent goal failure/waiting/cancellation, connector authorization rejection, execution evidence missing, or an action appearing to complete without authoritative evidence.

**Response:** Treat the action as not completed. Cancel or pause the bounded goal, keep the request visible, and disable external execution immediately if the boundary is suspect. Do not re-run a side effect automatically unless the connector contract and idempotency key make that retry safe and the user authorization remains valid.

### Feedback or observability write failure

**Signals:** feedback returns a temporary-unavailable response or the dashboard cannot be loaded.

**Response:** Do not block the conversation. Tell the user that feedback could not be recorded if necessary, allow the user to continue, and inspect the application/database health. The observability service is diagnostic; it must never become a prerequisite for message persistence, payment truth, authentication, or fulfilment.

## Full shutdown sequence

Use this sequence for P0, suspected credential compromise, false external-action claims, or financial-integrity uncertainty:

1. Set `KURUKOO_EXTERNAL_EXECUTION_ENABLED=false`.
2. Disable `KURUKOO_AGENT_ENABLED` and autonomous low-risk agent execution.
3. Disable `KURUKOO_VOICE_ENABLED`.
4. Remove or disable production payment configuration and stop inviting payment activity.
5. Disable outbound channel credentials/callbacks if delivery state is uncertain.
6. Pause new pilot invitations and notify the designated operator.
7. Preserve the application artifact, bounded logs, dashboard export, and encrypted database backup.
8. Keep the public surface available only if its copy remains truthful; otherwise stop the application through the deployment platform.
9. Restore or roll back only after identifying the failure boundary and confirming schema compatibility.

## Restore and rollback

The pilot uses single-instance SQLite storage. Stop the application and workers before copying or restoring the file named by `DB_PATH`. Preserve the damaged file as evidence, restore the selected encrypted backup, verify file ownership and permissions, start with workers disabled, run `/health`, the focused pilot regression, and the relevant route/security checks, then re-enable only the approved capability profile. Do not run multiple writers against the same SQLite file and do not roll a schema backward without checking migrations.

A code rollback must be paired with a compatible database decision. If the latest schema is required by the restored artifact, migrate forward rather than replacing it with an older empty database. After recovery, open the built runtime and verify the chat, feedback endpoint, admin authorization boundary, and disabled capability statuses at 360, 414, 768, 900, 1280, and 1440 CSS-pixel profiles.

## Daily pilot review

At the end of each pilot day, review the protected dashboard for total events, failed events, failure rate, voice/agent/payment counters, feedback ratings, and recent recovery signals. Compare those aggregates with the invited cohort and operator notes. Review no raw conversation or owner identifiers from the dashboard. Escalate if the failure rate crosses the current operator threshold, if a capability appears active while unconfigured, or if users repeatedly misunderstand an unavailable state.

## Resume criteria

Resume the affected capability only when the root cause is understood, the narrowest fix is deployed, the focused regression passes, the built runtime has been checked, evidence-backed state transitions remain intact, no PII or secrets entered the observability path, and the operator has recorded the decision. Resume with one internal fixture before inviting another human.

## Pilot decision

At the implementation checkpoint, the appropriate decision is **GO for a 5–10-person controlled assisted Web Chat pilot**, with **NO-GO for production payments, unrestricted autonomous execution, unverified fulfilment, and unrestricted channel/voice activation**. This decision must be revisited after each P0/P1 incident or material change to the external integration profile.
