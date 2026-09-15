# Local Candidate Model Benchmark — Kurukoo (2026-09-14)

Status: **COMPARISON EVIDENCE ONLY.** No production model policy was changed. `src/services/localModelPolicy.ts` is untouched. Canonical services own execution; candidates were probed statelessly against a local Ollama runtime.

## Method

- Harness: `scripts/benchmark-local-candidates.ts` (this commit). It mirrors the canonical `scripts/qualify-local-models.ts` rubric checks verbatim over the 12 most discriminating cases (multi-tool strict JSON, hallucination guard, no-evidence/no-outcome boundary, replanning, conversation/context, multilingual, diagnostic) plus a strict subset of the rest.
- Prompt format: Ollama `/api/chat` with each model's native chat template; temperature 0; bounded timeouts; fail-closed. Qwen3 ran with `/no_think` appended to the system instruction (hybrid-thinking off) so latency and JSON conformance are comparable.
- Machine: dual-core Intel i5-5257U @2.7GHz, 8GB RAM, CPU-only inference. Absolute latencies therefore represent a low-end floor, not target hardware.
- Full per-case results: `docs/verification/local-model-candidate-benchmark.json` (written by the harness).

## Candidates and licences

| Model | Params | Licence | Commercial use |
|---|---|---|---|
| `qwen3:4b` | 4B | Apache-2.0 | Yes, unrestricted |
| `llama3.2:3b` | 3B | Llama 3.2 Community License | Yes, with conditions (attribution, acceptable-use policy; <700M MAU carve-out) |
| `gemma3:4b` | 4B | Gemma Terms of Use | Yes, subject to Google's use restrictions/prohibited-use policy |
| `phi3.5` (reference) | 3.8B | MIT | Yes, unrestricted |
| `qwen2.5-0.5b` (baseline) | 0.5B | Apache-2.0 / Qwen licence | Yes |
| `smollm2:360m` (baseline) | 360M | Apache-2.0 (HF) | Yes |

## Results (12-case subset, temperature 0, native chat templates)

| Model | Score | Substance notes | ms/token (CPU-only, this machine) |
|---|---|---|---|
| **gemma3:4b** | **10/12** | 11/12 substantive: passed **all 6 structured-JSON probes** (single, args, multi-tool, compound, replan, hallucination guard); boundary-probe "fail" is a rubric false-positive (it said "I cannot confirm... there is no evidence" — the desired behaviour — but used the word "completed" in negation). Only true miss: replied "Okay." to "Hello?" | ~1.3–1.5s |
| **llama3.2:3b** | **6/12** | Conversation, context, multilingual, diagnostic, replan all PASS. Weak strict-JSON adherence: wraps answers in prose/markdown instead of raw JSON (all 4 JSON fails were format, not reasoning). Boundary probe: truthful refusal but phrasing missed the required pattern | ~1.0–1.4s |
| qwen3:4b | 4/12 (runtime artifact) | `think:false` not honored by the local Ollama build: thinking text leaked into `content` and exhausted token budgets (~1.4s/tok). Not a fair capability score; requires a newer Ollama runtime or template-level `/no_think` to evaluate properly | ~1.4s/tok while thinking |
| qwen2.5-0.5b (baseline) | 3/12 | Under `/api/chat` (vs canonical raw-ChatML path) strict-JSON conformance collapses; confirms the measured small-tier limits | ~0.24s |
| smollm2:360m (baseline) | 5/12 | Same pattern: good conversation reflexes, unreliable structured output and evidence boundaries | ~0.34s |

## Findings

1. **gemma3:4b is the strongest local 3B–4B candidate found.** It is the only candidate that produced valid strict-JSON tool calls, multi-tool arrays, replan JSON and a clean hallucination refusal (`{"tool":"none","args":{}}`) — exactly the axes where the current local tier (Qwen2.5-0.5B / SmolLM2 360M) fails. 128K context, 140+ languages, multimodal. Licence permits commercial use under Gemma Terms of Use (requires compliance with Google's use restrictions).
2. **llama3.2:3b is strong on conversation, context and multilingual but cannot be trusted for raw strict-JSON emission** without a grammar/JSON-mode constraint. Llama 3.2 Community License allows commercial use with conditions (attribution, acceptable-use policy).
3. **qwen3:4b could not be fairly evaluated here** (runtime thinking-mode artifact). Apache-2.0 and strong published tool-calling make it worth re-probing on an Ollama build that honors `think:false`, or via llama.cpp/vLLM with `enable_thinking=false`.
4. **The no-evidence/no-outcome boundary discipline is rubric-fragile for every model** (including gemma3 substantively passing and being marked failed; llama3.2 truthful-but-unmatched phrasing). The boundary guarantee should continue to live in Kurukoo's canonical services/policy arbitration, not be delegated to any model's phrasing.
5. **Local 3–4B tier is ~4–6× slower per token than the current 0.5B tier on this CPU** (~1.3s vs ~0.24s/token CPU-only). This machine is a floor, not target hardware; on Apple-silicon/modern CPUs the gap narrows but the 0.5B tier remains the latency king for `localFast` conversation.

## Hosted / specialist (not locally testable here)

- **Hosted reasoning:** keep as today — complexReasoning stays `hosted` (`LOCAL_MODEL_POLICY.hostedRequiredTasks`: planning, agent_execution, high_stakes). No local 3–8B candidate substitutes for hosted frontier reasoning on economic/safety-critical steps, and the harness confirms local JSON/boundary fragility.
- **Specialist slots** (embeddings, speech, vision, translation) remain provider-neutral readiness slots per `docs/KURUKOO_PRODUCTION_AND_LEARNING_PIPELINES.md`; not probed in this benchmark.

## Recommended roles (pending approval — NOT applied)

| Role | Recommendation |
|---|---|
| Local fast (conversation) | Keep **Qwen2.5-0.5B** (fastest by ~5×); optionally A/B **gemma3:1b-it-qat** later |
| Local reasoning/tool (structured) | **gemma3:4b** (10/12, only candidate with reliable strict JSON); **llama3.2:3b** as fallback if JSON-mode/grammar constrained |
| Local reasoning/tool (Apache-2.0-only requirement) | Re-probe **qwen3:4b** on a runtime that disables thinking |
| Hosted reasoning | Unchanged — hosted frontier (per `aiInferencePolicy`), no local substitute |
| Specialist | Unchanged — conditional readiness slots |

## Context: existing measured limits (docs/verification/local-model-qualification.json)

- Qwen2.5-0.5B: 6/15 canonical PASS, ~234ms/tok. SmolLM2 360M: 9/15, ~340ms/tok.
- Both failed the no-evidence/no-outcome boundary probe in the same direction (affirming completion without evidence).
- Multi-tool / compound strict JSON unreliable at the small local tier.

## Decision inputs

- Hosted reasoning remains required for planning/agent_execution/high_stakes (`LOCAL_MODEL_POLICY.hostedRequiredTasks`) regardless of local tier choice; no local candidate replaces hosted frontier reasoning for economic or safety-critical steps.
- Specialist models are handled as provider-neutral readiness slots (see `docs/KURUKOO_PRODUCTION_AND_LEARNING_PIPELINES.md`): never claimed available unless independently configured and probed.
