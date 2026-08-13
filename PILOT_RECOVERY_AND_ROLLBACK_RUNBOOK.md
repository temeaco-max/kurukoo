# Controlled Pilot Recovery, Backup, and Rollback Runbook

Kurukoo’s pilot storage model is intentionally a **single application instance with persistent SQL.js/SQLite storage**. This runbook does not add a second database, queue, or worker architecture. It defines what the pilot operator must prove before inviting humans and how to stop safely when the single-instance boundary fails.

## What must survive

| Event | Expected repository behavior | Operator verification |
|---|---|---|
| Application restart | Persisted conversations, Economic Requests, provider invitations, provider responses, quotes, operator handoffs, reminders, memory controls, and audit records survive when the same persistent `DB_PATH` volume is used. | Restart a rehearsal instance and inspect a known owner-scoped request and reminder. |
| Worker restart | Workers resume only feature-enabled, bounded work. Internal reminder/deferred paths may require normal retry; no worker may create external execution when disabled. | Start once with workers disabled, inspect state, then enable exactly one worker process. |
| Interrupted provider response | The invitation remains pending unless the canonical idempotent response write completed. A retry with the same idempotency key returns the existing response. | Repeat the response through a rehearsal fixture and inspect one invitation/event record. |
| Interrupted quote acceptance | The request is either still quoted or already `awaiting_confirmation`; repeat acceptance must not create a second acceptance event, payment, escrow, or fulfilment effect. | Run the provider-coordination regression and inspect the resulting event count. |
| Provider suspension or stale availability | New response, selection, or acceptance is rejected at revalidation points. Historical data remains audit evidence rather than current eligibility. | Suspend/revoke a rehearsal provider before each transition. |

## Backup procedure

1. Identify the persistent production `DB_PATH`. Confirm the application and its worker process are the only writers. Do not copy a transient development database or a file inside the deployment artifact.
2. Before a release and at least daily during the pilot, use the deployment platform’s volume snapshot or stop writes briefly before copying the SQLite file and any required SQLite sidecar files. Store the backup in encrypted operator-controlled storage.
3. Record the UTC timestamp, application commit, schema/version information, operator, checksum, source path, encrypted destination, and whether the copy was pre-release or daily.
4. Retain at least seven daily restore points and one verified pre-release restore point. Keep secrets separate from backups and never commit backups to Git.
5. Test restoration on a non-production rehearsal target before accepting the pilot’s first real record and after every schema-changing release.

## Restore rehearsal

| Step | Action | Pass condition |
|---:|---|---|
| 1 | Set workers to `0`, stop the application, and preserve the affected database file as incident evidence. | No second writer remains. |
| 2 | Copy the chosen encrypted backup to a separate rehearsal `DB_PATH`; verify ownership and permissions. | Restore copy exists and is readable only by the application account. |
| 3 | Start the application with workers still disabled and production-like secret values. | Startup succeeds and `/health` reports the database healthy without secrets in logs. |
| 4 | Run owner-scoped smoke checks for a known conversation, request, invitation/quote, reminder, and operator handoff. | Records are present and show their canonical states. |
| 5 | Run the focused provider-coordination and auth/route checks against the rehearsal target. | Idempotency and ownership checks pass. |
| 6 | Re-enable exactly one worker process only after the review. | No duplicate worker or unbounded execution appears. |
| 7 | Record the result, backup identifier, restore duration, operator, and any data-gap decision. | Pilot lead signs off or keeps pilot stopped. |

## Rollback procedure

1. **Stop invitations immediately.** Disable `KURUKOO_VOICE_ENABLED`, `KURUKOO_AGENT_ENABLED`, `KURUKOO_AGENT_AUTONOMOUS_LOW_RISK`, `KURUKOO_EXTERNAL_EXECUTION_ENABLED`, production payment configuration, and all outbound channel adapters. Keep `KURUKOO_CONTROLLED_PILOT=true` only if the application remains available for operator inspection; otherwise stop the service.
2. Preserve the incident timestamp, current commit, current `DB_PATH` file, deployment logs, and any error references. Do not alter or delete evidence while investigating.
3. Decide whether code rollback alone is compatible with the current database schema. If not, restore the approved compatible backup to the rehearsal target first. Do not blindly roll a schema backward.
4. Deploy the prior approved artifact or keep the service stopped. Start with workers disabled. Verify health, authentication, and owner-scoped request access before restoring user access.
5. Re-enable only the minimum Web Chat Assisted Pilot profile after a named operator signs off. Do not re-enable payments, execution, external delivery, voice, or agents as part of an incident recovery.
6. Tell affected testers only what is known. Do not claim a provider, payment, notification, emergency action, or fulfilment outcome without authoritative evidence.

## Pilot stop conditions

Stop the pilot and begin the rollback procedure when a repository P0 occurs; an unscoped data exposure is suspected; payment/execution/emergency delivery is falsely claimed; a provider becomes eligible without required evidence; backup restoration fails; two writers/workers act against the same pilot database; a secret may have leaked; or the operator cannot explain the request/provider/quote state for a live pilot case.
