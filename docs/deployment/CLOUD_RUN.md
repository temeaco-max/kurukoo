# Kurukoo on Google Cloud Run

The repository contains a direct Cloud Run deployment path so Google AI Studio Build does not have to remain in the deployment chain.

## Current production boundary

**Cloud Run production remains BLOCKED until PostgreSQL is the active canonical persistence owner.**

The current Kurukoo persistence owner is SQL.js backed by a local SQLite file. That is valid for a single-process environment with a genuinely durable host filesystem, but Cloud Run container storage is instance-local and ephemeral. A Cloud Run restart, replacement, or a second instance must never be allowed to define or lose canonical user/application state.

PR #88 established the SQL.js/Cloud Run block. The current task adds the PostgreSQL cutover foundation without provisioning or activating external infrastructure.

## Persistence modes

`KURUKOO_DATABASE_MODE=sqljs`

- lightweight local/development canonical persistence;
- one process/one worker only for shared-write safety;
- Cloud Run durable production remains BLOCKED.

`KURUKOO_DATABASE_MODE=postgres`

- intended durable/shared deployment mode;
- PostgreSQL is the sole semantic persistence owner once the async application adapter is integrated;
- no SQL.js dual-write or read-through mirror is allowed;
- the current repository deliberately fails closed because the existing services still expose synchronous SQL.js database calls and have not yet been migrated to the async PostgreSQL boundary.

The readiness state therefore remains `BLOCKED` for PostgreSQL until application integration is complete. Once integrated, the readiness contract is designed to report `READY_FOR_EXTERNAL_CONFIG` when a valid PostgreSQL connection signal is present.

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
  ↓
ONE canonical persistence owner
  ├── SQL.js for lightweight local mode
  └── PostgreSQL for durable shared deployment mode
```

The existing `Dockerfile`, `deploy/cloud-run/service.yaml`, and `cloudbuild.yaml` are the canonical repository deployment artifacts.

## PostgreSQL cutover foundation

`src/services/postgresPersistence.ts` uses the pinned, server-only `postgres` client and provides the async PostgreSQL connection, bounded pooling, parameterized queries, transaction and graceful shutdown boundary. It intentionally does not emulate the synchronous SQL.js API.

`scripts/migrate-sqlite-to-postgres.ts` provides the deterministic migration/export foundation. It derives a table/index manifest and schema checksum from the SQL.js source, creates tables in foreign-key dependency order, records the import in `schema_migrations`, verifies schema columns, row counts, and ordered value digests for Memory, Chat, Economic Requests, notifications, Agent state, and execution records, and never mutates the source file. It defaults to a dry-run; `--execute` is an explicit operator-controlled import operation.

The migration foundation is tied to schema version `2026-08-22-canonical-runtime-schema` from `data/audits/database-schema-manifest.json`.

Repository-controlled local proof uses a disposable real PostgreSQL instance through `npm run test:postgres-persistence` and `npm run test:postgres-migration-roundtrip`. These contracts cover two-process shared state, transaction rollback, duplicate idempotency rejection, SQL.js source immutability, encrypted Memory preservation, Chat, Economic Request, notification, Agent state, and execution-record preservation. They are **not** production connectivity or deployment proof.

For a reproducible local-only database, `docker-compose.postgres-test.yml` starts one ephemeral `postgres:17-alpine` service on `127.0.0.1:54329`; it starts neither Redis nor the application. Set a non-production `KURUKOO_TEST_POSTGRES_URL` for that disposable database, run both PostgreSQL contracts, and then run `docker compose -f docker-compose.postgres-test.yml down -v`. The contracts intentionally refuse to use ambient `DATABASE_URL` values.

## Required production change

The remaining application change is not another database architecture. It is the async persistence call-surface migration:

```text
current services
  ↓
canonical async Kurukoo persistence interface
  ↓
SQL.js adapter       PostgreSQL adapter
(local/test)           (durable/shared)
```

After that migration, validate the PostgreSQL path with fresh schema, migration integrity, restart, two-process shared-state, transactions, idempotency, connection-loss and schema-mismatch tests. Only then should a managed PostgreSQL service be configured.

The final operational cutover remains:

1. stop writes;
2. export SQL.js state;
3. import into PostgreSQL;
4. verify row counts, important integrity constraints and encrypted Memory preservation;
5. switch `KURUKOO_DATABASE_MODE=postgres`;
6. start the application;
7. verify `/readyz` and core journeys;
8. rollback before acceptance if verification fails.

No repository operation provisions Cloud SQL, changes IAM/DNS, migrates live data or creates Redis.

## Cloud Run proving configuration

The current proving profile remains conservative and intentionally non-promotable until the remaining gates pass:

- Cloud Run: 4 vCPU
- memory: 4 GiB
- concurrency: 1
- request timeout: 300 seconds
- minimum instances: 0
- maximum instances: 1 until distributed worker ownership is certified
- `KURUKOO_SMOLLM2_LOCAL=true`
- `SMOLLM2_MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct`
- `SMOLLM2_DTYPE=q4`
- model cache: `/tmp/huggingface`
- background workers: one application worker only; external execution disabled
- artifact storage: local storage is explicitly blocked for Cloud Run; protected object storage must be implemented and selected before promotion

These are repository proving defaults, not claims about the cheapest production configuration.

## Secrets

Do not put API keys, database credentials or JWT secrets in `cloudbuild.yaml`, the Docker image, frontend bundles or Git. The checked-in Cloud Build path injects `JWT_SECRET` and `DATABASE_URL` from Secret Manager references and declares `KURUKOO_SECRET_SOURCE=secret_manager`; the service manifest carries the same contract. The referenced secret names are configuration placeholders and must exist with least-privilege IAM before any real deployment attempt.

For the eventual minimal Google Cloud configuration, use one Cloud SQL for PostgreSQL instance and one Secret Manager-backed `DATABASE_URL` injected into Cloud Run. The service should connect through the Cloud SQL connector/socket rather than exposing a public database address. Expected non-secret runtime settings are `KURUKOO_DATABASE_MODE=postgres`, `KURUKOO_POSTGRES_POOL_MAX`, `KURUKOO_POSTGRES_IDLE_TIMEOUT_SECONDS`, `KURUKOO_POSTGRES_CONNECT_TIMEOUT_SECONDS`, and `KURUKOO_POSTGRES_SSL`; production credentials remain external and must not be committed.

## Runtime health

`/health` reports application/database health plus persistence readiness.

`/readyz` verifies that the configured persistence mode is safe for the deployment environment. SQL.js + Cloud Run remains `not_ready`; PostgreSQL is safe only after the complete application call-surface migration, managed-database verification, secret injection, and protected storage gates pass. Cloud Build runs production preflight before deploy and rejects a revision whose Cloud Run Ready condition is not true after deploy.

## Workers and shared coordination

A shared database does **not** make all background workers horizontally safe by itself. Notifications, execution, escrow/payment, recurring billing and Agent worker timers remain process-local until their ownership/lease semantics are explicitly reviewed. Redis is not introduced by this persistence task.

## External activation

Cloud Run hosting does not itself activate payment settlement, external channel delivery, FCM, voice, provider verification, dispatch or real emergency connectivity. Those remain independently configured and evidence-gated.

## Existing AI Studio deployment

Google AI Studio Build can continue to publish the same repository to Cloud Run. The direct Cloud Build path is an alternative that makes GitHub `main` the deployment source of truth.

No application architecture depends on AI Studio Build.
