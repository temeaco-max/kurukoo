# Kurukoo on Google Cloud Run

The repository contains a direct Cloud Run deployment path so Google AI Studio Build does not have to remain in the deployment chain.

## Current production boundary

**Cloud Run production is currently BLOCKED for canonical application state.**

The current Kurukoo persistence owner is SQL.js backed by a local SQLite file. That is valid for a single-process environment with a genuinely durable host filesystem, but Cloud Run container storage is instance-local and ephemeral. A Cloud Run restart, replacement, or a second instance must never be allowed to define or lose canonical user/application state.

The repository therefore treats the current Cloud Run shape as a proving/blocked profile:

- `KURUKOO_DATABASE_MODE=sqljs` remains explicit.
- `KURUKOO_WORKERS=1` remains explicit.
- `containerConcurrency=1` remains explicit.
- `maxScale=1` prevents replica-level split-brain, but does **not** make local SQL.js durable.
- `/readyz`, startup preflight, and production startup checks all fail closed while SQL.js is the Cloud Run persistence owner.
- Cloud Storage FUSE must not be used as a transactional SQL.js database.

## Deployment shape

```text
GitHub main
  ↓
Cloud Build
  ↓
Artifact Registry
  ↓
Cloud Run
  ↓
Kurukoo
  ├── Web / PWA / canonical Chat
  ├── SmolLM2 1.7B local inference when enabled
  └── stronger hosted AI fallback when configured
```

The existing `Dockerfile`, `deploy/cloud-run/service.yaml`, and `cloudbuild.yaml` are the canonical repository deployment artifacts.

## Required production change

Before Cloud Run can carry durable canonical state, Kurukoo needs one shared managed database adapter to become the single persistence owner. The repository already has explicit scale/persistence boundaries, but no active Postgres adapter exists today; a `DATABASE_URL` alone does not change the owner.

The smallest acceptable transition is:

1. Implement the existing persistence boundary against one managed relational database in `europe-west2`.
2. Map the existing canonical state without introducing a second application database.
3. Validate row counts, key constraints, idempotency, auth challenge consumption, chat/memory/request/notification/agent state, restart/reconnect behaviour and transactional worker claims.
4. Freeze writes, perform one final export/import, verify, and cut the canonical owner over without dual-writing.
5. Keep the SQL.js snapshot read-only as the rollback source until cutover verification is accepted.

Do not run this migration against production from repository code. It requires the cloud operator and production data access boundary.

## Build and deploy

From a Google Cloud project with Cloud Build, Artifact Registry and Cloud Run enabled:

```bash
gcloud builds submit . --config cloudbuild.yaml \
  --substitutions=_SERVICE=kurukoo,_REGION=europe-west2
```

The default proving profile is intentionally conservative for the 1.7B local model:

- Cloud Run: 4 vCPU
- memory: 4 GiB
- concurrency: 1
- request timeout: 300 seconds
- minimum instances: 0
- maximum instances: 1 while SQL.js remains the local persistence owner
- `KURUKOO_SMOLLM2_LOCAL=true`
- `SMOLLM2_MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct`
- `SMOLLM2_DTYPE=q4`
- model cache: `/tmp/huggingface`
- background workers: one application worker only; external execution disabled

These values are repository proving defaults, not claims about the cheapest production configuration. The 4 GiB profile is the explicit contract exercised by `test:cloud-run-smollm2`; measure actual Cloud Run startup, memory and latency before changing it.

## Secrets

Do not put API keys or JWT secrets in `cloudbuild.yaml`, the Docker image, or Git.

Configure production secrets through Google Cloud Secret Manager / Cloud Run environment configuration. At minimum the production service needs a strong `JWT_SECRET`; other credentials are only required for the corresponding external adapters.

## Runtime health

`/health` reports application/database health plus persistence readiness, runtime model and external-adapter configuration state.

`/readyz` verifies that the application and database are available, that a model boundary is configured when `KURUKOO_CLOUD_RUN_REQUIRE_MODEL=true`, and that the configured persistence mode is actually safe for the deployment environment.

## Persistence and workers

The application deliberately keeps canonical state in one authority. Memory, Chat messages, auth challenges, Economic Requests, internal notifications, durable jobs, agent goals/events and idempotency records all ultimately depend on the SQL.js persistence owner today.

Process-local worker health is not durable state. Background timers are safe only inside the current single-process boundary; distributed agents, rate limiting, presence and multi-instance job execution remain blocked until shared coordination state is introduced together with the database adapter.

## External activation

Cloud Run hosting does not itself activate:

- payment settlement;
- WhatsApp/Telegram/SMS delivery;
- FCM push delivery;
- live voice/WebRTC providers;
- provider verification or availability;
- dispatch/logistics;
- real emergency call connection;
- trained/promoted SmolLM2 adapter.

Those remain independently configured and evidence-gated by the existing canonical boundaries.

## Existing AI Studio deployment

Google AI Studio Build can continue to publish the same repository to Cloud Run. The direct Cloud Build path is an alternative that makes GitHub `main` the deployment source of truth.

No application architecture depends on AI Studio Build.
