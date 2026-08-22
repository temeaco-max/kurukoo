# Kurukoo OS — Agent, Communication & Future Capability Foundation

**Status:** Directional product/architecture foundation. This document records the locked direction for future implementation; it does not claim that every capability below is currently live.

**Authority:** This document is subordinate to `BLUEPRINT.md` and `docs/architecture/CURRENT_PRODUCT_TRUTH.md`. Existing canonical services, tables, routes, conversation semantics, Economic Requests, Memory Profile, notifications, agents, provider communication and channel boundaries remain authoritative.

## 1. North star

Kurukoo should become a personal coordination OS where the user interacts with one intelligent Kurukoo Agent while Kurukoo quietly coordinates people, providers, contributors, software agents, services, devices and, eventually, autonomous systems to get things done.

The product should become **more capable without becoming more complicated**.

Kurukoo must not become a collection of mini-apps or a clone of social media, WhatsApp, a marketplace, a taxi application, or a generic chatbot. Mature interaction patterns may be adopted when they strengthen the Kurukoo OS model, but they must compose from existing canonical primitives wherever possible.

## 2. Primitive before feature

| Desired capability | Preferred composition |
|---|---|
| Messaging | canonical Conversation/Chat |
| Voice input | existing browser mic/STT path + pluggable speech input |
| Voice output | speech output abstraction; Web Speech is the zero-cost baseline |
| Realtime voice | existing Gemini Live integration behind the voice-session boundary |
| Calling | canonical communication session + contextual participant/request |
| Provider messaging/calling | Conversation + Economic Request + provider communication |
| Profile | canonical identity/Memory Profile + participant capabilities |
| Contacts | canonical identity/contact capability |
| Safety contact | Contact relationship + canonical Safety boundary |
| Follow/subscribe | future relationship primitive + existing notification/context systems |
| Agent conversation | Conversation + Agent |
| Proactive brief | Requests/Tasks/Notifications/Memory + deterministic brief generation + Agent presentation |
| Agent work | existing Agent Runtime + canonical services/tools |
| Provider execution | Economic Request + execution connector + evidence |
| External agent coordination | canonical execution/participant boundary; never a second request lifecycle |
| Autonomous vehicle/robot/drone future | capability/connector participant using the same authorised execution/evidence model |

A new subsystem is justified only when the existing canonical boundary genuinely cannot express the requirement.

## 3. One user-facing Kurukoo Agent

The long-term user experience should converge on a recognisable **Kurukoo Agent** rather than making the user learn a collection of separate assistants.

The Agent is the user-facing intelligence/presentation layer. It may converse by text, listen to speech, speak responses, present a lightweight visual voice state, explain completed/pending/blocked/approval-required work, invoke canonical capabilities, coordinate people/providers/contributors/agents, remember permitted context, continue work asynchronously, and ask for approval at authority, safety or payment boundaries.

The Agent **must not own canonical truth**. Canonical services remain responsible for authorization, state mutation, idempotency, evidence and lifecycle truth.

## 4. Voice without an avatar dependency

Kurukoo does not require a persistent animated human/avatar. The preferred presentation is a lightweight **voice presence** such as a small orb, waveform, ring or equivalent semantic indicator.

Suggested states:

`idle → listening → thinking → speaking → working → waiting → needs-attention`

Voice presence is an enhancement, not a replacement for direct UI access.

## 5. Three voice modes

### Mode A — Push-to-talk / voice input

The current browser microphone path remains the low-cost baseline. Speech is converted to text and enters the same canonical Chat/Agent pipeline.

### Mode B — Conversational voice

A user can explicitly enter realtime voice conversation. The existing Gemini Live implementation may provide this experience behind a provider-neutral voice-session boundary.

### Mode C — Proactive voice

With explicit opt-in, Kurukoo may speak when a meaningful update warrants attention. Proactive voice must respect user preferences, quiet hours, attention policy, privacy, device context where available, and notification fallbacks. It must never behave as an always-listening microphone by default.

## 6. Cost architecture for voice

```text
Simple spoken update
  → response text
  → Web Speech / device speech synthesis
  → approximately zero Kurukoo inference cost

Enhanced branded voice
  → response text
  → hosted TTS adapter when justified

Natural realtime conversation
  → existing Gemini Live / future realtime voice adapter
```

Gemini Live must not be treated as permanently free or permanently required. Speech-to-text and text-to-speech remain separate concerns.

## 7. Small voice-provider boundary

Do not create a second voice architecture. The conceptual boundary is:

`SpeechInput` · `SpeechOutput` · `VoiceSession` · `AgentPresence`

Implementations may include browser/device speech recognition/synthesis, Gemini Live, and future hosted/local STT/TTS/realtime providers. UI and Agent code must not contain provider-specific business logic beyond the adapter boundary.

## 8. Proactive Agent / JARVIS-like brief

Kurukoo may eventually provide concise briefs covering completed work, pending work, requests needing input, upcoming tasks/reminders, provider updates, important notifications and agent work.

The expensive AI model should not continuously monitor the system. Existing deterministic services should assemble a structured brief first:

`Requests / Tasks / Notifications / Memory / Provider updates → deterministic brief → attention policy → Kurukoo Agent → text and/or voice`

## 9. Attention policy

Proactive events should initially be classified deterministically:

- **Immediate voice** — important/time-sensitive and user opted in.
- **Quiet notification** — useful but not worth interruption.
- **Next brief** — useful context that can wait.
- **Silent** — no user-facing interruption required.

AI may assist with wording/prioritisation, but canonical state and user preferences remain authoritative.

## 10. Contextual universal composer

The existing Chat composer should be treated as a reusable **communication/action primitive**, not a component belonging only to `/chat`.

It may adapt contextually to `Message Kurukoo…`, `Message someone…`, `Message provider…`, `Reply…`, `Add information…`, or `Tell Agent what to do…`. Attachments, voice, call, submit/send and contextual actions should be enabled according to participant/request/context rather than by creating separate messaging systems.

## 11. Communication model

Calling and messaging are contextual communication capabilities. A call affordance should appear where a legitimate communication target exists: person profile, participant conversation header, provider/request communication surface, or active fulfilment/request where calling is authorised.

Provider communication belongs to the canonical Economic Request/communication context:

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

Kurukoo should support one identity with multiple roles/capabilities. A person can be a friend/contact, safety contact, contributor, provider or request participant without becoming multiple user records.

Contact synchronisation, where implemented, should support discovery, invitations and relationship management without creating a second identity database.

### Implemented canonical boundary

The canonical identity owner is `memory_profiles.phone`. The `identityContactService` composes that identity with roles, provider/contributor/agent attributes, presence, the existing Safety relationship, and communication capabilities. `person_contacts` is the owner-scoped contact relationship boundary; it is not a second user or profile table. Imported contacts remain unavailable until they resolve to an existing Memory Profile identity and are explicitly added by the owner.

Profiles are relationship-filtered: existence in `memory_profiles` alone does not make a person discoverable. Phone numbers are not exposed as a public discovery mechanism, and removed or blocked relationships cannot message or call. The deterministic placeholder avatar is derived from the canonical identity and display name and is safe to reuse across profile, contacts, chat, and provider surfaces.

Message and call actions must route into the existing Conversation/provider communication boundaries. The call affordance is truthful: it is available only when the relationship is authorized and `KURUKOO_WEBRTC_ENABLED=true`; otherwise the profile reports that realtime call transport is unavailable. Safety contacts remain owned by the existing Safety service and are represented only as a contact plus an active safety relationship. Memory Profile remains the owner of explainable relationship context; no social or contact-memory database is introduced.

### Follow / subscribe — future capability

A relationship primitive may eventually support following/subscribing to people, contributors, providers, Topics, Opportunities or other eligible public/shared objects. Follow must not create a social-media subsystem; its effects should flow through existing Discover, Topics, Opportunities, Notifications and Memory/context surfaces.

## 13. Memory as an OS advantage

Memory must be used as a quiet capability across the OS rather than primarily as a standalone page. Examples include previous providers, communication preferences, permitted routines/locations, recurring tasks, relationship/context continuity, previous request context, user preferences and long-running agent goals.

The canonical Memory Profile remains the authority. Never create separate social, agent, voice or profile memory systems.

## 14. Agent-to-agent coordination

This is a future strategic capability, not a claim that arbitrary external agents can currently transact with Kurukoo.

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

Kurukoo should eventually coordinate multi-step goals such as selling an item, arranging repair, arranging sale and coordinating collection/delivery while presenting one coherent goal/conversation.

Every external participant must have explicit capability/authorization boundaries, idempotency, evidence and fail-closed behaviour. Agent-to-agent communication must never bypass Economic Request, safety, payment, privacy or execution authority.

## 15. Autonomous systems / physical network

Future drones, robot taxis, autonomous delivery systems, vehicles and devices should be execution participants/capabilities rather than new product silos where appropriate.

The architectural test is: can the participant advertise a capability, receive an authorised request, report progress and provide evidence through a controlled connector?

This does not make autonomous execution live today. External contracts, authentication, safety, regulatory controls, hardware interfaces and evidence are required before Kurukoo claims or performs such actions.

## 16. AI model strategy

Kurukoo should use a model hierarchy:

```text
Simple/deterministic → rules / FastText / existing services
Local/low-cost semantic → Kurukoo-specialised SmolLM2 or approved local model
Hosted text reasoning → configured cost-effective provider/model
Realtime natural voice → configured Live/voice model
Speech output → Web Speech first; hosted TTS when justified
```

The Brain/coordinator arbitrates context. Models propose meaning or wording; canonical services own truth and mutation.

## 17. Implementation stages

### Can be implemented/composed when current foundations support it

- reusable contextual Chat composer;
- contextual message/call affordances;
- lightweight voice-state UI;
- Web Speech TTS;
- Agent presence states;
- structured Agent brief from Requests/Tasks/Notifications/Memory;
- proactive-voice preference and attention-policy foundations;
- profile/contact/safety-contact composition;
- stronger Memory usage in contextual responses;
- provider-neutral voice contracts.

### Near-term after Chat/voice stability

- robust conversational voice mode;
- opt-in proactive brief delivery;
- hosted TTS where a consistent Kurukoo voice is justified;
- richer provider communication;
- relationship/follow primitives if validated by usage;
- Agent tool coverage over canonical services;
- long-running goal continuity.

### Future

- agent-to-agent connectors;
- external business agents;
- autonomous delivery/robot/vehicle participants;
- richer voice interruption handling;
- physical/autonomous network orchestration;
- advanced economic coordination and multi-party settlement.

## 18. Cost and complexity laws

1. Prefer user-device capabilities when sufficient.
2. Prefer deterministic services before invoking an LLM.
3. Prefer one existing canonical service over a new feature-specific service.
4. Prefer asynchronous work over always-on realtime sessions.
5. Never keep realtime voice connected simply because the user is logged in.
6. Never make an expensive model the only path for a simple brief.
7. Do not add infrastructure before scale/operational requirements justify it.
8. Do not create duplicate identity, conversation, memory, notification, provider communication, economic or agent lifecycles.
9. Preserve the distinct Web and Mobile visual systems with shared semantic OS concepts.
10. Never represent future/unavailable functionality as live.

## 19. Visual-system implications

The OS visual system should support consistent vocabulary for identity/avatars, voice state, message/call/video actions, participant roles, request/context state, agent activity, pending/completed/blocked/awaiting-user states, notifications/proactive briefs and contextual sheets/drawers/inspectors.

These are semantic design primitives. They should be shared across appropriate visual families without collapsing Web and Mobile compositions into one screen system.

## 20. Foundation rule for implementation agents

Before implementing any capability described here:

1. inspect current `main` and the active implementation branch;
2. identify existing canonical services/routes/components;
3. compose from them where possible;
4. make the smallest necessary change;
5. do not start an isolated feature phase;
6. do not create parallel authorities;
7. keep future capabilities as contracts/foundations rather than fake integrations;
8. run existing relevant tests/builds;
9. document the canonical owner and integration boundary;
10. keep the user-facing experience simpler even when the backend becomes more capable.

## 21. Locked product test

> **Can Kurukoo make the capability available to the user without making the user learn another system?**

If yes through existing primitives, compose it. If a new subsystem is required, first prove the canonical boundaries cannot express it.
