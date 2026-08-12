# Kurukoo Controlled Pilot Operating Guide

## Purpose and pilot boundary

This guide defines how to operate Kurukoo in front of a small, invited group without presenting unavailable providers, payments, fulfilment, channels, emergency notification, or agent completion as operational. The recommended first profile is **Web Chat Assisted Pilot**. It keeps real-money collection, regulated escrow, external execution, outbound channels, and autonomous agents disabled while allowing users to discover Kurukoo, converse, authenticate progressively, create canonical Economic Requests, use reminders and memory controls, and receive truthful options or a clear unavailable state.

The pilot is not unrestricted public launch. An operator must own the daily review, incident escalation, provider evidence review, data request response, and shutdown decision.

## Pilot profiles

| Profile | Enabled | Disabled | Appropriate use |
|---|---|---|---|
| Web Chat Assisted Pilot | Web Chat, guest sessions, progressive OTP, FastText fallback, reminders, internal inbox, QR context, memory controls, sandbox payment boundary | Production payment, escrow, external execution, voice, autonomous agent, outbound channels, emergency notification | First 5–10 invited testers. |
| Voice Evaluation | Web Chat Assisted Pilot plus `KURUKOO_VOICE_ENABLED=true` and Gemini Live credentials | Production payment, external execution, autonomous agent, outbound channels | Short supervised voice sessions after quota and consent checks. |
| Agent Evaluation | Web Chat Assisted Pilot plus `KURUKOO_AGENT_ENABLED=true` and `KURUKOO_AGENT_AUTONOMOUS_LOW_RISK=true` | External execution, production payment, outbound channels | Operator-owned test goals only; not a general autonomous service. |
| Sandbox Payment Evaluation | Web Chat Assisted Pilot plus Stripe sandbox credentials and registered test webhook | Production collection, regulated custody, external settlement | Contract and webhook validation with test payment methods only. |
| External Execution Evaluation | Only after provider evidence, connector authorization, and operator sign-off; `KURUKOO_EXTERNAL_EXECUTION_ENABLED=true` | Any connector not explicitly authorized | Isolated connector test, never as a default pilot setting. |

## Before launch

The operator must create a dedicated deployment domain with HTTPS, a managed secret store, a persistent writable volume for the SQL.js/SQLite database, and a tested rollback path. Production startup now fails closed unless `JWT_SECRET` and `MEMORY_ENCRYPTION_KEY` are high-entropy values of at least 32 characters. `QR_CONTEXT_SECRET` must be set separately for signed QR links outside local development. `OTP_DEBUG` and `OTP_LEGACY_LOGIN` must remain false.

The minimum configuration is a single application instance with `NODE_ENV=production`, `KURUKOO_WORKERS=1`, a persistent `DB_PATH`, `KURUKOO_VOICE_ENABLED=false`, `KURUKOO_AGENT_ENABLED=false`, `KURUKOO_EXTERNAL_EXECUTION_ENABLED=false`, no production payment provider, and no outbound channel credentials. Configure the operator admin account through secret management, not source control. Use `KURUKOO_WORKERS=0` only for deterministic tests.

Before inviting users, the operator must verify `/health`, confirm `database: ok`, confirm payment and voice states are the intended disabled/configured states, confirm that unconfigured channels are shown as not connected, test logout and account deletion in a non-production rehearsal, create and restore a database backup, and review the first ten application log minutes for sensitive values.

## During the pilot

The operator reviews system health at least twice daily and after every reported failure. The operator watches request failures, authentication failures, AI fallback rates, voice session counts if enabled, webhook verification failures, reminder worker errors, agent goal transitions if enabled, queue depth, database size, and memory usage. The existing `/health` endpoint is a liveness and basic database signal, not a substitute for external uptime, log, database, backup, or cost monitoring.

Users must be told that Kurukoo can help structure a request and surface eligible options when evidence exists, but it does not guarantee provider availability, price, payment, escrow, dispatch, fulfilment, emergency response, or external message delivery unless the interface shows authoritative evidence. Providers must be told that a profile is not verification, availability, certification, inventory, or guaranteed response.

Human intervention is required for provider evidence review, disputes, payment reconciliation, emergency escalation, unsupported fulfilment, suspected abuse, data deletion/export requests, channel outages, and any request that would require a regulated financial or safety decision.

## Kill switches

Use environment configuration and restart the service through the deployment process. Do not edit source files during an incident.

| Capability | Kill switch | Safe disabled value | Effect |
|---|---|---|---|
| Web Voice | `KURUKOO_VOICE_ENABLED` | `false` | Prevents new voice sessions; existing session limits remain bounded. |
| Autonomous agent | `KURUKOO_AGENT_ENABLED` | `false` | Stops agent goal creation and worker re-entry. |
| Agent low-risk autonomy | `KURUKOO_AGENT_AUTONOMOUS_LOW_RISK` | `false` | Prevents autonomous low-risk tool execution. |
| Production payments | `KURUKOO_PAY_PROVIDER` | unset in production | Payment routes fail closed unless the configured adapter is verified. |
| External execution | `KURUKOO_EXTERNAL_EXECUTION_ENABLED` | `false` | Blocks connector authorization before dispatch. |
| Channels | Remove provider credentials and callback registration | unconfigured | UI remains not connected and adapters cannot deliver. |
| Notifications | Remove FCM/channel credentials | unconfigured | Internal inbox may persist notifications; no external delivery is claimed. |
| Referrals | Disable the contributor/referral surface through existing feature policy or remove QR campaign context | campaign disabled | No new campaign should be promoted; existing attribution remains idempotent. |

After disabling a capability, verify `/health`, the relevant status endpoint, the application log, and one authenticated or guest request path. Record the incident time and the last known active state.

## Backup, restore, and rollback

The pilot database is the file named by `DB_PATH`, normally a persistent `tmp/kurukoo.sqlite`-style path outside the release artifact. Before each deployment and at least daily during the pilot, stop writes briefly or use the platform’s volume snapshot to copy the SQLite file to encrypted operator storage. Keep at least seven daily copies and one pre-release copy. Never place the database or secret files in the Git repository.

To restore, stop the application and workers, preserve the damaged file as evidence, copy the selected backup into the configured `DB_PATH`, verify file ownership and permissions, start with workers disabled, run `/health` and route smoke tests, then re-enable workers. A rollback restores the previous application artifact and the compatible database backup; do not roll a schema backward without checking migrations.

Because SQLite is single-instance pilot storage, do not run multiple writers or multiple worker processes against the same file. Move to a managed database and queue only when measured volume, availability, or concurrency requires it.

## Five-to-ten-person controlled test protocol

Recruit 5–10 invited adults who understand that this is a controlled pilot. Do not expose unrestricted production or request real money. Assign each tester a distinct account and, where possible, one tester a QR referral link. Ask each tester to start naturally, request something realistic, authenticate only when prompted, reload, close and return, use a reminder, inspect memory, log out, and return. Offer voice only when the voice evaluation profile is active.

Record start time, first understood intent, authentication steps, request creation, any quote state, dead ends, confusion, misleading language, latency, mobile width, browser, network quality, voice failures, and whether the tester understood every unavailable state. Do not convert observations into success metrics until an operator has reviewed the raw notes.

## Incident and emergency shutdown

For suspected data exposure, financial integrity failure, false fulfilment, unsafe emergency claim, runaway cost, or provider impersonation, immediately disable voice, agent, external execution, production payments, and outbound channels; preserve logs and the database backup; stop inviting users; and notify the designated operator and legal/compliance contact. Keep the public site available only if it can accurately explain the unavailable state; otherwise stop the application through the deployment platform.

Kurukoo must never claim that an emergency contact, emergency service, provider, payment processor, or channel has been notified without delivery or authoritative state evidence. The emergency operator process remains external to the repository.

## Activation checklist

1. Set production secrets and persistent `DB_PATH`.
2. Confirm HTTPS, domain cookies, callback URLs, and operator access.
3. Run `npm run build`, `npm run lint`, `npm run test:routes`, `npm run audit:security`, `npm run secrets:staged`, and the targeted voice/QR/agent/payment tests applicable to the profile.
4. Back up the empty or seeded pilot database and test restoration.
5. Start with the Web Chat Assisted Pilot profile.
6. Verify health and disabled capability states.
7. Invite only the approved tester cohort.
8. Review logs and requests at the agreed operator cadence.
9. Activate one external capability only after its provider, callback, commercial, legal, and operational checklist is complete.
10. Shut down or roll back immediately on a P0 or unresolved P1 incident.
