# Kurukoo ML Workspace

This directory contains the **offline** Kurukoo model-training, scenario-generation, evaluation, export and registry tooling.

It is intentionally separate from the production TypeScript runtime. Production loads versioned model artifacts through the existing AI/model boundary; it does not train models.

## Structure

```text
ml/
├── README.md
├── pyproject.toml
├── requirements-smollm2.txt
├── train_smollm2_qlora.py
├── verify_smollm2_artifact.py
├── config/
│   ├── training.yaml
│   └── model-registry.json
├── schemas/
│   ├── scenario.schema.json
│   ├── training-example.schema.json
│   ├── evaluation-result.schema.json
│   └── model-manifest.schema.json
├── prompts/
│   ├── ontology.md
│   ├── arbitration.md
│   ├── clarification.md
│   ├── critique.md
│   └── scenario-generation.md
├── scenarios/
│   └── README.md
├── datasets/
│   └── README.md
├── teachers/
│   └── README.md
├── training/
│   └── README.md
├── evaluation/
│   └── README.md
├── export/
│   └── README.md
└── registry/
    └── README.md
```

## Rules

1. No secrets or raw production user data are committed here.
2. Dataset versions are immutable.
3. Synthetic scenarios are not automatically trusted training data.
4. Teacher output is candidate material only.
5. Model promotion requires evaluation.
6. Production state remains outside the model.
7. Training is opt-in and must never run as part of application startup.
8. A trained adapter must match the dataset SHA-256 recorded at training time.
9. Artifact verification never performs registry promotion or production activation.

## Local SmolLM2 training

Prepare the guarded training job without training:

```bash
python3 ml/train_smollm2_qlora.py
```

Install the optional environment first:

```bash
python3 -m venv .venv-smollm2
. .venv-smollm2/bin/activate
pip install -r ml/requirements-smollm2.txt
```

A real LoRA/QLoRA run requires explicit opt-in:

```bash
KURUKOO_ENABLE_TRAINING=true \
KURUKOO_SMOLLM2_BASE_MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct \
python3 ml/train_smollm2_qlora.py
```

The runtime writes a candidate artifact manifest and never promotes the resulting adapter automatically.

Useful controls include:

```text
KURUKOO_TRAIN_MAX_LENGTH
KURUKOO_TRAIN_EPOCHS
KURUKOO_TRAIN_BATCH_SIZE
KURUKOO_TRAIN_GRAD_ACCUM
KURUKOO_TRAIN_LR
KURUKOO_TRAIN_4BIT
KURUKOO_TRAIN_SEED
```

## Verify a trained candidate

```bash
python3 ml/verify_smollm2_artifact.py
```

To additionally enforce conversational evaluation thresholds:

```bash
KURUKOO_SMOLLM2_EVAL_SUMMARY=data/scenario-lab/teacher-evaluation-summary.json \
python3 ml/verify_smollm2_artifact.py
```

The verifier checks artifact presence, adapter/tokenizer files, dataset hash, candidate-only flags and optional evaluation thresholds. It returns `eligible_for_registry_review` only; the existing model registry remains the sole promotion boundary.

## Training/evaluation flow

```text
canonical Kurukoo ontology
    ↓
ml:generate-universe
    ↓
synthetic candidate dataset
    ↓
teacher evaluation / human curation
    ↓
local LoRA/QLoRA training
    ↓
artifact verification
    ↓
existing model registry review
    ↓
shadow → canary → production
```

The teacher and student are not allowed to mutate canonical Kurukoo state, invent provider/payment/evidence facts, or silently change runtime policy.

## Actual student-model proving status

The current proving workflow is explicit and fail-closed:

```text
canonical generators
    ↓
synthetic candidate corpora
    ↓
teacher generation/critique (untrusted)
    ↓
explicit review=true AND accepted=true
    ↓
ml/curate_candidate_corpus.py
    ↓
QLoRA training
    ↓
artifact verification
    ↓
head-to-head evaluation
    ↓
candidate → shadow → canary → active
```

Run curation with:

```bash
npm run ml:curate
```

The curator never assigns approval. The current canonical Corpus v2 contains 36,012 reconciled accepted rows: 28,849 train, 3,600 validation, and 3,563 test. The accepted train split is synthetic-only, preserves the candidate → review → curation boundary, excludes production user data, and has SHA-256 `b8ec82700f5817ec23702d21b2f8f869ffef393f5b7109ffd1bb83e20f05ff02`. Its Behaviour Pack hash is `e0883f4a630d57f7cf7b78415fa0a7bf017189c3adfe04cef4bbdb5267969715`.

The OS-driven portion contributes 24,000 deterministic scenarios compiled from 205 skills, 14 behaviour families, four lifecycle states, and three variants. Structural coverage and anti-leakage checks passed. This is data readiness evidence, not a model-quality, benchmark, registry, or promotion result.

A real training run requires the existing explicitly curated non-empty accepted corpus and `KURUKOO_ENABLE_TRAINING=true`. The trainer rejects uncurated rows, records the accepted dataset hash and training parameters, and never changes production runtime selection.

No Kurukoo-trained adapter has been produced, benchmark-proven, registered, shadowed, canaried, or promoted in the current run.

## Control Room curation workflow

The canonical human-in-the-loop surface is `/admin/curation.html`, backed by the protected `/api/admin/curation/*` routes. The queue imports teacher candidates into the existing SQL.js database as `pending` records and exposes trajectory content, skill/family, actor, market, locale, channel, lifecycle, scenario variant, teacher/provider metadata, candidate score, failure dimensions, provenance, and review status. Queue ordering prioritises difficult or incomplete candidates; it does not convert a score into approval.

A candidate can enter the accepted corpus only when a reviewer has explicitly recorded both `reviewed=true` and `accepted=true`. The available decisions are `accept`, `reject`, `rewrite`, and `second_review`. Rewrites create a new pending candidate with `rewrite_of`, `original_id`, an incremented version, the original provenance, rejection reason, and audit lineage; the original candidate is never silently replaced. Reviewer identity, timestamp, decision, reason, notes, candidate version, and optional dataset version are persisted in the curation audit table.

The accepted-corpus gate now fails closed for empty accepted data and for missing configurable composition coverage. The default coverage dimensions are skill, actor, market, locale, scenario type, natural conversation, adversarial cases, and long-horizon cases. Override minimums for an offline run with `--coverage '{"skill":2,"actor":1}'` or `KURUKOO_MIN_COVERAGE_JSON`. This gate prepares a corpus; it never launches training from the admin UI. Training remains an explicit offline operation and model promotion remains a separate registry decision.

The current state remains truthful: the repository-side queue and review lifecycle are ready, and Corpus v2 has passed explicit curation. Generation or scoring alone remains insufficient for any new candidate. Training execution, held-out base-versus-student evaluation, registry review, shadow, canary, and production activation remain separately guarded.


## Real teacher batch proving — 17 August 2026

A bounded real-provider batch was generated through the existing teacher adapter using the configured OpenAI-compatible endpoint and catalog model `claude-haiku-4-5` (selected only because Mistral and Gemini credential variables were absent). The adapter now honors `OPENAI_API_BASE`; it does not assume the public OpenAI endpoint when a configured compatible endpoint is present. Two candidates were generated from a deterministic stratified sample and imported into the existing Control Room queue as `pending`, `reviewed=false`, and `accepted=false`.

One candidate was explicitly marked `needs_rewrite`, producing a new linked pending version with preserved scenario identity and provenance. The other passed a first review, a second review, and an explicit acceptance with reviewer scores. This bounded historical batch is a valid curation proof, not a model-training result; it does not override the independently reconciled Corpus v2 state.

## Managed Hugging Face GPU training

`KURUKOO_TRAINING_BACKEND=local_cuda` remains the default and preserves the local CUDA guard. The only additional backend is `huggingface`, which packages the exact accepted Corpus v2, current Behaviour Pack, canonical trainer, and reproducibility metadata for a managed Hugging Face Job. It does not introduce a second training algorithm or a second model runtime.

> API teacher credentials provide teacher generation, critique, and evaluation. They do **not** provide managed GPU training compute. A separate Hugging Face Jobs-capable credential and positive provider credit balance are required for the remote path. Hugging Face Jobs are pay-as-you-go and require explicit hardware selection, timeout, and durable output persistence. [1] [2]

| Operation | Command and required conditions |
|---|---|
| Canonical preflight | `npm run ml:remote-preflight`. It verifies the accepted-split SHA-256, Behaviour Pack SHA-256, curation status, synthetic-only and production-data boundaries, and split-leakage evidence. It does not contact a provider or create a billable job. |
| Local CUDA training | `KURUKOO_ENABLE_TRAINING=true KURUKOO_TRAINING_BACKEND=local_cuda python3 ml/train_smollm2_qlora.py`. The existing guard still blocks full-corpus training without a CUDA GPU meeting the configured 16 GiB floor. |
| Remote submission | Set `HF_TOKEN` as an injected secret, `KURUKOO_HF_ARTIFACT_REPO=<private-owner/kurukoo-student-v1>`, `KURUKOO_HF_MAX_ESTIMATED_COST_USD=<strict-cap>`, `KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED=true`, and `KURUKOO_ENABLE_TRAINING=true`; then run `npm run ml:remote-launch`. The approval flag and a positive cost cap are both mandatory because this creates a billable managed GPU job. |
| Status and monitoring | `npm run ml:remote-status -- --job-id <job-id>`. The job state record captures the provider job ID, selected flavour, CUDA evidence, configured timeout, cost estimate, and terminal stage. |
| Failure cleanup | `npm run ml:remote-cancel -- --job-id <job-id> --reason <reason>`. The backend records the cleanup event and never treats a cancelled, errored, deleted, or unknown job as trained. |
| Artifact retrieval | After a confirmed `COMPLETED` job, run `npm run ml:remote-retrieve -- --job-id <job-id>`. Retrieval synchronizes the provider output receipt, resolves the immutable private model-repository revision, downloads a local cache, and verifies the adapter payload SHA-256, corpus hash, pack hash, CUDA evidence, and candidate-only manifest. |

At launch, the backend discovers provider hardware and filters it by the existing VRAM floor. It chooses the lowest reported hourly-cost GPU that meets the requirement; it does not hard-code T4, A10G, A100, H100, or H200. The provider exposes Job hardware discovery, status, logs, metrics, cancellation, encrypted secrets, timeouts, and writable durable volumes through its supported Jobs API. [1] [2] [3]

The remote Job invokes only `ml/train_smollm2_qlora.py`. Before invocation, the managed entrypoint recomputes the staged corpus and Behaviour Pack hashes. It persists the adapter to the configured **private** Hugging Face model repository and writes a retrieval receipt containing an immutable repository revision, artifact payload SHA-256, base-model and tokenizer revision, GPU details, software metadata, duration, and estimated cost. No token, teacher key, production user data, or raw secret is written to Git, logs, corpus rows, model cards, registry entries, or receipts.

A completed training job is still only a `trained_candidate`. It must first pass verifier checks and an independent held-out base-versus-student evaluation. The registry now rejects promotion unless the evaluation includes the held-out dataset hash, benchmark version, independent examiner evidence, base and student scorecards, and an explicit `studentBeatsBase=true` conclusion. Candidate → shadow → canary → production remains the only lifecycle, and no remote run can skip it.

## References

[1]: https://huggingface.co/docs/huggingface_hub/en/guides/jobs "Hugging Face Hub — Run and manage Jobs"
[2]: https://huggingface.co/docs/hub/en/jobs-configuration "Hugging Face Hub — Jobs configuration"
[3]: https://huggingface.co/docs/hub/en/jobs-manage "Hugging Face Hub — Manage Jobs"
