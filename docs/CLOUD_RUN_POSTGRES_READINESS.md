# Cloud Run PostgreSQL Readiness

This document describes the Cloud Run deployment posture for the PostgreSQL
canonical persistence owner. It is a readiness audit, not a deployment guide.
Production activation remains fail-closed until all external prerequisites are
provisioned by an operator.

## Current state: IMPLEMENTED + EXTERNAL/DEPLOYMENT BLOCKED

The codebase is technically ready for PostgreSQL-on-Cloud-Run, but production
activation requires external configuration that is intentionally not present in
the repository.

## Readiness criteria

| Criterion | Status | Evidence |
|---|---|---|
| No writable local disk dependency for durable state | IMPLEMENTED | `src/index.ts` imports `assertProductionPersistenceSafe`; SQL.js mode is blocked when `K_SERVICE`/`KURUKOO_CLOUD_RUN` is detected. PostgreSQL mode writes exclusively to the external database. |
| Worker startup is bounded | IMPLEMENTED | `KURUKOO_WORKERS=1` is enforced in the preflight (`production-preflight.mjs`) and in `index.ts`. Horizontal scaling is a managed Cloud Run responsibility (stateless request per instance). |
| Server can start with multiple instances | IMPLEMENTED | The Express app holds no in-memory shared state between requests. Every request acquires a fresh `CanonicalStore` handle backed by the shared PostgreSQL connection pool. |
| Database is canonical shared state | IMPLEMENTED | `src/services/canonicalStore.ts` routes all durable reads/writes through the `postgres` `node-postgres` pool when `KURUKOO_DATABASE_MODE=postgres`. `canonicalDomainSchemas.ts` defines every production table with PostgreSQL DDL. |
| Request processing is stateless | IMPLEMENTED | No `onSnapshot` listeners exist except the explicit allow-list (messages by `threadId`, single bookings document). All other reads use one-time queries against the canonical store. |
| Local caches can be lost safely | IMPLEMENTED | In-memory caches (e.g. `lib/cache.ts`) are ephemeral per-instance; cache invalidation triggers `cacheInvalidate()` on any canonical write. Instance restart recovers all durable state from PostgreSQL. |
| Graceful shutdown does not lose committed state | IMPLEMENTED | PostgreSQL commits are synchronous (within a transaction). `closeCanonicalStore()` drains the pool on `SIGTERM`/process exit. No SQL.js flush is required in PostgreSQL mode. |
| Environment configuration is deployment-safe | IMPLEMENTED | `.env.production.example` and `.env.example` document every variable. The preflight validates JWT_SECRET length, payment provider, and required PostgreSQL connection vars. |
| Production activation remains fail-closed | IMPLEMENTED | Three independent gates: (1) `POSTGRES_APPLICATION_CALL_SURFACE_MIGRATED = true` in source (verified by audit), (2) `KURUKOO_POSTGRES_APPLICATION_INTEGRATED=true` env var, (3) `DATABASE_URL` must be non-empty. |

## Environment variables for PostgreSQL Cloud Run activation

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `KURUKOO_DATABASE_MODE` | yes | `sqljs` | Set to `postgres` to select the PostgreSQL canonical owner. |
| `DATABASE_URL` | yes (postgres mode) | — | PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/db`). |
| `KURUKOO_POSTGRES_APPLICATION_INTEGRATED` | yes (postgres mode) | `false` | Must be `true` to release the activation gate. |
| `KURUKOO_POSTGRES_SSL` | no | `true` | Set to `false` for local/staging with self-signed certs. |
| `KURUKOO_POSTGRES_POOL_MAX` | no | `5` | Max connections in the pg pool (bounded for Cloud Run concurrency). |
| `KURUKOO_POSTGRES_IDLE_TIMEOUT_SECONDS` | no | `30` | Idle connection timeout. |
| `KURUKOO_POSTGRES_CONNECT_TIMEOUT_SECONDS` | no | `5` | Connection establishment timeout. |
| `JWT_SECRET` | yes | — | Must be ≥ 32 characters (validated by preflight). |
| `KURUKOO_WORKERS` | yes | `1` | Must remain `1` on Cloud Run. |
| `KURUKOO_PERSISTENT_STATE_REQUIRED` | no | `true` | Set `false` only for ephemeral environments. |

## Exact remaining external activation prerequisites

These are **NOT** provisioned by the repository. An operator must configure them:

1. **Cloud SQL (PostgreSQL 16+)** — managed PostgreSQL instance in the same VPC.
2. **Cloud SQL IAM / user credentials** — a database user with `CONNECT`, `CREATE`, and table-level `INSERT`/`SELECT`/`UPDATE`/`DELETE` privileges on the target schema.
3. **Cloud SQL SSL/TLS** — either use the Cloud SQL IAM database authenticator (`cloudsql-superuser` role) or configure `sslmode=require` with the Cloud SQL root CA.
4. **Secret Manager entries** — `DATABASE_URL`, `JWT_SECRET`, and any provider API keys must be stored as Secret Manager secrets and injected as env vars.
5. **KURUKOO_POSTGRES_APPLICATION_INTEGRATED=true** — must be set in the Cloud Run service env.
6. **VPC connector** — Cloud Run service must use a Serverless VPC Access connector to reach Cloud SQL.
7. **Payment credentials** — `KURUKOO_PAY_PROVIDER` must be set to a non-sandbox provider (e.g. `stripe`) and `STRIPE_SECRET_KEY` must be provisioned. Sandboxed payments are forbidden in production.
8. **Channel credentials** — WhatsApp, email, FCM, and voice provider credentials as applicable.
9. **External providers** — configured AI model provider keys (Mistral, Groq, etc.) and any connector integrations.
10. **DNS / HTTPS** — a managed HTTPS domain mapped to the Cloud Run service.
11. **Migration step** — run `scripts/migrate-sqlite-to-postgres.ts --execute` against the production SQLite source before cutover, or bootstrap a fresh schema with `scripts/bootstrap-postgres-domain-schema.ts`.

## Fail-closed chain summary

```
main branch (KURUKOO_DATABASE_MODE=sqljs)
  ↓
Preflight: sqljs + Cloud Run → BLOCKED
  ↓
Operator sets KURUKOO_DATABASE_MODE=postgres
  ↓
assertCanonicalPersistenceModeSafe(): MIGRATED flag = true → passes startup check
  ↓
Preflight: postgresApplicationIntegrated=true (0 SQL.js files) ✓
  ↓
Preflight: KURUKOO_POSTGRES_APPLICATION_INTEGRATED not yet set → BLOCKED
  ↓
Operator sets KURUKOO_POSTGRES_APPLICATION_INTEGRATED=true
  ↓
Preflight: DATABASE_URL not yet set → BLOCKED
  ↓
Operator provisions Cloud SQL and sets DATABASE_URL
  ↓
All gates pass → activation possible
```

## Do NOT

- Set `KURUKOO_POSTGRES_APPLICATION_INTEGRATED=true` without a verified Cloud SQL instance and migration.
- Use Cloud Storage FUSE as a transactional SQL.js database.
- Enable `KURUKOO_WORKERS > 1` before shared worker/lease semantics are validated.
- Commit `.env` with production credentials.
