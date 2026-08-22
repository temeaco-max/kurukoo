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
| Agent Brief and attention | `agentBriefService` with existing request, task, reminder, notification, Memory Profile and Agent Runtime owners | Implemented as a deterministic, read-only projection; browser/device speech and notification delivery remain runtime/device dependent. |
| Voice realtime | `voiceService` / `voiceRouter` | Implemented as optional Gemini Live capability; runtime availability is deployment-dependent. |
| Voice TTS | `serverTtsService` + browser `public/js/kurukoo-speech-output.js` | Browser/device speech is now the zero-cost baseline and is injected into canonical `/chat`; hosted TTS is optional. |
| Voice STT | browser/client voice input + server Mistral transcription adapter | Implemented adapters; provider/browser availability must be verified separately. |
| Notifications | canonical notification/push services | Implemented; delivery is runtime/provider-dependent. |
| Quick Ride | `quickRideDispatchService` + `economicDispatchCoordinator` | Merged to `main`; repository implementation exists. Provider dispatch/payment/FCM/WebRTC remain external activation boundaries. |
| Physical execution participant | `physicalExecutionParticipant` + `executionConnector` + canonical Economic Request participants | Foundation implemented as a typed extension of existing provider capability, dispatch, connector, authorization, evidence, communication, and notification owners. Repository contracts are tested; provider, vehicle, robot, drone, telemetry, location, and delivery activation remain external/unverified. |
| Discover | canonical discovery services | Implemented; source/availability claims remain evidence-bound. |
| Topics | canonical Topic services | Implemented/foundation depending on deployment surface. |
| Student model | `ml/` + canonical AI runtime | Training foundation exists; a Kurukoo-trained production adapter is **not** assumed until evaluation/registry evidence proves it. |

## 5. Locked Agent / communication foundation

`docs/architecture/KURUKOO_OS_AGENT_FOUNDATION.md` records the locked direction for one user-facing Kurukoo Agent, contextual messaging/calling, reusable Chat composition, lightweight voice presence, zero-cost Web Speech output, explicit realtime voice, opt-in proactive briefs, cross-OS Memory use, the canonical relationship/follow primitive, and future agent-to-agent/autonomous execution. It is subordinate to this document and does not itself assert that future capabilities are live.

## 5.1 Physical execution foundation

Physical coordination remains one canonical path rather than a delivery platform:

```text
user → Kurukoo Agent → canonical capability → Economic Request
     → selected existing provider/participant → execution connector
     → progress/evidence → reviewed outcome → existing memory/notification/continuation
```

`physicalExecutionParticipant` extends an existing verified provider skill declaration with a generic participant type (`human_driver`, `courier`, `delivery_provider`, `robot_taxi`, `autonomous_vehicle`, `drone`, or `robotic_delivery_system`), declared actions, service-area metadata, transport and payload constraints, bounded capacity, communication methods, evidence methods, and pricing metadata. It does not introduce a provider directory, a delivery/robot/drone order, a request lifecycle, an identity system, or an autonomous hardware integration. Matching reuses canonical capability discovery and filters only existing provider identity, availability, verification, capability, and declared physical constraints.

Physical actions are explicitly bounded to the canonical Economic Request, selected participant, declared capability/action, authorized connector, expiry, destination binding, safety-policy reference, and a caller-supplied minor-unit ceiling. The standard generic execution HTTP route rejects physical action names so external input cannot bypass this bounded contract. Dispatch rechecks the immutable request/destination binding, expiry, safety reference, provider availability, participant membership, and connector authorization immediately before connector invocation. An expired authorization reaches canonical terminal state `expired`; other failed checks fail closed. No retry loop, fleet manager, real-time tracking infrastructure, or automatic payment path is added.

Execution state remains the existing connector state machine, not a second persisted vocabulary: `pending` projects as **authorized**, `dispatched` as **assigned**, `acknowledged` as **accepted**, in-progress evidence may project **en route**, **arrived**, **picked up**, or **delivered**, and `succeeded` projects as **evidence pending** until canonical evidence review verifies suitable evidence. A participant or connector completion statement is only unverified or pending-review evidence; it cannot directly create a verified outcome. Cancellation, expiry, disappearance, revocation, destination change, malformed callbacks, duplicate idempotency keys, and unavailable connectors fail closed under existing canonical boundaries.

Location remains request/context data. The physical authorization record retains a one-way destination binding rather than raw address or coordinate values, and it does not make participant or user location public. Existing request-scoped provider communication sessions remain the only intended message, call, voice, or real-time communication owner. `quickRideDispatchService` already shapes taxi/bike/keke input into the same Economic Request plus `economicDispatchCoordinator` flow; future robot taxis or autonomous vehicles differ through participant capability, constraints, connector authorization, and evidence rather than a transport subsystem.

Future external agents remain constrained by `externalAgentCoordination`: an external agent is an Economic Request `external_platform` participant with a revocable, owner-scoped capability grant and canonical connector. It may relay to a future physical participant, but cannot become a second Kurukoo, recursively delegate unlimited work, alter destination or payment scope, or convert a callback claim into completion. The repository contract is **VERIFIED** through simulated participants and an authenticated local HTTP boundary. Deployment/runtime and real-world robot, drone, vehicle, courier, location, telemetry, call, payment, FCM, or OS-delivery claims remain **UNVERIFIED** or **BLOCKED_EXTERNAL** until independently activated and evidenced.

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

## 7. Agent Brief and attention contract

`agentBriefService` is the canonical **read-only, deterministic** Agent Brief projection. It prepares a small structured view of what matters from existing owner-scoped state, rather than creating a second notification service, task engine, reminder engine, Agent Runtime, memory system, or event bus. Each brief item keeps a stable canonical reference, category, priority, urgency, timestamp where available, source, concise user-facing summary, available read-only action, approval requirement, expiry where applicable, privacy classification, and deterministic attention posture. The brief never persists generated prose as canonical truth.

| Source concern | Existing canonical owner reused | Brief relationship |
|---|---|---|
| Requests and provider progress | `skillFlows` Economic Request lifecycle | The brief reads owner-scoped request status and links back to the exact request. It never declares a provider, payment, fulfilment, or completion state independently. Completed requests appear only within the bounded recent-completion window. |
| Tasks | `microTasks` / `taskRoutes` | The brief reads assigned task state only. It does not assign, complete, or mutate tasks. Canonical task lifecycle timestamps support the same bounded recent-completion treatment. |
| Reminders | `reminderService` | The brief projects due or near-term reminders without replacing reminder trigger delivery. |
| Notifications | `pushNotifications` | Existing internal notification/FCM queue remains the fallback delivery owner and retains its own queue idempotency. Only unread user-relevant notification records are eligible for brief aggregation. The brief uses generic category-safe wording rather than raw notification title or body text; an explicit notification view remains the canonical owner for message details. |
| Profile and Memory | `memoryProfile` and the existing Living Memory boundary | Existing encrypted profile preferences determine concise/detailed style, proactive voice, quiet hours, categories, and interruption sensitivity. The authenticated existing `/profile/update` boundary accepts a validated `proactive_brief` patch while preserving unrelated preferences. The brief does not create an Agent Preference identity store or an unbounded event memory. |
| Long-running work | `agentRuntime` | The brief surfaces bounded goal states such as working, waiting, completed, blocked, and needs-user, without exposing traces or changing the goal. |
| Conversation and context | `canonicalChatTurnService` and `contextArbitration` | “Anything important?” and equivalent brief questions resolve deterministically through the existing conversation owner; normal follow-up uses the same owner-scoped context and approval boundary. Each visible brief item resumes only its exact owner-scoped Request, Task, Reminder, Agent Runtime goal, or notification through the registered canonical context action; it never invokes an action or substitutes another object. |
| Safety and interaction policy | `capabilityInteractionPolicyService` and existing safety services | Existing capability policy supplies interruption semantics. A brief does not introduce a second safety engine. |

The attention policy has exactly four deterministic outcomes. It derives from existing capability interaction semantics and the user’s existing profile preferences. Classification describes **presentation only**; it never authorizes execution, confirmation, payment, publishing, contact, dispatch, or any other consequential action.

| Attention outcome | Meaning | Initial delivery posture |
|---|---|---|
| `IMMEDIATE` | An allowed critical safety interruption. | May visually interrupt and may speak only when voice and critical-interruption policy permit it. |
| `NOTIFY` | A high-priority item that is useful without demanding a disruptive interruption. | Uses the existing notification queue as a fallback; the user can review in Chat. |
| `NEXT_BRIEF` | A relevant update for the next suitable interaction. | Appears in the next prepared Chat brief. |
| `SILENT` | An item excluded by privacy/visibility or category preference, or work that does not merit an interruption. | Not presented by the Agent Brief. |

The Chat surface fetches the same structured brief when an authenticated user returns to an empty conversation, renders a lightweight card, and exposes a semantic Agent Presence state. Presence has no avatar and no live-audio requirement: `idle`, `thinking`, `speaking`, `working`, `waiting`, and `needs-attention` are the reusable visual states for Chat, proactive brief, future voice, and Agent workspace surfaces. `public/js/kurukoo-agent-presence.js` reuses the existing browser speech presence event; it does not establish a server session or a second presence authority.

Proactive speech is deliberately cheap and bounded. The normal path is **structured brief → deterministic response text → browser `SpeechSynthesis`**. It neither opens a permanent Gemini Live connection nor calls a model merely to discover state. Gemini Live remains an explicit realtime conversation mode. If browser speech is unavailable, blocked, disabled in Memory Profile, or suppressed by quiet hours, the exact same brief remains available as text and can use the existing notification queue fallback. Hosted TTS remains optional and is not required for a brief.

All brief retrieval is authenticated and owner-scoped. Items with restricted visibility are suppressed before presentation, already-read notification records and completions outside the seven-day recent-completion window are excluded, and notification summaries use category-safe generic wording that omits raw provider, communication, and safety content as well as internal tool traces, technical logs, and model reasoning. Safety-relevant items can receive a higher attention posture, but they remain subject to authorization, privacy, local policy, and established emergency boundaries. Agent Brief rendering and conversation continuation cannot bypass an `approvalRequired` state.

The cost model is intentionally bounded: aggregation reads small owner-scoped canonical lists, does not poll large datasets continuously, caches delivery identity through a narrow brief-delivery ledger, uses existing queue idempotency, and leaves language-model use to later conversational explanation rather than state discovery. Repository tests cover aggregation, duplicate suppression, read-notification suppression, generic notification summary privacy, bounded recent completion, attention, quiet hours, validated Memory Profile preference patches, owner privacy, Agent Runtime status, approval boundaries, browser speech wiring and unavailable fallback, notification fallback, exact item-level canonical continuation, and canonical conversation continuation. Live browser/device speech and external notification transport must still be verified separately for a deployment before being described as runtime or real-world verified.

## 8. Voice contract

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

## 9. Audit architecture rule

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
