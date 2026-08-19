# Kurukoo AI Model System — Canonical Implementation Document

**Status:** Foundational implementation contract
**Date:** 2026-08-16
**Scope:** Brain, specialised SmolLM2 student model, teacher-assisted learning, offline training, evaluation, model registry, deployment and continual improvement.

## 1. Purpose

Kurukoo is to operate as one conversational operating layer over assistance, memory, Economic Requests, providers, products, reminders, notifications, agents, Topics, Radar/Pulse and future execution channels. The AI model must therefore be specialised for Kurukoo's language, concepts, context switching, clarification behaviour and capability-selection semantics.

The production model is **not** the source of truth. The Brain arbitrates meaning and next step; canonical services own state mutation, authorization, evidence, idempotency and external execution.

## 2. Canonical architecture

```text
USER
  -> CHANNEL
  -> CONVERSATION
  -> BRAIN / CONTEXT ARBITRATION
  -> deterministic state + memory + Kurukoo-SmolLM2
  -> arbitration / confidence / provenance / policy
  -> SKILL / AGENT / NATIVE ASSISTANCE
  -> CANONICAL OBJECT
  -> EXECUTION
  -> EVIDENCE
  -> NOTIFICATION / CONTINUATION
  -> CONVERSATION
```

The learning system is separate:

```text
production conversations / canonical outcomes
  -> privacy/redaction
  -> scenario/example construction
  -> teacher critique/generation
  -> validation and curation
  -> immutable dataset version
  -> LoRA/QLoRA training
  -> offline evaluation
  -> adversarial/regression evaluation
  -> quantization/export
  -> model registry
  -> shadow/canary
  -> production
```

## 3. Model roles

### 3.1 Kurukoo-SmolLM2

SmolLM2-1.7B is the initial student model. It is specialised for:

- Kurukoo ontology and terminology;
- intent interpretation;
- context candidate generation;
- entity/requirement extraction;
- topic switching and resumption;
- natural clarification;
- capability candidate selection;
- conversational repair;
- bounded conversational response drafting;
- Kurukoo mannerisms and response style;
- recognising uncertainty and asking for clarification.

It must not independently mutate production state or invent external facts.

### 3.2 Teacher models

Teacher models such as Mistral, Gemini and other available higher-capability models may generate candidate labels, critiques, examples and difficult-case analyses. Teacher output is untrusted candidate learning material until validated. Teacher output must never directly execute production capabilities.

### 3.3 Deterministic Brain/services

Deterministic services remain authoritative for authentication, ownership, safety boundaries, permissions, canonical object state, payments, provider verification, evidence, notifications, agent permissions and irreversible actions.

## 4. Student-training strategy

Start with parameter-efficient training (LoRA/QLoRA). Keep the base model frozen during adapter training. The initial target is a Kurukoo-specific adapter; merging into a deployable standalone model is an export option, not a requirement of training.

Training data must be versioned and structured. Do not dump arbitrary synthetic conversations into training. Generate a very large scenario space, then validate, deduplicate, balance, score and select a high-quality corpus.

## 5. Training corpus domains

The initial corpus must cover, at minimum:

1. Kurukoo ontology and terminology.
2. Intent recognition.
3. Context arbitration.
4. Active-request continuity.
5. Topic interruption and resumption.
6. Ambiguous short utterances such as names, locations and times.
7. Natural clarification.
8. Conversational repair.
9. Memory retrieval/use and memory boundaries.
10. Reminders and notifications.
11. Safety/check-in boundaries.
12. Economic Request lifecycle.
13. Provider/network/Radar/Pulse interactions.
14. Product/cart/checkout interactions.
15. Agent goal lifecycle including pause/resume/cancel.
16. Topics/community interactions.
17. Points/subscription/account interactions.
18. Channel convergence.
19. External-integration unavailable states.
20. Evidence and truthfulness.
21. Authorization and confirmation boundaries.
22. Adversarial, contradictory and misleading inputs.
23. Multiturn transaction conversations.
24. Natural Kurukoo conversational style.

## 6. Scenario universe

The generator should model combinations of:

- user state;
- conversation state;
- active contexts;
- current and historical topics;
- pending questions;
- canonical objects;
- intent;
- entities;
- ambiguity;
- interruption;
- correction;
- execution state;
- provider state;
- external capability state;
- user language/style;
- temporal/location constraints;
- safety/policy boundaries.

The system may target a scenario universe exceeding 100 million possible combinations. This is a generation/search space, not a requirement to train on 100 million near-duplicates.

## 7. Quality gates

Every training example must pass appropriate gates:

- schema validation;
- provenance;
- privacy/redaction;
- canonical ontology validation;
- action/capability validity;
- truthfulness checks;
- contradiction checks;
- duplicate/near-duplicate filtering;
- policy checks;
- balance checks;
- teacher agreement where applicable;
- deterministic expected-outcome validation where available.

Examples that encode incorrect product behaviour must be rejected rather than teaching the model from them.

## 8. Context arbitration contract

For each user turn, the student may propose:

```json
{
  "intent": "...",
  "candidateContexts": [],
  "entities": {},
  "answersPendingQuestion": false,
  "topicSwitch": false,
  "resumeContext": null,
  "confidence": 0.0,
  "clarificationNeeded": false,
  "reason": "..."
}
```

The Brain validates this proposal against actual conversation state, memory policy, ownership and canonical services. Low-confidence ambiguity must preserve existing contexts and trigger concise clarification rather than forced mutation.

## 9. Mikel-class invariant

An active Economic Request must never capture an arbitrary subsequent utterance merely because it has a missing field.

Example:

```text
User: I need a plumber in Lagos.
System: What is your name?
User: Mikel.
```

`Mikel` must be recognised as possible identity information rather than automatically inserted into a request slot. The plumber request remains intact.

## 10. Training stages

### Stage A — domain adaptation
Kurukoo vocabulary, concepts and canonical terminology.

### Stage B — supervised semantic behaviour
Intent, entities, requirements and context candidates.

### Stage C — conversational arbitration
Interleaving, interruption, resumption, ambiguity and repair.

### Stage D — capability semantics
Native assistance, Economic Requests, agents, products, provider/network and notifications.

### Stage E — truthfulness and safety
Refusal to invent availability, verification, payments, evidence or external execution.

### Stage F — preference/style alignment
Natural Kurukoo tone and concise clarification behaviour.

### Stage G — regression hardening
Adversarial and production-like scenario suites.

## 11. Evaluation

A model is promotable only if it improves the current baseline across:

- context-owner accuracy;
- intent accuracy;
- entity extraction;
- clarification quality;
- topic-switch preservation;
- request continuity;
- tool/capability selection;
- truthfulness;
- safety/policy adherence;
- response quality;
- latency/resource profile.

Evaluation must include deterministic golden cases, generated cases, adversarial cases and human review samples.

## 12. Deployment

Production receives only a versioned model artifact and manifest. Training dependencies do not belong in the runtime service. The runtime must support model version selection, health/readiness reporting, fallback/escalation and rollback.

The model must never be allowed to bypass canonical services.

## 13. Continual learning

Production-derived learning must be privacy-safe and explicitly separated from raw production state. Candidate learning artifacts may expire; curated training examples, dataset versions and model versions are durable/versioned assets.

```text
teacher artifact -> curated example -> dataset version -> model version
```

No model automatically promotes itself. Promotion requires evaluation and explicit release policy.

## 14. Completion definition

This work is complete when Kurukoo has:

- a stable Brain/context-arbitration contract;
- a Kurukoo-specialised SmolLM2 model;
- reproducible local training;
- scenario generation and curation;
- teacher/evaluator integration;
- model evaluation and regression suites;
- quantized deployment artifact;
- model registry/versioning;
- production Brain integration;
- safe fallback/escalation;
- shadow/canary/rollback controls;
- documented production and learning pipelines;
- no parallel AI architecture competing with the Brain.


## 14. Empirical conversational trajectory benchmark

The repository now contains `scripts/benchmark-conversational-trajectories.ts`, which evaluates the existing core corpus and the extended scenario laboratory without creating a second runtime authority. The laboratory currently contains **24,000 deterministic synthetic trajectories across 205 skills and 46 families**, with 943,188 total turns and an average of 39.30 turns per trajectory. It covers 5-, 10-, 20-, 40-, 80- and 81-turn horizons, six actor types, ten channels, Nigerian/British/Canadian market configurations, 20 lifecycle variants, simultaneous goals, interruptions, pivots, corrections, postponement, resumption, cancellation, relative references, colloquial/noisy language, and canonical truth boundaries.

The benchmark scores naturalness screening, context retention, goal retention, interruption handling, correction handling, clarification quality, ambiguity handling, relative-reference resolution, multi-goal tracking, action-transition accuracy, canonical schema adherence, hallucination rate, unnecessary-question rate, premature-action rate, memory contamination, safety compliance, latency, token usage, inference cost, and failure recovery. Structural results remain 100% multi-turn coverage, 100% arbitration-pattern coverage, 100% canonical truth-boundary coverage, and 88.89% adversarial coverage. The structural results are contract and dataset results; they do not claim GPT-level intelligence or production task completion.

A bounded local evaluation was routed through `unifiedAiEngine` using the existing SmolLM2 selection boundary. In this environment the SmolLM2 runtime reported unavailable, so the canonical engine truthfully used `Kurukoo Template`. Three representative trajectory prefixes averaged a heuristic score of **0.67**, with failures clustered primarily under prompt/context construction: context retention, goal retention, relative-reference resolution and latency. This result is a diagnostic of the current configured boundary, not a claim that SmolLM2 itself was available or that the heuristic is a human naturalness score.

Mistral remains an optional hosted generation and Voxtral transcription provider. The benchmark can check configuration and protected connection readiness, and can optionally run an offline teacher critique only after explicit opt-in and successful verification. The teacher has no tools, no canonical identity and no mutation path. In the current local run, Mistral was **not configured and not verified**; no quota, free allowance, live voice, external delivery, payment, provider, inventory, verification or fulfilment capability is claimed. Qwen and Llama are represented as provider-neutral candidates and are not claimed available without independent configuration and probing.

The live red-team pass found and repaired a universal arbitration defect in which an exploratory informational question could be captured by an unrelated active Economic Request. Informational question signals now switch to general conversation while preserving the request context for explicit later resumption. The full `processCanonicalChatTurn` regression and the new canonical long-horizon harness cover this behavior.

## 15. Continuation repair status — August 2026

The universal context arbitrator now treats relative references conservatively. A reference such as “that one,” “the other,” or “same one” may resolve only when one safe candidate exists or the user supplies an explicit ordinal or owner-scoped object identity. When multiple active contexts remain plausible, Kurukoo asks one focused clarification and preserves every active context. Explicit Chat protocol actions continue to bypass semantic re-arbitration only when their canonical identity is valid, accessible and owned by the user.

The local SmolLM2 boundary retains the configured 1.7B student target and supports a bounded constrained-host fallback to `HuggingFaceTB/SmolLM2-360M-Instruct`. Readiness telemetry distinguishes local enablement, successful local inference, fallback provenance and the explicitly **deprecated** raw Hugging Face serverless runtime. A Hugging Face API key can no longer trigger raw SmolLM2 serverless inference or satisfy the required-model health gate. The local `@huggingface/transformers` boundary may still acquire the configured model artifact, while Hugging Face Jobs and private artifact storage remain separately gated training infrastructure. Successful fallback inference preserves the diagnostic that the primary checkpoint was unavailable. Student output is rejected when it leaks system policy, role, context, model, quota, prompt or internal contract language; the existing deterministic conversational fallback then supplies a safe clarification, recovery, correction, interruption or general-help response.

The bounded 360M trajectory probe passed through `unifiedAiEngine` with a mean measured score of **1.00** across three representative prefixes after the relative-reference leakage repair. The probe also exposed that long prompts can cause the local runtime to reject its generated text, in which case the deterministic fallback supplies the safe answer and readiness telemetry reports `local_inference_failed`; this is not counted as successful student naturalness. These scores are laboratory diagnostics, not claims of production naturalness.

Mistral, Gemini, Groq, voice delivery, notifications, payments, channels, provider availability and external quotas remain optional readiness boundaries. Raw Hugging Face serverless SmolLM2 inference is retired; Hugging Face remains optional only for explicitly configured teacher inference and for protected Jobs/artifact infrastructure. No external capability is considered live without configured credentials, provider acceptance, evidence and independent runtime proof.

Conversational onboarding now avoids unsupported delivery claims. The name step promises only a verification request and a truthful delivery-status explanation. The OTP composer asks for a code from an approved verification channel if one has been delivered. Internal OTP records are never treated as evidence that SMS, WhatsApp or another external channel delivered a code.

The deterministic trajectory corpus is regenerated locally rather than committed as a large generated artifact. Clean-checkout regressions must run the generator before asserting its manifest and records. The corpus remains synthetic and contains no production user data.
