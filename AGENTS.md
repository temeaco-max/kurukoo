# Kurukoo agent build rules

Reference `/BLUEPRINT.md` for the canonical architecture, schema, capabilities and product intent.

Also follow:
- `/docs/architecture/KURUKOO_BUILD_CONVERGENCE_CONTRACT.md`
- `/docs/architecture/CLIENT_APPLICATION_CONVERGENCE.md`
- `/docs/architecture/CURRENT_PRODUCT_TRUTH.md`
- `/docs/architecture/BLUEPRINT_TRUTH.md`

## Non-negotiable build principles

- `main` is the canonical integration branch for the platform OS build. Do not create a new product architecture on a parallel branch.
- Build for outcomes, not feature accumulation.
- Connect existing capabilities before creating new ones.
- Repair or repurpose existing systems before replacing them.
- Create a new subsystem only when a genuine architectural capability gap has been established.
- Treat Chat as the universal conversational control surface over canonical services, not as a second backend.
- Preserve one canonical identity, conversation, memory, presence, economic lifecycle, policy boundary and action protocol.
- AI may interpret, reason, communicate and coordinate, but canonical services own authority, mutation, execution and evidence.
- Never claim external activation, availability, payment, fulfilment or evidence that has not actually been established.
- Do not use tests or documentation as substitutes for implementation. Tests are evidence of behaviour; implementation must make the behaviour real.
- When a gap is found, implement the missing connection or capability in the existing architecture rather than adding an isolated feature merely to satisfy the scenario.
- Every change must be checked against the whole Kurukoo system, not only the local file or feature being edited.
- When existing work is on another branch, reconcile it into the canonical integration branch; preserve useful implementation, discard duplicates/superseded architecture, and avoid long-lived divergence.

## Client architecture — locked

Kurukoo is ONE OS exposed through multiple clients:

- Web App = public marketing experience + authenticated browser application.
- PWA = mobile-oriented Web App client, not a second backend.
- iOS/Android = native client renderers over the same canonical OS contracts.
- Admin = operator/control plane over the same OS, not a second consumer product.

Web and Mobile have two intentional visual systems. They share semantic design tokens, component meaning, interaction semantics, status/evidence language and product concepts, but may differ in layout/navigation/native mechanics.

Never:
- put the mobile screen set inside a Web page;
- put Web screen composition inside native mobile;
- create separate client-side sources of truth for identity, memory, requests, capabilities, agents, artifacts, providers, payments or subscriptions;
- create duplicate CSS/design-token authorities.

The canonical five mobile/PWA navigation anchors are:
`Agent`, `Discover`, `Requests`, `Tasks`, `Connect`.

Desktop Web represents the same semantic domains through a desktop navigation rail/sidebar/workspace composition; it does not copy a mobile bottom bar onto desktop.

Marketing routes can remain marketing-oriented, but authenticated users enter the same Web App shell and canonical OS state.

## Feature representation rule

Every canonical OS capability must have a declared client representation where appropriate. “Represented”, “implemented”, “contract-tested”, “externally verified”, and “production-active” are separate states.

A missing credential never justifies deleting a feature's UI/UX or state model. Build the real path, feature-flag it, test it with deterministic contracts/mocks, and make the unavailable state truthful.

## Source-of-truth rule

All Web/PWA/iOS/Android/Admin clients consume the same canonical server/service contracts. Local device state may exist only for cache, offline queues, rendering/session state, secure device credentials or explicitly non-authoritative local state.

User-owned durable artifacts prefer connected user-owned storage (Google Drive first). Kurukoo/managed storage is temporary processing, cache, retry staging, fallback or system-owned storage.

## Convergence rule

Before adding a file, route, service, component or CSS file:

1. Search the repository and history for an existing equivalent.
2. Identify the canonical owner.
3. Reuse/extend it where possible.
4. Only add a new artifact after proving the existing authority cannot own the behavior.
5. If two authorities exist, consolidate them and document the winner.

Any future agent working on Kurukoo must read the Client Application Convergence contract before modifying frontend/mobile architecture.
