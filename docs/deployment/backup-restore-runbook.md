# Kurukoo Backup and Restore Runbook

**Status:** Required before production promotion. This document is an operational procedure, not evidence that a backup or restore has already been executed.

## Scope and safety posture

Kurukoo production state must be owned by managed PostgreSQL. SQL.js exports are migration and emergency-recovery artifacts only; they are not a substitute for a durable Cloud Run database. The operator must perform the procedure against the intended managed instance and retain command output, timestamps, image/revision identifiers, row-count verification, and measured recovery times.

> Kurukoo must not claim a successful restore, payment recovery, notification delivery, or external dispatch until the corresponding external system produces independently verifiable evidence.

## Required targets and ownership

The release owner must record the approved values before the first production cutover. Until these values are filled and exercised, the recovery gate remains open.

| Control | Required production value | Evidence to retain |
|---|---|---|
| Recovery point objective (RPO) | `OWNER_TO_SET` | Backup schedule and latest successful backup timestamp |
| Recovery time objective (RTO) | `OWNER_TO_SET` | Timed isolated restore drill |
| Database owner | `OWNER_TO_SET` | Named on-call or platform team |
| Backup retention | `OWNER_TO_SET` | Managed database policy export |
| Restore destination | Isolated, non-production database | Instance identifier and access log |
| Encryption and access | Managed provider encryption; least-privilege service account | IAM and database configuration evidence |

## Pre-cutover source export

Freeze application writes and record the exact source revision. If a SQL.js database exists in a controlled environment, create an immutable copy before any migration attempt:

```bash
export DB_PATH=/path/to/kurukoo.sqlite
export EXPORT_DIR="recovery-artifacts/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EXPORT_DIR"
cp --reflink=auto --preserve=all "$DB_PATH" "$EXPORT_DIR/kurukoo.sqlite"
sha256sum "$EXPORT_DIR/kurukoo.sqlite" | tee "$EXPORT_DIR/kurukoo.sqlite.sha256"
```

Produce the deterministic migration report without connecting to PostgreSQL:

```bash
DB_PATH="$EXPORT_DIR/kurukoo.sqlite" npm run db:migrate:sqlite-to-postgres -- --verify-only \
  | tee "$EXPORT_DIR/migration-report.json"
```

The report, source checksum, commit SHA, and operator identity must be retained together. Do not use `--execute` until the destination is confirmed to be isolated or the approved cutover window is open.

## Managed PostgreSQL backup

Use the managed provider’s native backup facility. For Cloud SQL, the platform operator should run the equivalent of the following after substituting the approved project, instance, and backup policy values:

```bash
gcloud sql backups create \
  --instance="$CLOUD_SQL_INSTANCE" \
  --project="$GOOGLE_CLOUD_PROJECT" \
  --description="kurukoo-pre-cutover-${RELEASE_SHA}"
```

Record the resulting backup identifier and completion timestamp. A successful command is not sufficient evidence of recoverability; the backup must be restored into an isolated destination during the restore drill below.

## PostgreSQL migration and integrity verification

The migration script is dry-run by default. Run the actual import only with an approved source artifact and destination URL:

```bash
export DATABASE_URL='postgres://...'
export KURUKOO_POSTGRES_SSL=true
DB_PATH="$EXPORT_DIR/kurukoo.sqlite" npm run db:migrate:sqlite-to-postgres -- --execute \
  | tee "$EXPORT_DIR/postgres-migration-verification.json"
```

The verification must show matching schemas, important-table row counts, and deterministic integrity digests for Memory, Chat, Economic Requests, Notifications, Orders, Agent state, and Execution Requests. Stop and roll back before application cutover if any result is not verified.

## Isolated restore drill

Restore the latest managed backup into an isolated database with production credentials and external execution disabled. Point the verifier at the isolated destination, run the fresh-schema and migration-integrity contracts, then start a single application process against that database in a non-public environment. Verify owner scoping, encrypted Memory, conversation continuity, idempotency records, and readiness after restart.

The drill must record:

1. Backup creation timestamp and restore start timestamp.
2. Restore completion timestamp and measured RTO.
3. The backup timestamp relative to the latest accepted write and measured RPO.
4. Row counts and integrity digests before and after restore.
5. `/health` and `/readyz` results after restart.
6. Any data loss, schema mismatch, permission error, connection failure, or manual intervention.

Destroy the isolated restore database only after the evidence has been exported to the approved retention location.

## Rollback and incident handling

If migration verification, readiness, or core-journey smoke fails, keep the Cloud Run revision unpromoted, stop writes if necessary, and redeploy the last verified revision. Do not switch back to SQL.js on Cloud Run as a workaround. Escalate database corruption, credential exposure, emergency-flow degradation, or uncertain external outcomes to the incident owner and preserve logs before cleanup.

A release is not recovery-ready until an operator has completed this drill, attached the evidence to the release record, and replaced every `OWNER_TO_SET` value with an approved operational value.
