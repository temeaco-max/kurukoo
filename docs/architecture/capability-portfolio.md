# Kurukoo Capability Portfolio

## Purpose

A Kurukoo user has one identity and one Memory Profile. The user may hold many capabilities at the same time: provider skills, contributor capability, native assistance, and agent participation.

The Capability Portfolio is a **projection and activation surface**, not a replacement for Kurukoo's canonical sources of truth.

### Canonical sources remain

- `skills` — provider skill, operation mode, availability, service radius and provider-specific skill facts.
- `memory_profiles` — person identity, contributor flag, trust and shared profile state.
- Progressive Trust / verification — whether a person is actually verified for protected actions.
- Nearby Pulse / `pulse_sessions` / `provider_presence` — live presence and availability evidence.
- Universal Capability Registry — what Kurukoo as an OS knows how to do.
- Agent Runtime — long-lived reasoning/goals over those capabilities.

`capability_portfolio` is a derived owner-scoped projection that lets Chat, APIs and agent tooling reason about the person's current set of capabilities without creating additional accounts or roles.

## User model

```text
one person / one identity
        |
        +-- mobile_barber
        +-- delivery_runner
        +-- contributor
        +-- customer requests
        +-- agent goals
        +-- native assistance
```

The user never changes accounts to switch capability.

## Capability lifecycle

```text
discovered
  -> interested
  -> onboarding
  -> verified
  -> active
  -> paused / suspended
```

Availability is separate:

```text
offline -> available -> live
```

`live` is presence, not proof of a booking, quote, payment or fulfilment.

## Skill Flow relationship

Skills describe **what** the person can provide or what Kurukoo can help with.

Skill Flows describe **how the capability progresses** through requirements, lifecycle, evidence, confirmation and outcomes.

The Brain decides which skill/capability is relevant. Canonical services own mutation and execution. Agents can coordinate across several skills without creating separate user accounts.

## Multi-skilled example

A mobile barber + delivery runner can be:

```text
mobile_barber   = live
 delivery_runner = available
 contributor     = active
```

Stopping barber presence must not stop delivery presence. `Nearby Pulse` therefore operates by skill for mobile sessions.

## Conversation examples

- `I'm a mobile barber around Ikeja.` → add/continue barber capability onboarding.
- `I also do deliveries with my bike.` → add delivery capability to the same identity.
- `I'm available for deliveries now.` → update delivery availability.
- `Take barbering offline.` → stop barber availability/Pulse only.
- `Go live for delivery.` → explicit skill-specific Pulse activation with location consent.
- `I'm also a contributor.` → add contributor capability without changing provider skills.
- `I need a plumber.` → this is a customer request, not a role switch.

## Agent and MCP use

The capability portfolio is registered in the Universal Capability Protocol as `capability_portfolio`. This lets the canonical executor, agent/tool layer and MCP surface reason about the same owner-scoped capability state.

External AI never gains authority by reading the portfolio. All mutations still pass through Kurukoo's identity, consent, confirmation, idempotency and canonical execution boundaries.

## Product rule

Do not create separate accounts such as `barber account`, `delivery account` or `contributor account` for the same person. The portfolio is the user's capability view over the existing OS.
