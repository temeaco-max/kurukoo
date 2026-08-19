# Kurukoo Behaviour Pack + OS-driven Scenario Compiler

## Purpose

The Behaviour Pack is the versioned, machine-readable teaching contract for Kurukoo's native intelligence. It is compiled from the current operating system rather than maintained as a second, hand-written ontology.

## Sources of truth

The compiler reads the canonical runtime registries and contracts:

- `src/services/skillFlows.ts` — skills, Skill Flow mode, requirements and economic capabilities.
- `src/services/universalCapabilityProtocol.ts` — canonical capability descriptors, actions, risk, evidence and activation state.
- `src/services/agentToolRegistry.ts` — the real agent tool surface and authorization/risk semantics.
- `src/services/contextArbitration.ts` and `src/services/canonicalChatTurnService.ts` — conversational ownership and context boundaries.
- `src/services/agentRuntime.ts` — goal, autonomy and recovery semantics.
- `src/services/memoryProfile.ts` / Living Memory — bounded identity and continuity rules.
- Nearby Pulse and Capability Portfolio — skill-specific presence and multi-capability identity.

The pack is therefore a **projection of Kurukoo's current OS**, not an alternate source of truth.

## Behaviour Pack contents

A compiled pack contains:

- Kurukoo constitution/invariants.
- Behaviour families such as clarification, interruption, correction, relative references, multi-goal continuity, agent continuation, truth/evidence, capability portfolio, cross-channel continuation, recovery, safety/injection and locale behaviour.
- Every known Skill and its Skill Flow requirements/capabilities.
- Every registered Universal Capability with actions, risk, owners, evidence and activation state.
- Every canonical Agent Tool and its authorization/risk surface.
- Truth and safety boundaries.
- Coverage and reproducibility metadata.

`ml/behaviour/latest.json` is a generated artifact. Never hand-edit it.

## Scenario compiler

`scripts/compile-kurukoo-scenarios.ts` consumes the latest Behaviour Pack and deterministically produces synthetic training/evaluation scenarios across:

- every skill;
- every behavioural family;
- fresh/active/waiting/failed state variants;
- multiple channels;
- multiple locales;
- multiple actor types;
- truth/evidence and safety constraints;
- exact provenance and Behaviour Pack hash.

The default scenario limit is 24,000. Set `KURUKOO_SCENARIO_LIMIT` to change it for controlled runs.

Generated datasets live under `ml/datasets/` and are reproducible from the pack hash; large generated JSONL files are not committed to GitHub by design.

## Canonical learning flow

```text
Kurukoo OS registries
        ↓
Behaviour Pack compiler
        ↓
Behaviour Pack + hash
        ↓
OS-driven scenario compiler
        ↓
synthetic/provenance-marked scenarios
        ↓
teacher generation/evaluation
        ↓
curation
        ↓
accepted Kurukoo corpus
        ↓
QLoRA/LoRA
        ↓
independent evaluation
        ↓
model registry / shadow / canary
```

## Trust boundaries

The Behaviour Pack teaches the model how Kurukoo should behave; it does **not** grant the model authority.

The student remains proposal-only. Canonical services/executor remain authoritative for mutations, payments, evidence, external execution, identity and safety.

Generated scenarios are synthetic and must not contain production user data. Teacher output is never trusted automatically and carries provenance/review state before entering the accepted training corpus.

## Operational commands

```bash
npx tsx scripts/compile-kurukoo-behaviour-pack.ts
npx tsx scripts/test-kurukoo-behaviour-pack.ts
npx tsx scripts/compile-kurukoo-scenarios.ts
npx tsx scripts/test-kurukoo-scenario-compiler.ts
python3 ml/run_learning_cycle.py
```

The learning cycle runs Behaviour Pack compilation and validation before teacher generation so the training pipeline follows the current OS rather than a stale manually maintained catalogue.
