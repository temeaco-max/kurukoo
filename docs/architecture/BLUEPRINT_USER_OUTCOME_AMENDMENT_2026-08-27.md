# Kurukoo — Blueprint User-Outcome Amendment — 2026-08-27

## Purpose

This amendment records the current product-direction correction that must be applied when interpreting the long Blueprint and implementing Kurukoo. It does not delete the broad Blueprint scope; it makes the user-facing meaning of that scope explicit.

## Product definition

> **Kurukoo is a service that helps people get things done.**
>
> You tell Kurukoo what you need, want, notice, or are worried about.
>
> Kurukoo understands the situation, works out what it can do, takes appropriate action, gets help from people or services when necessary, keeps you informed, and remembers what matters.

This is the user-level definition of the entire Kurukoo product. Earlier descriptions such as “conversational fulfilment network”, “personal assistance platform”, “conversational operating system”, “Economic OS”, or “orchestration network” describe progressively more technical or architectural aspects and must not narrow the product to a marketplace, fulfilment workflow, chatbot, channel, or vertical.

## Broad scope remains active

The following are all part of the same service and should continue to advance together where relevant:

- everyday personal assistance;
- questions, information and advice;
- tasks, reminders and follow-up;
- memory and continuity;
- discovery and Topics;
- services, providers and businesses;
- products, shopping and sourcing;
- rides, food, logistics and delivery;
- device and technology help;
- diagnostics, maintenance and repair;
- Wi-Fi, networks and connected resources;
- IoT and universal/remote control where technically supported;
- agents and autonomous work;
- human/provider assistance and provider copiloting;
- Economic Requests and commercial coordination;
- payments and financial boundaries where activated;
- notifications and proactive attention;
- Web, PWA, native and external channels;
- physical participants and future autonomous physical systems;
- safety, trust, privacy and evidence;
- business, contributor, partner and operator experiences.

This is not a checklist that limits future capability. It is a reminder of the breadth that must not be lost while a specific vertical or integration is being implemented.

## Implementation interpretation

Do not build separate vertical product architectures merely because a new user need has a different noun. First compose existing Kurukoo skills, behaviour instructions, capabilities, tools, agents, connected resources, canonical services, Economic Requests, providers, evidence, notifications and channels.

The user asks for an outcome. Kurukoo determines the appropriate means.

For example:

```text
“My laptop is slow. Check it.”
        ↓
understand the need
        ↓
use available connected-resource/device information
        ↓
inspect/diagnose with available capabilities and tools
        ↓
explain findings
        ↓
safely act when authorised
        ↓
verify the result
        ↓
if necessary, continue to a human/provider outcome
```

The same principle applies to Wi-Fi, phones, TVs, printers, IoT resources, travel, food, errands, products, services, reminders, monitoring and future capabilities.

## Boundaries: remove artificial limits, retain real ones

Existing product restrictions that only exist because a use case was not previously listed should be removed or generalised where the current architecture can support the behaviour.

Real boundaries remain mandatory:

- operating-system and device capability restrictions;
- user permissions and consent;
- authentication and authorization;
- privacy and data minimisation;
- safety and high-impact action policy;
- legal/regulatory requirements;
- external provider/connector availability;
- reliable evidence and verification;
- payment/financial controls;
- security and abuse prevention.

“Total functionality” means pushing Kurukoo toward useful completion wherever these real boundaries allow it. It does not mean bypassing them.

## User-facing perspective

Public and authenticated user pages should be designed around outcomes, examples, status, choices, permission requests, results and next actions. Internal terms should stay out of the user's way unless they are genuinely useful.

The user should be able to understand:

- what Kurukoo can help with;
- what it is doing;
- what it needs from them;
- what happened;
- what needs attention;
- what happens next.

## In-house perspective

Admin, operations, provider, developer and support surfaces should expose the operational truth required to run Kurukoo:

- object ownership and canonical authority;
- lifecycle and execution state;
- capability/tool availability;
- agent goals and actions;
- device/connected-resource state;
- provider and connector readiness;
- evidence and verification;
- permissions and authorization;
- failures, expiry, recovery and idempotency;
- notifications/channel delivery state;
- deployment and external activation;
- audit and observability.

These surfaces must remain views/control planes over the same Kurukoo state, not parallel products.

## Continuous completion rule

Every new feature or correction must be checked against the whole service before merge. If the feature affects a concept used elsewhere, the relevant existing surfaces must either benefit automatically through canonical composition or be updated deliberately.

A feature is not considered product-complete merely because its local page, route, registry row, skill, or test exists. The meaningful question is whether a person can now get something done more reliably, simply, or completely with Kurukoo.

This amendment is interpreted together with `BLUEPRINT.md`, `docs/architecture/CURRENT_PRODUCT_TRUTH.md`, `AGENTS.md`, and `docs/product/KURUKOO_USER_OUTCOME_CONTRACT.md`. Where an older product description is narrower than this user-outcome definition, use this amendment and the current outcome contract as the intended direction and reconcile the older wording rather than carrying the narrower interpretation into new work.
