# Kurukoo — Current Product Truth

**Authority:** This is the single current-state product truth document. Other matrices, audits, reports and snapshots are supporting evidence only; they must not override this document or canonical code/tests.

**Last reconciled:** 22 August 2026

## 1. Truth hierarchy

1. `BLUEPRINT.md` — product/architecture intent.
2. `docs/architecture/CURRENT_PRODUCT_TRUTH.md` — current-state classification and ownership.
3. Canonical production code — what is actually implemented.
4. Behavioural/contract tests — repository/runtime evidence.
5. Live/device/external-provider evidence — real-world activation evidence.

If two sources disagree, the lower source cannot silently upgrade the higher-level claim. Reconcile the contradiction explicitly.

## 2. Verification model

Every capability has three independent verification dimensions:

| Dimension | Meaning |
|---|---|
| Repository verification | Code, ownership, buildability and deterministic contract evidence exist on canonical `main`. |
| Runtime verification | The deployed application actually completes the relevant user journey in a controlled environment. |
| Real-world verification | External provider/device/person actually performs the outcome with evidence. |

Each dimension is classified as `VERIFIED`, `PARTIAL`, `UNVERIFIED`, `BLOCKED_EXTERNAL`, or `NOT_APPLICABLE`.

**UNVERIFIED is a first-class state.** It means evidence has not been obtained recently enough to claim success. It is never converted to complete by documentation, a registry entry, a route, or the existence of a test alone.

## 3. Product status vocabulary

- `FOUNDATION`: architectural contract exists; capability is not represented as live.
- `IMPLEMENTED`: canonical code exists and is wired, but the relevant verification dimension is not yet proven.
- `VERIFIED`: the relevant verification dimension has direct evidence.
- `PARTIAL`: some path is proven but a required portion remains incomplete.
- `BLOCKED_EXTERNAL`: repository path is implemented, but external credentials/provider/device/contract activation is required.
- `UNVERIFIED`: implementation or claim exists but current evidence is insufficient.
- `SUPERSEDED`: replaced by a canonical owner; retain only when required for history/migration.
- `NOT_IMPLEMENTED`: no usable implementation exists.

Never use `COMPLETE`, `DONE`, `LIVE`, `READY`, `PRODUCTION`, or `VERIFIED` as a generic label without naming the verification dimension.

## 4. Current canonical owners

| Capability | Canonical owner | Current truth |
|---|---|---|
| Conversation | `canonicalChatTurnService` + `chatConversationService` | Implemented; runtime must still be live-verified on every release candidate. |
| Context arbitration | `contextArbitration` | Implemented; repository-tested. |
| Conversation memory context | `conversationContextPackService` + `memoryProfile` | Implemented and integrated into conversational generation; carries owner-scoped identity, preferences, stable facts and recent thread context with provenance safeguards. |
| Identity | authenticated user + `memory_profiles` | Implemented; external identity-provider activation remains deployment-specific. |
| Relationships / Follow | `relationshipService` + `relationships`; Discover delegates Follow actions to this owner | Implemented as an owner-private, generic relationship primitive. It validates eligible public/shared targets, remains independent from authorization/contact/safety state, and reuses canonical notifications. Runtime verification remains required for each user journey. |
| Memory | `memoryProfile` + `livingMemoryEngine` | Implemented as a cross-OS capability; self-service/revocation and provenance exist. Broader product opportunities remain, but no second memory system should be created. |
| Economic Request | canonical Economic Request lifecycle in `skillFlows` and related services | Implemented; real-world fulfilment is external/provider-dependent. |
| Provider communication | request-scoped provider communication/session boundary | Implemented; WebRTC/PSTN activation is external. |
| Agent runtime | `agentRuntime` / canonical Agent services | Implemented with bounded execution; autonomous external actions remain policy/provider dependent. |
| Voice realtime | `voiceService` / `voiceRouter` | Implemented as optional Gemini Live capability; runtime availability is deployment-dependent. |
| Voice TTS | `serverTtsService` + browser `public/js/kurukoo-speech-output.js` | Browser/device speech is now the zero-cost baseline and is injected into canonical `/chat`; hosted TTS is optional. |
| Voice STT | browser/client voice input + server Mistral transcription adapter | Implemented adapters; provider/browser availability must be verified separately. |
| Notifications | canonical notification/push services | Implemented; delivery is runtime/provider-dependent. |
| Quick Ride | `quickRideDispatchService` + `economicDispatchCoordinator` | Merged to `main`; repository implementation exists. Provider dispatch/payment/FCM/WebRTC remain external activation boundaries. |
| Discover | canonical discovery services | Implemented; source/availability claims remain evidence-bound. |
| Topics | canonical Topic services | Implemented/foundation depending on deployment surface. |
| Student model | `ml/` + canonical AI runtime | Training foundation exists; a Kurukoo-trained production adapter is **not** assumed until evaluation/registry evidence proves it. |

## 5. Locked Agent / communication foundation

`docs/architecture/KURUKOO_OS_AGENT_FOUNDATION.md` records the locked direction for one user-facing Kurukoo Agent, contextual messaging/calling, reusable Chat composition, lightweight voice presence, zero-cost Web Speech output, explicit realtime voice, opt-in proactive briefs, cross-OS Memory use, the canonical relationship/follow primitive, and future agent-to-agent/autonomous execution. It is subordinate to this document and does not itself assert that future capabilities are live.

## 6. Memory utilisation contract

Memory is not a standalone page feature. It is a cross-OS capability.

The repository already has a canonical identity/memory projection and a conversation context pack used by conversational generation. This is the correct foundation; do not replace it with an Agent-memory, voice-memory or social-memory subsystem.

Approved uses, subject to provenance, consent and privacy policy:

- identity and preferred name;
- communication preferences;
- recurring tasks/reminders and user-approved routines;
- prior request context and continuation;
- prior provider/outcome context where permitted;
- saved preferences that reduce repeated clarification;
- Agent goal continuity;
- voice-session context;
- proactive brief composition;
- contextual composer defaults;
- relevant Discover/Topic context.

Memory must not be used to invent current availability, prices, provider verification, payment success, safety delivery, or external fulfilment. Canonical services remain authoritative.

## 7. Voice contract

Kurukoo uses the cheapest sufficient speech path:

```text
response text
  ↓
Browser/device SpeechSynthesis (zero Kurukoo inference cost)
  ↓
optional hosted TTS adapter when consistent/richer voice is justified
  ↓
explicit realtime voice session when the user chooses realtime conversation
```

There is no requirement for a persistent avatar. Voice presence is represented through lightweight semantic states such as `idle`, `listening`, `thinking`, `speaking`, `working`, and `needs-attention`.

Realtime voice must never be permanently connected simply because a user is logged in. Proactive speech requires explicit opt-in, attention policy and privacy/quiet-hour controls.

## 8. Audit architecture rule

The repository must not maintain multiple competing completion authorities.

Focused tests may remain when they prove a concrete behaviour, such as accessibility, security, CSS integrity, voice boundaries or Economic Request lifecycle. They are evidence producers, not product truth authorities.

The following are **reports/evidence**, not authorities:

- feature matrices;
- page architecture matrices;
- client coverage matrices;
- dated visual audits;
- generated completeness reports;
- reconciliation snapshots;
- historical phase audits.

A report that is stale must be regenerated or marked historical; it must never be used to override current code/evidence.

The compatibility commands `audit:complete` and `audit:main-truth` now delegate to the canonical repository truth gate and no longer create independent completion/reconciliation claims.

## 9. Branch/release policy

`main` is the only canonical integration branch.

Working branches are short-lived and must be classified as one of:

- `ACTIVE`: contains current work intended for merge;
- `REVIEW`: open PR under active review;
- `HISTORICAL`: retained only until safely archived/deleted;
- `SUPERSEDED`: no unique work remains;
- `RELEASE`: temporary release candidate only.

No parallel `integration/*`, `convergence-*`, `near-completion-*`, `final-*` or duplicate product architecture branches may become a second source of truth.

Before closing a work item, compare it with current `main`, identify unique commits/files, merge useful work, close obsolete PRs, then delete the branch. If branch deletion is not available through the automation surface, record it as a GitHub maintenance action; do not pretend the branch has been deleted.

## 10. Release gate

A release candidate is not accepted because a document says complete. It must have:

- repository verification for all claimed active capabilities;
- runtime verification for the core journeys;
- explicit external activation status for every provider/device boundary;
- no unresolved contradiction in canonical docs;
- no stale generated truth snapshot presented as current;
- no open PR that is a competing version of the same architecture;
- no known broken canonical Chat path.

## 11. Core journeys that matter most

Before adding breadth, prove these repeatedly:

1. Conversation → authentication → memory → continuation.
2. Conversation → Economic Request → evidence-bound outcome.
3. Conversation → reminder/task → notification → continuation.
4. Conversation → voice input/output → same canonical conversation.
5. Conversation → Agent goal → bounded execution → outcome.
6. Quick Ride → Economic Request → dispatch lifecycle → provider communication → review, with external activation explicitly separated.

Kurukoo should spend more engineering time proving these journeys work than proving that the repository contains feature names.
