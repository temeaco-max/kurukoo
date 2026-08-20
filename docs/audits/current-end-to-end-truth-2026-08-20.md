# Kurukoo — Current End-to-End Platform Truth — 2026-08-20

## Canonical state

`main` is the canonical product branch. The current converged skill catalogue is **241 canonical skills: 205 core + 36 market extensions**, with duplicate-ID protection and executable convergence checks.

## Core product path

```text
User/channel
  -> canonical Chat
  -> deterministic conversation acts + FastText signal
  -> skill/category convergence
  -> instruction-driven Skill Behaviour + Memory Profile
  -> canonical execution contract
  -> shared capability registry/executor
  -> Economic Request / assistance / reminder / safety / agent lifecycle
  -> evidence + notifications + commercial state
  -> completion / recovery / continuation
```

No per-skill chatbot architecture is used. Skill-specific behaviour is represented through shared behaviour packs, requirements, capabilities, execution contracts and targeted domain overrides.

## AI path

FastText remains a low-cost routing/classification signal. Thresholds are centralised and the system supports abstention. Unknown/uncertain inputs enter a privacy-safe review queue instead of being blindly promoted into training.

SmolLM2 is the lower-cost local/controlled reasoning path; hosted providers including Mistral remain escalation/hosted inference paths. Provider health/circuit state and AI usage/cost telemetry are part of the shared inference boundary. First-class agents have explicit inference-budget controls.

## Economic fulfilment

The shared Economic Request lifecycle supports provider, seller, delivery, service-provider and agent participants. Verification, quotes, payment, escrow, execution, evidence, completion and dispute remain separate truth-bearing states.

Catalogue/product discovery now has a shared inventory matcher over provider-declared products. It requires verified providers and explicit availability and does not invent stock or prices.

## Everyday skill outcomes

Bin-day is now represented by an authoritative schedule boundary that requires a provenance-bearing schedule before a reminder can be created. The schedule resolver supports postcode/address/council/waste-type matching, source freshness/expiry and a canonical reminder handoff.

Repair/device behaviour uses the device taxonomy and repair intake rather than treating all devices as one generic repair skill.

## Channels and clients

Web/PWA and the Expo mobile client use the same semantic platform state while keeping platform-specific presentation authorities. The Expo mobile workspace is part of the canonical repository and CI path for iOS/Android client typechecking, tests and server-bundle validation.

## External services

Kurukoo's repository contains activation seams and live-provider adapters for the configured external services. External credentials are deployment configuration, not blockers to repository implementation. A provider is only reported as active/verified/delivered when its adapter returns the corresponding evidence.

## Scale

The current low-cost single-instance SQL.js deployment remains valid for launch-scale conditions. Durable jobs, retry/lease semantics, provider health and atomic persistence are implemented. PostgreSQL/Redis/object-storage migration is a capacity/reliability decision, not a missing product feature.

## Acceptance rule

A capability is complete only when:

1. a user can enter through canonical Chat or an approved client/channel;
2. the correct skill/category can be resolved or the system abstains/asks;
3. Skill Behaviour contains the required questions and instructions;
4. Memory Profile participates without overriding newer user facts;
5. a canonical capability/execution contract exists;
6. the result is represented by a truth-bearing state and evidence;
7. the relevant notification/continuation path exists;
8. commercial state is handled through the shared economic authority where applicable;
9. CI or an equivalent contract prevents silent regression.

## Current implementation rule

Do not add parallel routers, skill engines, agent engines, billing systems, inventory systems, or per-channel business logic when the canonical shared authority already exists.

Historical audit documents may mention earlier skill counts, older branch states, or earlier activation limitations. They are evidence of prior states, not current architecture truth.
