# Kurukoo Production Secret Inventory

**Status:** Configuration contract. Secret values must never be committed, embedded in the container image, printed in logs, or sent to frontend bundles.

Cloud Run deployments must set `KURUKOO_SECRET_SOURCE=secret_manager` and inject enabled credentials with Secret Manager references. The checked-in defaults keep external execution and connector activation disabled. A secret existing in Secret Manager is not evidence that the corresponding external capability is operational.

| Capability | Runtime variable | Secret Manager name | Default posture | Activation evidence required |
|---|---|---|---|---|
| Authentication | `JWT_SECRET` | `kurukoo-jwt-secret` | Required | 32+ character non-placeholder value and rotation owner |
| PostgreSQL persistence | `DATABASE_URL` | `kurukoo-database-url` | Required for Cloud Run | Managed database connectivity, schema, restart, migration, and integrity tests |
| Memory encryption | `MEMORY_ENCRYPTION_KEY` | `kurukoo-memory-encryption-key` | Disabled or bounded until configured | Key ownership, rotation, restore verification, and owner-scoping tests |
| Push notifications | Firebase credential variables | `kurukoo-fcm-credentials` | Disabled | Provider delivery receipts, token lifecycle, fallback, and alerting |
| Payments | PSP credential variables | `kurukoo-payment-provider` | Disabled; sandbox forbidden | Real PSP contract, webhook signature verification, reconciliation, refunds, and disputes |
| Hosted conversational AI | Provider credential variables | `kurukoo-ai-provider` | Bounded fallback | Privacy review, rate/cost controls, live smoke, and fallback evidence |
| MCP/OAuth | `KURUKOO_MCP_CLIENT_SECRET`, `KURUKOO_MCP_OAUTH_SECRET` | `kurukoo-mcp-oauth` | Disabled | HTTPS issuer/callbacks, consent, revocation, and audit evidence |
| User-owned storage | OAuth and encryption variables | `kurukoo-storage-oauth` | Disabled or staging fallback | Protected object storage, signed access, malware scanning, deletion, and retention |
| Voice/realtime | `GEMINI_API_KEY` or provider key | `kurukoo-voice-provider` | Disabled | Consent, relay/STUN/TURN, identity, artifact disclosure, and recovery evidence |
| Channel connectors | WhatsApp/Telegram/email credentials | `kurukoo-channel-connectors` | Disabled | Owner pairing, inbound/outbound receipts, revocation, and failure handling |

## IAM and rotation requirements

The Cloud Run runtime service account should have access only to the secret versions required by the enabled deployment. CI/build identities need permission to reference the configured versions, but should not receive secret values in build logs. Rotate credentials through a controlled change with an owner, expiry/rotation date, validation smoke, and rollback plan.

The release record must retain secret **names and versions**, not secret values. If a credential is suspected to have appeared in source, build output, logs, or an image layer, stop activation, rotate it, review access logs, and run the repository secret scan before resuming.

## Activation rule

A capability is considered **internally implemented but externally inactive** when its repository contracts pass while the provider secret, provider receipt, or operational evidence is absent. Kurukoo must communicate that boundary to users and must not infer payment, dispatch, delivery, verification, or provider success from local records alone.
