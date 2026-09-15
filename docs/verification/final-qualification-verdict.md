# Final Local Reasoning/Tool Tier Qualification — Gemma 3 4B vs Qwen3 4B (2026-09-14)

**Verdict: Gemma 3 4B is NOT yet qualified as Kurukoo's local reasoning/tool tier on the current runtime, and Qwen3 4B cannot replace it on this runtime either. The blocker is the canonical local inference path (`smolLm2Service` raw ChatML prompt format), not model capability.** No production policy changed. Qwen2.5-0.5B remains the fast tier; canonical services remain the execution authority.

## 1. Runtime-path integration blocker (verified)

The canonical local path is `modelRouter.complete` → `unifiedAiEngine` → `smolLm2Service.querySmolLM2` → Ollama `/api/generate` with **`raw:true` and hard-coded ChatML markers** (`buildPrompt` in `src/services/smolLm2Service.ts`).

Measured on the same Ollama 0.20.0 server, same prompt, same options:

| Path | Result |
|---|---|
| `/api/chat` (Gemma's native template) | **5 tokens in 10.9s** (1.0s/tok, 7.2s load) — works |
| `/api/generate raw:true` ChatML (canonical path) | **>420–900s without completing 96 tokens** — pathological |

The raw ChatML prompt on Gemma 3 degrades generation pathologically on this Ollama build. Three full Intelligence Runtime qualification attempts and bare `curl` replicas confirm it: every `querySmolLM2` call to Gemma either aborted at timeout or failed, and the bounded deterministic template fallback caught the failure every time (`executionMode: deterministic_fallback`). The runtime itself behaved correctly and fail-closed — attribution, graceful degradation and escalation semantics all passed (6/8, see below) — but **Gemma produced zero actual model answers through the runtime**, so capability claims from the offline benchmark cannot be transferred to the runtime path.

Runtime qualification evidence: `docs/verification/gemma-runtime-qualification.json` (T0 selection ✓, T1 fast-path ✓, T2 catalogue skill ✓, T3 compound-plan ✗, T4 replan ✓, T5 no-evidence ✓, T6 authorization ✓, T7 escalation ✓, T8 attribution ✗ — both ✗ caused by the raw-path failure, not model output).

## 2. Qwen3 4B re-test with thinking honored (fair mode)

Ollama 0.20.0 does not honour `think:false` (thinking leaks into `content` and exhausts budgets — confirmed by direct probes). Fair re-test therefore ran the native thinking path with a 640-token budget and post-`</think>` answer extraction over the 6 discriminating cases.

**Result: 0/6.** Every request died with a connection reset ("fetch failed") roughly five minutes into generation — the Ollama 0.20.0 runner on this host does not survive sustained Qwen3 thinking generations (observed repeatedly across two probe campaigns and direct probes; runner RSS collapsed to ~0.6GB with 13+ min CPU). Combined with the confirmed `think:false` non-honoring, **Qwen3 4B cannot serve as the local reasoning tier on this runtime**: both its accuracy evaluation and its stability fail. Latency analysis independent of stability: thinking costs ~1.4s/token on this CPU and thinking alone runs 300–1000 tokens, i.e. ~7–25 minutes per planning call — categorically unsuitable for an interactive local tier on low-end CPU hosts regardless of accuracy.

Recommendation: re-probe Qwen3 (Apache-2.0, strong published tool-calling) only on GPU hardware or a fixed/updated runtime, behind the same modelRouter boundary. Do not adopt it on CPU-only hosts.

## 3. Verdict

1. **Is Gemma genuinely qualified as the local reasoning/tool tier?** Not on the current runtime. Offline (native template) it is the strongest candidate ever measured (10/12; only candidate with reliable strict JSON), but the canonical runtime path cannot use it correctly. **Qualification is blocked by `smolLm2Service`'s hard-coded raw ChatML prompt format.**
2. **Should Qwen3 replace it?** No. On this runtime its thinking mode is both broken (`think:false` unimplemented) and prohibitively slow on CPU (~7–25 min/call). It remains worth re-probing on GPU hardware or a fixed runtime, behind the same boundary.
3. **Integration risks if pursued:**
   - Prompt-format coupling: `buildPrompt` hard-codes ChatML for every model; any non-ChatML local model (Gemma, Llama) needs a per-model template adapter in `smolLm2Service` — this is the prerequisite for any tier change.
   - Timeout sizing: `OLLAMA_TIMEOUT_MS` defaults to 30s; a 4B CPU tier needs minutes. Generation budgets (`SMOLLM2_MAX_NEW_TOKENS` cap 512) and serialised `localBusy` locking need review for 3–4B latencies.
   - Memory: 8GB hosts thrash when a 3–4B model and other models are resident; keep_alive/unload policy and concurrent-request queueing (observed request serialization causing cascading timeouts) must be handled.
   - Rubric fragility: the no-evidence/no-outcome regexes produced a false negative for Gemma's correct refusal (word "completed" in negation). Checks need semantic tightening before they gate a tier decision.

## 4. Prepared (NOT activated) minimal policy change

See `docs/verification/proposed-local-model-policy.patch` and `scripts/test-local-reasoning-tier-candidate.ts`. The prepared change adds an opt-in `localReasoningTool` role (default unset → behaviour identical to today) plus the Gemma template adapter prerequisite flag. **Activation remains blocked on the runtime-path fix above.** `localModelPolicy.ts` is untouched in this commit; Qwen2.5-0.5B stays the local fast default.
