# Kurukoo agent build rules

Reference `/BLUEPRINT.md` for canonical architecture, schema, capabilities and product intent.

## Canonical engineering authorities

- `/docs/architecture/CURRENT_PRODUCT_TRUTH.md` — **single current-state product truth authority**.
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
- Build for outcomes, not feature accumulation.
- Connect existing capabilities before creating new ones.
- Repair or repurpose existing systems before replacing them.
- Create a new subsystem only when a genuine architectural capability gap has been established.
- Treat Chat as the universal conversational control surface over canonical services, not as a second backend.
- Preserve one canonical identity, conversation, memory, presence, economic lifecycle, policy boundary and action protocol.
- AI may interpret, reason, communicate and coordinate, but canonical services own authority, mutation, execution and evidence.
- Never claim external activation, availability, payment, fulfilment or evidence that has not actually been established.
- Tests are evidence of behaviour; documentation is intent/state; neither substitutes for a working implementation.
- Every change must be checked against the whole Kurukoo system, not only the local file or feature being edited.
- Reconcile useful work from other branches into `main`; discard duplicate/superseded architecture rather than allowing long-lived divergence.

## Client architecture — locked

Kurukoo is ONE OS exposed through multiple clients:

- Web App = public marketing experience + authenticated browser application.
- PWA = mobile-oriented Web App client, not a second backend.
- iOS/Android = native client renderers over the same canonical OS contracts.
- Admin = operator/control plane over the same OS, not a second consumer product.

Web and Mobile have two intentional visual systems. They share semantic design tokens, component meaning, interaction semantics, status/evidence language and product concepts, but may differ in layout/navigation/native mechanics.

Never create separate client-side sources of truth for identity, memory, requests, capabilities, agents, artifacts, providers, payments or subscriptions.

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
