# Hugging Face Architecture Boundary

**Status:** Repository-side cleanup complete; external activation remains independently gated.

The complete machine-readable classification and Student V1 dependency graph are published in [`hugging-face-dependency-inventory.json`](./hugging-face-dependency-inventory.json).

Kurukoo uses Hugging Face in several **separate roles**. A Hugging Face token must never be treated as proof that any one of these roles is available, and a failure in one role must not remove or enable another role.

| Role | Kurukoo boundary | Repository state | Activation truth |
|---|---|---|---|
| Raw SmolLM2 serverless runtime inference | Former `@huggingface/inference` branch in `smolLm2Service` | **Deprecated and removed** | The tested raw SmolLM2 serverless route was unavailable. Credentials cannot reactivate it or satisfy the required-model readiness gate. |
| Local model/artifact acquisition and inference | `@huggingface/transformers` local CPU pipeline | **Retained** | A configured model artifact may be loaded locally only when `KURUKOO_SMOLLM2_LOCAL=true`; successful local generation is attributed as local, otherwise deterministic fallback is used. |
| Student artifact hosting | Private model repository and immutable retrieval receipt | **Retained, gated** | A real candidate artifact may be stored only after accepted corpus, training, immutable revision, evaluation and registry review. No Student artifact is currently claimed. |
| Remote GPU training | `ml/huggingface_jobs_backend.py` and `huggingface_hub` Jobs adapter | **Retained, fail-closed** | Requires `FF_HUGGINGFACE_JOBS=true`, scoped token, private artifact repository, explicit cost cap and launch approval, managed-job evidence, retrieval, benchmark and promotion review. |
| Teacher inference | Optional OpenAI-compatible teacher-provider pool entry | **Retained, optional** | Requires a supported provider/model, credentials, controlled verification and candidate-to-review-to-curation handling. Teacher output cannot directly mutate canonical state or enter the accepted corpus. |
| Testing/development dependency | Jobs backend regression and local model contracts | **Retained selectively** | Tests prove boundaries without proving provider availability, billable job completion or a trained model. |

## Runtime routing rule

> The canonical runtime order is **local SmolLM2 when explicitly enabled and actually loaded**, then the existing configured Gemini/Mistral/Groq/OpenRouter router when that separate route is selected and verified, then deterministic Kurukoo fallback. The raw Hugging Face SmolLM2 serverless route is not a runtime candidate.

This keeps provider attribution truthful. The SmolLM2 status exposes `serverlessRuntime: "deprecated"`; it does not expose a Hugging Face key as hosted runtime readiness. When `KURUKOO_CLOUD_RUN_REQUIRE_MODEL=true`, `/readyz` requires the explicitly enabled local model boundary rather than a retired serverless credential.

## Training and artifacts

Hugging Face Jobs are independent managed compute: the provider documents selectable CPU/GPU/TPU hardware, commands, secrets, volumes, monitoring, cancellation and retrieval.[1] The Jobs backend is therefore retained as an optional answer to the local CUDA blocker, not a parallel training algorithm or a production conversational runtime. Its artifact path preserves the existing student registry gate: a candidate is not trained, promoted, canaried or active until a real artifact beats the base SmolLM2 behavioural benchmark and is reviewed.

Hugging Face Inference Providers are also a provider-backed model catalogue where a model must have an eligible available provider; automatic selection does not make an unsupported raw model route viable.[2] Kurukoo may retain Hugging Face as an optional teacher provider only where an independently supported model, terms, price and quality have been verified. It does not restore the retired raw SmolLM2 serverless path.

## Verification

The mandatory regression `npm run test:smollm2-serverless-deprecation` proves that the raw inference SDK and retry path are absent, local Transformers.js remains present, required model health does not accept retired credentials, Hugging Face Jobs retain their cost/approval gates, and optional teacher routing remains separate. `npm run test:huggingface-jobs-backend` continues to prove the remote training lifecycle without launching a real job.

## References

[1] [Hugging Face Hub — Run and manage Jobs](https://huggingface.co/docs/huggingface_hub/en/guides/jobs)

[2] [Hugging Face — Inference Providers](https://huggingface.co/docs/inference-providers/en/index)
