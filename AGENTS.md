# Kurukoo agent build rules

Reference `/BLUEPRINT.md` for canonical architecture and long-range product intent, `/docs/architecture/CURRENT_PRODUCT_TRUTH.md` for current-state truth, and `/docs/product/KURUKOO_USER_OUTCOME_CONTRACT.md` for the user-outcome lens that must guide every implementation decision.

## Product north star — user outcome first

> **Kurukoo is a service that helps people get things done.**
>
> You tell Kurukoo what you need, want, notice, or are worried about.
>
> Kurukoo understands the situation, works out what it can do, takes appropriate action, gets help from people or services when necessary, keeps you informed, and remembers what matters.

Users do not need to understand skills, capabilities, agents, MCP, connectors, Economic Requests, evidence machinery, or internal services. Those are implementation means. Engineering work must begin with the user outcome and then reuse the existing Kurukoo machinery to produce it.

Do not let the current feature, vertical, page, integration, or PR become the definition of Kurukoo. The whole service remains in scope: personal assistance, everyday work, discovery, providers, services, products, memory, tasks, reminders, safety, economic coordination, agents, connected devices, IoT, external channels, physical execution, and future capabilities.

## Canonical engineering authorities

- `/BLUEPRINT.md` — canonical product/architecture intent and long-range scope.
- `/docs/architecture/CURRENT_PRODUCT_TRUTH.md` — **single current-state product truth authority**.
- `/docs/product/KURUKOO_USER_OUTCOME_CONTRACT.md` — canonical user-outcome interpretation and product experience contract.
- `/docs/architecture/KURUKOO_BUILD_CONVERGENCE_CONTRACT.md` — build/convergence rules.
- `/docs/architecture/CLIENT_APPLICATION_CONVERGENCE.md` — Web/PWA/native client boundaries.
- `/docs/architecture/BLUEPRINT_TRUTH.md` — architecture interpretation and historical reconciliation context.

Feature matrices, page matrices, completeness reports, visual audits and reconciliation snapshots are **supporting evidence, not authorities**.

## Verification law

Every meaningful capability has three independent dimensions:

1. **Repository verification** — canonical code/ownership/build and deterministic contract evidence.
2. **Runtime verification** — the deployed application completes the relevant journey in a controlled environment.
3. **Real-world verification** — external provider/device/person completes the outcome with evidence.

Each dimension must be classified `VERIFIED`, `PARTIAL`, `UNVERIFIED`, `BLOCKED_EXTERNAL`, or `NOT_APPLICABLE`. `UNVERIFIED` is a valid and visible state; never upgrade it because a test, route, registry row or document exists.

## Non-negotiable build principles

- `main` is the only canonical integration branch for the platform OS build.
- Build for user outcomes, not feature accumulation or internal architectural milestones.
- Connect existing capabilities before creating new ones.
- Repair or repurpose existing systems before replacing them.
- Do not create a new subsystem, vertical engine, agent family, device layer, notification layer, provider system, or other parallel authority when existing Kurukoo primitives can be composed or extended.
- Remove artificial product restrictions where existing capabilities can reasonably support the user's need.
- Preserve genuine safety, privacy, consent, authorization, evidence, security, legal, and truthfulness boundaries; these are not artificial capability ceilings.
- Treat Chat as the universal conversational control surface over canonical services, not as a second backend.
- Preserve one canonical identity, conversation, memory, presence, economic lifecycle, policy boundary and action protocol.
- AI may interpret, reason, communicate and coordinate, but canonical services own authority, mutation, execution and evidence.
- Never claim external activation, availability, payment, fulfilment or evidence that has not actually been established.
- Tests are evidence of behaviour; documentation is intent/state; neither substitutes for a working implementation.
- Every change must be checked against the whole Kurukoo system, not only the local file or feature being edited.
- Every meaningful feature must consider the user-facing experience, authenticated OS experience, relevant agent/capability/tool composition, connected resources where applicable, memory/continuity, notification/channel continuity, human/provider escalation, and internal operator observability where applicable.
- Reconcile useful work from other branches into `main`; discard duplicate/superseded architecture rather than allowing long-lived divergence.

## Capability expansion rule

When a user asks Kurukoo to do something new, first ask what the existing system can already do with composition. A need should be mapped across existing skills, behaviour instructions, capabilities, agent tools, connected resources, AI/model adapters, canonical services, Economic Requests, providers, physical participants, evidence and notification/channel mechanisms before introducing a new abstraction.

Kurukoo should prefer direct help before escalation. If it can safely inspect, diagnose, explain, monitor, or resolve a problem with available and authorised capabilities, it should do so before asking the user to find a human. If it cannot, it should carry the useful context into the best available next step rather than making the user start again.

“Total functionality” means maximising useful capability and reducing unnecessary product restrictions. It does **not** mean bypassing permissions, authorization, safety, privacy, or evidence requirements.

## Client architecture — locked

Kurukoo is ONE OS exposed through multiple clients:

- Web App = public marketing experience + authenticated browser application.
- PWA = mobile-oriented Web App client, not a second backend.
- iOS/Android = native client renderers over the same canonical OS contracts.
- Admin = operator/control plane over the same OS, not a second consumer product.

Web and Mobile have two intentional visual systems. They share semantic design tokens, component meaning, interaction semantics, status/evidence language and product concepts, but may differ in layout/navigation/native mechanics.

Never create separate client-side sources of truth for identity, memory, requests, capabilities, agents, artifacts, providers, payments or subscriptions.

## Surface perspective rule

Public/user-facing surfaces answer: **What can Kurukoo do for me, what is happening, what do you need from me, what happened, and what can I do next?** They should use plain language and lead with outcomes, examples, status, choices and next actions.

Admin/operator/provider/developer surfaces answer: **What is happening inside the service, what owns it, what is enabled, what failed, what evidence exists, what needs intervention, and what is safe to change?** They may expose technical identifiers, lifecycle states, connector health, agent execution, evidence, audit data, deployment state and recovery controls.

Neither perspective may create a separate source of truth.

## Feature representation rule

“Represented”, “implemented”, “repository verified”, “runtime verified”, “real-world verified”, and “production-active” are separate states. A missing credential never justifies deleting a truthful UI/state model; instead expose the unavailable boundary clearly.

## Source-of-truth rule

All Web/PWA/iOS/Android/Admin clients consume the same canonical server/service contracts. Local device state may exist only for cache, offline queues, rendering/session state, secure device credentials or explicitly non-authoritative local state.

## Convergence rule

Before adding a file, route, service, component or CSS file:

1. Search the repository and history for an existing equivalent.
2. Identify the canonical owner.
3. Reuse/extend it where possible.
4. Only add a new artifact after proving the existing authority cannot own the behavior.
5. If two authorities exist, consolidate them and document the winner.

## Branch rule

Use short-lived working branches and one canonical `main`. Do not create parallel `integration/*`, `convergence-*`, `near-completion-*`, `final-*` or duplicate product architecture branches. Before closing work, compare with current `main`, merge useful unique work, close obsolete PRs and delete obsolete branches. If branch deletion cannot be automated, explicitly record that GitHub maintenance action instead of claiming it happened.

## Voice rule

Use the cheapest sufficient speech path. Browser/device `SpeechSynthesis` is the zero-cost baseline for speaking response text. Hosted TTS and realtime voice are optional adapters. Never keep a realtime voice session open merely because a user is logged in, and never introduce a second voice conversation authority.

## Memory rule

Memory Profile is a cross-OS capability, not a standalone page. Reuse it for approved identity, preferences, request continuity, Agent goals, voice context and proactive brief composition. Never use memory as evidence of current availability, price, verification, payment, safety delivery or fulfilment.
