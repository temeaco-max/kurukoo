# Kurukoo OS — Agent, Communication & Future Capability Foundation

**Status:** Directional product/architecture foundation. This document records the locked direction for future implementation; it does not claim that every capability below is currently live.

**Relationship to canonical architecture:** This is an implementation/product extension of `BLUEPRINT.md`, `BLUEPRINT_IMPLEMENTATION_ADDENDUM.md`, `BLUEPRINT_AI_MODEL_ADDENDUM.md`, and `KURUKOO_PRODUCT_SYSTEM_MAP.md`. Existing canonical services, tables, routes, conversation semantics, Economic Requests, Memory Profile, notifications, agents, provider communication, and channel boundaries remain authoritative.

## 1. North star

> **Kurukoo should become a personal coordination OS where the user interacts with one intelligent Kurukoo Agent while Kurukoo quietly coordinates people, providers, contributors, software agents, services, devices and, eventually, autonomous systems to get things done.**

The product should become **more capable without becoming more complicated**.

Kurukoo must not become a collection of mini-apps or a clone of social media, WhatsApp, a marketplace, a taxi application, or a generic chatbot. Mature interaction patterns may be adopted when they strengthen the Kurukoo OS model, but they must compose from existing canonical primitives wherever possible.

## 2. Core product principle: primitive before feature

Before adding a feature, inspect and reuse the existing primitive that already expresses most of the required behaviour.

| Desired capability | Preferred composition |
|---|---|
| Messaging | canonical Conversation/Chat |
| Voice input | existing browser mic/STT path + future pluggable speech input |
| Voice output | speech output abstraction; Web Speech is the zero-cost baseline |
| Realtime voice conversation | existing Gemini Live integration, behind the voice-session boundary |
| Calling | canonical communication session + contextual participant/request |
| Provider messaging/calling | Conversation + Economic Request + provider communication |
| Profile | canonical identity/Memory Profile + participant capabilities |
| Contacts | canonical identity/contact capability |
| Safety contact | Contact relationship + canonical Safety boundary |
| Follow/subscribe | relationship primitive + existing notification/context systems |
| Agent conversation | Conversation + Agent |
| Proactive brief | existing Requests/Tasks/Notifications/Memory + deterministic brief generation + Agent presentation |
| Agent work | existing Agent Runtime + canonical services/tools |
| Provider execution | Economic Request + execution connector + evidence |
| External agent coordination | canonical execution/participant boundary; never a second request lifecycle |
| Autonomous vehicle/robot/drone future | capability/connector participant using the same authorised execution/evidence model |

A new subsystem is justified only when the existing canonical boundary genuinely cannot express the requirement.

## 3. One user-facing Kurukoo Agent

The long-term user experience should converge on a recognisable **Kurukoo Agent** rather than making the user learn a collection of separate assistants.

The Agent is the user-facing intelligence/presentation layer. It may:

- converse by text;
- listen to speech;
- speak responses;
- present a lightweight visual voice state;
- explain what has been completed, pending, blocked or awaiting approval;
- invoke canonical Kurukoo capabilities;
- coordinate people, providers, contributors and other agents;
- remember permitted context through the canonical Memory Profile;
- continue work asynchronously;
- ask the user for approval when authority, safety, payment or other policy boundaries require it.

The Agent **must not own canonical truth**. Canonical services remain responsible for authorization, state mutation, idempotency, evidence and lifecycle truth.

## 4. Voice-first direction without an avatar dependency

Kurukoo does not require a persistent animated human/avatar.

The preferred future presentation is a lightweight **voice presence**:

```text
idle → listening → thinking → speaking → working → waiting → needs-attention
```

A small animated orb, waveform, ring, signal or equivalent semantic indicator is sufficient. The visual signal should communicate state without becoming a resource-heavy 3D character or video system.

Voice presence is an enhancement to the OS, not a replacement for direct UI access. Users must still be able to browse, search, inspect requests, message people, manage tasks, and use normal OS surfaces without speaking to the Agent.

## 5. Three voice modes

### Mode A — Push-to-talk / voice input

The current browser microphone path remains the low-cost baseline. Speech is converted to text and enters the same canonical Chat/Agent pipeline.

### Mode B — Conversational voice

A user can explicitly enter a realtime voice conversation. The existing Gemini Live implementation may provide this experience. It should remain behind a provider-neutral voice-session boundary so the model/provider can change without redesigning Kurukoo.

### Mode C — Proactive voice

With explicit user opt-in, Kurukoo may speak when a meaningful update warrants attention, for example:

> “Welcome back. Your repair is complete, your delivery is scheduled for tomorrow, and one request is waiting for your approval. Would you like me to go through it?”

Proactive voice must respect user preferences, quiet hours, attention policy, privacy, device context where available, and notification fallbacks. It must never behave as an always-listening microphone by default.

## 6. Cost architecture for voice

Kurukoo should use the cheapest capability that provides the required UX.

```text
Simple spoken update
  → response text
  → Web Speech / device speech synthesis
  → approximately zero Kurukoo inference cost

Enhanced branded voice
  → response text
  → hosted TTS adapter (future; e.g. Mistral Voxtral TTS or another cost-effective provider)

Natural realtime conversation
  → existing Gemini Live / future realtime voice adapter
```

The product must not assume that Gemini Live or any other provider remains permanently free. Gemini may remain a development/early deployment option, but voice must be provider-neutral.

Web Speech is a preferred zero-cost TTS fallback because synthesis can occur on the user's device. Device/browser voice availability varies, so it should not be the only long-term voice option.

Speech-to-text is separate from text-to-speech. Browser SpeechRecognition can be used where reliable, but the architecture must permit a hosted/local STT adapter later without changing the Chat/Agent contract.

## 7. Voice provider abstraction

Do not create a second voice architecture.

The conceptual boundary should remain small:

```text
SpeechInput
SpeechOutput
VoiceSession
AgentPresence
```

Implementations may include:

- browser/device speech recognition;
- browser/device speech synthesis;
- Gemini Live;
- future hosted/local STT/TTS;
- future realtime voice providers.

The Agent and Chat UI must not contain provider-specific business logic beyond the adapter boundary.

## 8. Proactive Agent / JARVIS-like brief

Kurukoo may eventually behave like a quiet personal operating agent: when the user returns or when an important event occurs, it can provide a concise brief covering:

- completed work;
- pending work;
- requests needing user input;
- upcoming tasks/reminders;
- provider updates;
- important notifications;
- safety-relevant events;
- agent work that is waiting or completed.

The expensive AI model should not be responsible for continuously monitoring the entire system. Existing deterministic services should assemble a structured brief first.

```text
Requests / Tasks / Notifications / Memory / Provider updates
                         ↓
                 deterministic brief
                         ↓
                    attention policy
                         ↓
                    Kurukoo Agent
                         ↓
                 text and/or voice
```

## 9. Attention policy

Every proactive event should be classified before interrupting the user:

- **Immediate voice:** important/time-sensitive and user has opted in.
- **Quiet notification:** useful but not worth interruption.
- **Next brief:** useful context that can wait.
- **Silent:** no user-facing interruption required.

This policy should initially be deterministic and configurable. AI may assist with wording and prioritisation, but canonical state and user preferences remain authoritative.

## 10. Contextual universal composer

The existing Chat composer should be treated as a reusable **communication/action primitive**, not as a component that belongs only to `/chat`.

The same underlying composer can adapt its context:

- `Message Kurukoo…`
- `Message Sarah…`
- `Message provider…`
- `Reply…`
- `Add information…`
- `Tell Agent what to do…`

Capabilities such as attachment, voice, call, submit/send, or contextual actions should be enabled according to the current participant/request/context rather than by creating separate messaging systems.

## 11. Communication model

Calling and messaging are contextual communication capabilities.

A call icon should appear where a legitimate communication target exists:

- person profile;
- participant conversation header;
- provider/request communication surface;
- active fulfilment/request where calling is authorised.

Calling should not become a permanent top-level destination unless future usage data demonstrates that it needs one.

Provider communication is part of the canonical Economic Request/communication context:

```text
Economic Request
  ├─ status
  ├─ participant/provider
  ├─ evidence
  ├─ location/context
  └─ communication
       ├─ messages
       ├─ voice
       └─ video/call where enabled
```

No category-specific provider chat system should be introduced.

## 12. People, contacts and relationships

Kurukoo should support a single identity with multiple roles/capabilities. A person can be a friend/contact, safety contact, contributor, provider, or participant in a request without becoming multiple user records.

Contacts should reuse the canonical identity/profile boundary. Contact synchronisation, where implemented, should primarily support discovery, invitations and relationship management rather than creating a second identity database.

### Follow / subscribe — future capability

A relationship primitive may eventually support following/subscribing to:

- people;
- contributors;
- providers;
- Topics;
- Opportunities;
- other eligible public/shared objects.

Follow should not create a social-media subsystem. Its effects should flow through existing Discover, Topics, Opportunities, Notifications and Memory/context surfaces.

The meaning of a follow relationship must be contextual and privacy-aware. It is a future capability, not a requirement to expose a “social feed”.

## 13. Memory as an OS advantage

Memory must be used as a quiet capability across the OS, not primarily as a standalone page.

Examples:

- previous provider used successfully;
- saved communication preferences;
- usual locations or routines where permitted;
- recurring tasks and intentions;
- relationship/context continuity;
- previous request context;
- user preferences that reduce repetitive questions;
- agent continuity across interrupted goals.

Memory should improve the experience without fabricating facts or exposing private information beyond the user's controls.

The canonical Memory Profile remains the authority. Do not create a second “social memory”, “agent memory”, “voice memory” or “profile memory” system.

## 14. Agent-to-agent coordination

This is a future strategic capability, not a claim that arbitrary external agents can currently transact with Kurukoo.

The long-term model is:

```text
User goal
   ↓
Kurukoo Agent
   ↓
canonical request/coordination
   ├─ human provider
   ├─ contributor
   ├─ Kurukoo agent
   ├─ external software agent
   ├─ business/API agent
   └─ future autonomous system
```

Kurukoo should eventually be able to coordinate multi-step goals such as:

> sell an item → assess whether repair increases value → arrange repair → obtain sale → arrange collection/delivery → confirm outcome.

The user should see one coherent goal/conversation, while the underlying participants may be many.

Every external participant must have explicit capability/authorization boundaries, idempotency, evidence and fail-closed behaviour. Agent-to-agent communication must never bypass Economic Request, safety, payment, privacy or execution authority.

## 15. Autonomous systems / physical network direction

Future drones, robot taxis, autonomous delivery systems, vehicles, devices and similar systems should be modelled as execution participants/capabilities where appropriate rather than as new product silos.

The architectural test is:

> Can this participant advertise a capability, receive an authorised request, report progress, and provide evidence of an outcome through a controlled connector?

If yes, it can potentially participate in the same coordination model.

This does **not** make autonomous execution live today. External contracts, authentication, safety, regulatory controls, hardware interfaces and evidence must exist before Kurukoo claims or performs such actions.

## 16. AI model strategy

Kurukoo should use a model hierarchy rather than one expensive model for every task.

```text
Simple/deterministic
  → rules / FastText / existing services

Local/low-cost semantic work
  → Kurukoo-specialised SmolLM2 or another approved local model

Hosted text reasoning where justified
  → configured cost-effective provider/model

Realtime natural voice
  → configured Live/voice model

Speech output
  → Web Speech first; hosted TTS when justified
```

The Brain/canonical coordinator remains responsible for context arbitration. Models propose meaning or wording; canonical services own truth and mutation.

Do not add a new AI provider merely because it offers a feature already covered by an existing adapter. Add a provider only when the capability/cost/quality boundary is materially improved.

## 17. Implementation stages

### Can be implemented/composed now where current foundations support it

- reusable contextual Chat composer;
- contextual message/call affordances using existing communication boundaries;
- voice-state UI using the existing voice session;
- Web Speech TTS fallback for generated text;
- Agent presence states;
- structured Agent brief generated from existing Requests/Tasks/Notifications/Memory;
- explicit proactive-voice preference and attention policy foundations;
- profile/contact/safety-contact composition using existing identity and safety boundaries;
- stronger Memory usage in contextual responses;
- architecture contracts for provider-neutral voice adapters;
- documentation/tests that prevent duplicate conversation, identity, memory, notification and economic systems.

### Near-term after current Chat/voice stability

- robust conversational voice mode;
- proactive brief delivery when explicitly enabled;
- hosted TTS adapter where a consistent Kurukoo voice is justified;
- richer contextual provider communication;
- relationship/follow primitives if validated by product usage;
- Agent tool coverage over existing canonical services;
- continuity of long-running user goals.

### Future

- agent-to-agent protocols/connectors;
- external business agents;
- autonomous delivery/robot/vehicle participants;
- richer voice interaction and interruption handling;
- physical/autonomous network orchestration;
- advanced economic coordination and multi-party settlement.

## 18. Cost and complexity laws

1. Prefer user-device capabilities when they are sufficient.
2. Prefer deterministic existing services before invoking an LLM.
3. Prefer one existing canonical service over a new feature-specific service.
4. Prefer asynchronous work over always-on realtime sessions.
5. Never keep a realtime voice model connected simply because the user is logged in.
6. Never make an expensive model the only path for a simple notification or brief.
7. Do not add infrastructure before actual scale/operational requirements justify it.
8. Do not create duplicate identity, conversation, memory, notification, provider communication, economic or agent lifecycles.
9. Preserve the two consumer visual systems: Web visual system for public Web + Web Chat, and Mobile visual system for PWA/iOS/Android, with shared semantic tokens/OS concepts but distinct composition/navigation.
10. New capability foundations must not leak future/unavailable functionality into current marketing or UI claims.

## 19. Visual-system implications

The future OS visual system should support a consistent vocabulary for:

- identity and avatars;
- presence/voice state;
- message/call/video actions;
- participant roles;
- request/context state;
- agent activity;
- pending/completed/blocked/awaiting-user states;
- notifications and proactive briefs;
- contextual sheets/drawers/inspectors;
- lightweight voice presence.

These are semantic design primitives. They should be shared across the appropriate visual families without collapsing the Web and Mobile compositions into one screen system.

The eventual visual audit must verify that the actual implementation uses these primitives consistently and that the concept screen sets remain the visual authority rather than allowing feature-specific styling to drift.

## 20. Foundation rule for Manus and future agents

Before implementing any capability described here:

1. inspect current `main` and the active implementation branch;
2. identify existing canonical services/routes/components;
3. compose from them where possible;
4. make the smallest necessary change;
5. do not start an isolated feature phase;
6. do not create parallel authorities;
7. keep future capabilities represented as contracts/foundations rather than fake live integrations;
8. run existing relevant tests/build/audits;
9. document the resulting canonical owner and integration boundary;
10. keep the user-facing experience simpler even when the backend becomes more capable.

## 21. Locked product test

Every future Kurukoo capability should be tested against this question:

> **Can Kurukoo make the capability available to the user without making the user learn another system?**

If the answer is yes through existing primitives, compose it.

If the answer requires a new subsystem, first prove that the existing canonical boundaries cannot express it.

The desired outcome is a Kurukoo OS that can coordinate increasingly complex real-world work while presenting the user with an increasingly simple interaction: **tell Kurukoo, speak to Kurukoo, or act directly in the OS — and Kurukoo handles the complexity behind the scenes.**
