# Kurukoo Blueprint — AI Brain / Student Model Addendum

**Status:** Canonical implementation extension to `BLUEPRINT.md` and `BLUEPRINT_IMPLEMENTATION_ADDENDUM.md`.

## Decision

Kurukoo's AI architecture is a Brain-centred system containing deterministic policy/state logic plus a Kurukoo-specialised student model. The initial student is SmolLM2-1.7B-Instruct, specialised offline using Kurukoo-derived scenarios and curated teacher-assisted data.

## Non-negotiable boundaries

1. The Brain owns context arbitration and next-step selection.
2. The model proposes meaning; it does not own canonical truth.
3. Canonical services own mutations, authorization, evidence and idempotency.
4. Teacher models are offline learning/evaluation authorities only; they cannot execute production capabilities.
5. Training is separate from production runtime.
6. Synthetic data is validated before training.
7. Dataset/model versions are immutable and promotable only after evaluation.
8. External integrations remain truthful and fail closed when unavailable.
9. Voice providers are adapters, not new AI authorities.
10. Speech output must be separable from reasoning so simple spoken updates can use zero/near-zero-cost device capabilities.

## Canonical pipelines

### Production

`Channel → Conversation → Brain → deterministic state + Kurukoo-SmolLM2 → arbitration → canonical capability → canonical object → execution → evidence → notification → continuation`

### Learning

`Kurukoo ontology/repository → scenario universe → generated examples → validation/redaction → teacher critique/generation → curation/deduplication/balancing → dataset version → LoRA/QLoRA → evaluation → quantization/export → model registry → shadow/canary → production`

### Voice

`SpeechInput → Conversation/Brain → canonical capability/tool → response text → SpeechOutput`

Realtime voice may use the existing Gemini Live integration through a provider-neutral `VoiceSession` boundary. Simple response playback should prefer browser/device speech synthesis where adequate, with hosted TTS as a future configurable adapter.

## Initial student-model objective

Build a deployment-ready Kurukoo-SmolLM2 before relying on live-user learning. The scenario generator should explore a space exceeding 100 million combinations where useful; the actual training corpus must be quality-selected rather than mechanically materialising all combinations.

## Required knowledge

The student must specialise in Kurukoo concepts, context arbitration, topic switching/resumption, natural clarification, memory semantics, native assistance, Economic Requests, provider/network/Radar/Pulse, products/cart, agents, notifications, Topics, Points/subscriptions, truthfulness, safety and external-boundary semantics.

The Agent must also understand the distinction between:

- text conversation;
- voice input;
- voice output;
- realtime voice sessions;
- proactive briefs;
- attention/notification policy;
- canonical tool execution;
- future agent-to-agent coordination.

These capabilities must compose with the same Brain, Conversation, Memory Profile and canonical services rather than create separate AI systems.

## Runtime model

The existing `src/services/smolLm2Service.ts`, `src/services/unifiedAiEngine.ts`, `src/services/internalCoordinator.ts`, `src/services/coordinatorStore.ts`, `src/services/agentRuntime.ts`, `src/services/aiAgentService.ts` and coordinator learning components remain the canonical runtime/learning boundaries. The new `ml/` workspace supplies versioned model artifacts; it must not create a competing production AI stack.

Voice runtime should likewise reuse the existing Web Voice/Gemini Live implementation and expose provider-specific speech capabilities only through a small adapter boundary. Do not add a second realtime conversation system.

## Cost-aware model hierarchy

Kurukoo should not invoke a large/realtime model for every interaction.

```text
Deterministic state/routing
  → rules / FastText / canonical services

Low-cost semantic work
  → Kurukoo-SmolLM2 or approved local/low-cost model

Hosted reasoning
  → configured cost-effective model where justified

Realtime natural conversation
  → configured Live/voice model

Speech output
  → Web Speech/device synthesis first where adequate
  → hosted TTS only when a consistent/richer voice is justified
```

The user should not need to know which provider is being used. The product exposes a Kurukoo Agent and voice experience; provider selection remains an implementation/configuration concern.

## Proactive Agent / brief foundation

The long-term Kurukoo Agent may proactively brief a logged-in user about completed, pending, upcoming or attention-required work. This must not require a permanently open realtime model session.

The preferred architecture is:

`existing Requests/Tasks/Notifications/Memory → deterministic brief → attention policy → Agent wording → text and/or speech`

The attention policy should distinguish immediate voice, quiet notification, next brief and silent events. User preferences and quiet hours are authoritative.

## Agent-to-agent foundation

Kurukoo's Agent may eventually coordinate external agents, business agents, contributors, providers and autonomous systems. This is a future capability, not a claim of arbitrary live interoperability.

Any future agent-to-agent path must terminate in canonical Kurukoo services and explicit authorization/evidence boundaries. External agents cannot become alternative owners of identity, memory, conversation, economic lifecycle, safety or canonical truth.

## Completion

This addendum is complete when the student model is trained, evaluated, packaged, registered, loaded through the canonical runtime, used by the Brain for semantic work, and protected by deterministic canonical-service boundaries, with reproducible training and rollback.

Voice-specific completion is separate: simple speech output should work without a paid inference dependency where the device supports it; realtime voice remains an optional capability with a provider-neutral session boundary; proactive voice requires explicit user controls and attention policy.
