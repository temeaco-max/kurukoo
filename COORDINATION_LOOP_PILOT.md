# Kurukoo Evidence-Gated Coordination Loop

**Status:** Controlled pilot vertical slice
**Scope:** Verified-provider internal queue, explicit provider response, customer quote selection, human operator handoff
**Non-goal:** This document does not claim live external provider delivery, payment settlement, booking, dispatch, arrival, fulfilment, or payout.

## Purpose

The red-team assessment correctly identified that a request lifecycle alone is not a functioning coordination network. This extension turns the existing canonical Economic Request into a small, testable coordination loop without replacing its payment, escrow, participant, execution, dispute, or observability boundaries.

> A provider is not considered available merely because they appear in discovery. The provider must receive an internal invitation and explicitly accept with a bounded quote before the customer can select a response.

## Supported loop

| Step | Authority | Canonical evidence or state | Truthful product behavior |
|---|---|---|---|
| Customer creates request | Authenticated customer | Canonical Economic Request and requirements | The request is captured; no provider, payment, or fulfilment is claimed. |
| Customer asks for provider confirmations | Authenticated customer | `provider_coordination_invitations` rows plus participant evidence | Kurukoo creates internal queue invitations only. It does not claim SMS, push, WhatsApp, or other external delivery. |
| Provider reviews queue | Authenticated, evidence-verified provider | Provider-owned invitation query | The provider can see only invitations addressed to that provider. |
| Provider accepts or declines | Invited verified provider | Idempotent response, participant status, coordination event | An acceptance requires a positive whole-number quote. A decline remains a recorded response, not a failure of the customer. |
| Customer reviews responses | Authenticated request owner | Owner-scoped response list | The interface shows explicit provider response state and submitted quote, not inferred availability. |
| Customer selects response | Authenticated request owner | Selected `service_provider` participant and canonical request transition | A selected provider response creates a `provider_submitted` canonical quote. It is not payment, booking, or dispatch. |
| Customer accepts quote | Authenticated request owner | Customer acceptance evidence and `awaiting_confirmation` request state | The product explains that payment remains unavailable until a configured provider verifies settlement. |
| Customer requests assistance | Authenticated request owner | `coordination_handoffs` row and coordination event | The request joins an internal operator queue. Kurukoo does not claim an operator has contacted anyone. |
| Operator claims or resolves | Authenticated administrator | Operator-hash audit event and handoff state | An operator can claim then resolve a handoff from the existing protected pilot dashboard. |

## Authority and isolation controls

Provider responses are limited to the authenticated invited provider. Customer response review, selection, event inspection, and handoff request are limited to the Economic Request owner. Operator queue actions require the existing admin authentication middleware. The stored coordination event log uses a salted actor hash and bounded evidence, while owner identifiers are omitted from the operator queue response.

Provider matching remains evidence-gated through the existing verified-provider discovery path. The new `service_provider` participant role is additive; it does not grant external execution, payout, settlement, escrow-recipient, or payment authority. The schema migration preserves existing participant rows while widening the participant CHECK constraint for the new role and accepted response state.

## Customer and operator surfaces

The customer continues to use the canonical chat/storefront. An indicative provider rate now leads to **Ask providers to confirm availability** rather than being treated as a real quote. Submitted provider responses appear in the existing storefront, where the customer can choose a provider, accept the provider quote, or request a coordinator.

Providers use `/provider/coordination`, an authenticated internal queue. The page is intentionally explicit that it records internal responses and does not demonstrate external message delivery or payment. Operators use `/admin/pilot`, which now includes a coordinator handoff queue with claim and resolve actions. These routes display no queue data without their established authentication boundaries.

## Explicitly unavailable operations

| Operation | Current status | Required before activation |
|---|---|---|
| Real provider onboarding | Manual/operator-managed verification only | Provider registration and evidence acquisition workflow, operating coverage policy, consent, and review process |
| External invitation delivery | Not configured | Channel credentials, verified webhook/callback contract, delivery receipts, opt-in/consent, and retry policy |
| Booking or dispatch | Not implied by provider acceptance | Explicit connector authorization, provider acknowledgement, idempotent dispatch evidence, and an approved operational contract |
| Arrival, job start, completion proof | Not implemented as a provider network lifecycle | Role-specific evidence model, operator review criteria, and customer confirmation policy |
| Customer payment and escrow | Not activated in this loop | Configured payment provider, verified webhook, reconciliation, refund/chargeback procedure, and approved settlement model |
| Provider payout or platform fee | Not implemented | Regulated/commercial payout design, KYC/payout verification, reconciliation, dispute policy, and provider agreement |
| Autonomous negotiation/retry loop | Not enabled | Event trigger, timeout and escalation policy, cost budget, user authorization, and human override controls |
| External human contact | Not claimed | Operator action record and a configured, evidence-bearing communications channel |

## Pilot acceptance criteria

The vertical slice is acceptable for a controlled internal or invited test only when all of the following are true:

1. A provider has authoritative verification evidence and is discoverable through the existing verification state, not merely a profile flag.
2. An invitation is visible in that provider’s internal queue and remains scoped to that provider identity.
3. Acceptance contains an explicit positive quote and a bounded, redacted note.
4. The request owner can inspect and select only responses for their own request.
5. Customer quote acceptance does not claim payment, escrow, booking, dispatch, arrival, or completion.
6. A human handoff can be requested, claimed, and resolved through protected operator APIs.
7. The full provider-coordination regression passes with external delivery and payment confirmation explicitly false.

## Decision

This closes part of the red-team P0 coordination gap: Kurukoo now has a minimal **internal coordination loop** with provider-owned response, customer selection, and operator escalation. It does **not** close the live-network, external-channel, payment, settlement, real-world fulfilment, or operational onboarding gaps. Those remain NO-GO until their external contracts, evidence, and operating policies are actually configured and rehearsed.
