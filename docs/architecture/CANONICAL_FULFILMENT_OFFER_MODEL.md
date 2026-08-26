# Canonical Fulfilment / Offer Model

Kurukoo keeps one execution runtime. Fulfilment is a domain layer used by Goals, Economic Requests, capabilities and channels; it is not another runtime.

## Core flow

```text
Conversation
  -> Skill / Intent
  -> collect required inputs
  -> durable Fulfilment
  -> catalogue / provider discovery
  -> Offer
  -> user confirmation when required
  -> existing canonical capability executor
  -> evidence / quality gate
  -> Economic Request / Goal outcome
  -> continuation
```

## Catalogue-first with inquiry fallback

A skill can declare `catalogueFirst: true` and `providerInquiryFallback: true`.

Example: `buy suya`:

```text
user: I want 2 portions of beef suya in Ikeja
  -> requirements: item, quantity, unit, location
  -> lookup catalogue
      -> offer found: source=catalogue
  OR
      -> no current offer
      -> create Provider Inquiry
      -> provider responds
      -> response becomes Offer source=provider_inquiry
      -> provider_confirmed evidence
  -> rank offers
  -> present offer
  -> explicit confirmation
  -> canonical capability execution
```

The provider inquiry is durable and owner-scoped. A provider response never becomes a catalogue fact implicitly; it creates a time-bounded, evidence-backed Offer that can later be projected into a provider catalogue only through an explicit canonical workflow.

## Reuse across the skill catalogue

Skills bind to reusable fulfilment mechanisms instead of shipping bespoke execution engines:

- marketplace_purchase
- service_request
- booking
- procurement
- local_discovery
- provider_dispatch
- information_lookup
- communication_relay

The binding declares required inputs, optional inputs, catalogue-first behaviour, inquiry fallback and confirmation requirements.

## Ownership

- `canonicalFulfilmentService` owns Fulfilment, Offer and Provider Inquiry persistence and state transitions.
- `economicRequestPersistence` remains the owner of Economic Request lifecycle.
- `canonicalCapabilityExecutor` remains the owner of real actions.
- `agentQualityGate` / `agentObjectiveEvaluator` remain the completion truth boundary.
- Channel adapters remain responsible for transport, not fulfilment state.
- Provider adapters remain responsible for external provider communication, not Goal truth.

No second Agent runtime, Offer executor, fulfilment worker, or notification system should be introduced.
