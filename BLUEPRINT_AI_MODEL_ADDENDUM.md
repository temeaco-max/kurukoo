# Kurukoo Blueprint — AI Brain / Student Model Addendum

**Status:** Canonical implementation extension to `BLUEPRINT.md` and `BLUEPRINT_IMPLEMENTATION_ADDENDUM.md`.

## Decision

Kurukoo's AI architecture is a Brain-centred system containing deterministic policy/state logic plus a Kurukoo-specialised student model. The initial student is SmolLM2-360M-Instruct, served through Ollama and specialised offline using Kurukoo-derived scenarios and curated teacher-assisted data.

## Non-negotiable boundaries

1. The Brain owns context arbitration and next-step selection.
2. The model proposes meaning; it does not own canonical truth.
3. Canonical services own mutations, authorization, evidence and idempotency.
4. Teacher models are offline learning/evaluation authorities only; they cannot execute production capabilities.
5. Training is separate from production runtime.
6. Synthetic data is validated before training.
7. Dataset/model versions are immutable and promotable only after evaluation.
8. External integrations remain truthful and fail closed when unavailable.

## Canonical pipelines

### Production

`Channel → Conversation → Brain → deterministic state + Kurukoo-SmolLM2 → arbitration → canonical capability → canonical object → execution → evidence → notification → continuation`

### Learning

`Kurukoo ontology/repository → scenario universe → generated examples → validation/redaction → teacher critique/generation → curation/deduplication/balancing → dataset version → LoRA/QLoRA → evaluation → quantization/export → model registry → shadow/canary → production`

## Initial student-model objective

Build a deployment-ready Kurukoo-SmolLM2 before relying on live-user learning. The scenario generator should explore a space exceeding 100 million combinations where useful; the actual training corpus must be quality-selected rather than mechanically materialising all combinations.

## Required knowledge

The student must specialise in Kurukoo concepts, context arbitration, topic switching/resumption, natural clarification, memory semantics, native assistance, Economic Requests, provider/network/Radar/Pulse, products/cart, agents, notifications, Topics, Points/subscriptions, truthfulness, safety and external-boundary semantics.

## Runtime model

The existing `src/services/smolLm2Service.ts`, `src/services/unifiedAiEngine.ts`, `src/services/internalCoordinator.ts`, `src/services/coordinatorStore.ts`, `src/services/agentRuntime.ts`, `src/services/aiAgentService.ts` and coordinator learning components remain the canonical runtime/learning boundaries. The new `ml/` workspace supplies versioned model artifacts; it must not create a competing production AI stack.

## Completion

This addendum is complete when the student model is trained, evaluated, packaged, registered, loaded through the canonical runtime, used by the Brain for semantic work, and protected by deterministic canonical-service boundaries, with reproducible training and rollback.
