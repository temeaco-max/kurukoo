# Kurukoo Controlled Human Pilot Deployment Checklist

This checklist is a **go/no-go control**, not a statement that production operations have been completed. Every mandatory item must have a named owner and recorded evidence before any real person is invited.

## Pilot identity and bounded scope

| Requirement | Required evidence | Owner | Status before invite |
|---|---|---|---|
| Pilot cohort | 5–10 named adult testers and 2–5 manually reviewed providers/businesses; no public sign-up campaign | Pilot lead | Required |
| Geography | Written scope of at most 1–2 states and 2–3 LGAs/localities | Pilot lead | Required |
| Supply policy | Approved manual source policy, terms decision, public-record minimisation, removal/opt-out route | Supply reviewer | Required |
| Operator coverage | Named primary and backup operator, escalation contact, on-call hours and incident authority | Operations lead | Required |
| Tester consent | Adult pilot consent, contact method, privacy notice, feedback process, no-money disclosure | Pilot lead | Required |

## Mandatory deployment controls

| Control | Required state | Evidence to record | Owner |
|---|---|---|---|
| HTTPS and domain | HTTPS only, canonical domain, secure cookie behavior checked on the deployed domain | Browser test record and certificate status | Deployment owner |
| Production secrets | High-entropy `JWT_SECRET`, `MEMORY_ENCRYPTION_KEY`, and `QR_CONTEXT_SECRET` stored only in the deployment secret store; no debug OTP flags | Secret-manager record and production startup check | Deployment owner |
| Persistent storage | Single writable persistent volume with a production `DB_PATH`; one application writer and one worker process only | Volume path, permissions check, process topology | Deployment owner |
| Backup and restore | Encrypted pre-launch backup, daily backup schedule, completed restore rehearsal using a non-production copy | Timestamped restore rehearsal record | Operations lead |
| Rollback | Previous release artifact, compatible backup point, documented decision owner and stop procedure | Rollback rehearsal record | Deployment owner |
| Cookie and headers | Secure/HttpOnly/SameSite policy, CORS origins, request size limits and auth route behavior verified | Browser and route smoke-test result | Security owner |
| WAF and rate limits | IP/edge limits for chat, OTP, voice, QR activation, uploads, provider coordination, and webhook endpoints | Provider configuration screenshot or change record | Deployment owner |
| Monitoring | Health alert, error-rate/log access, worker error visibility, database-size and memory observation, quota/cost review process | Alert test and operator access record | Operations lead |
| Privacy and retention | Public privacy/terms links, data retention decision, export/deletion owner, incident-contact path | Published links and policy sign-off | Privacy owner |
| Operator access | Separate non-shared admin accounts; tested login, logout, audit visibility and least-privilege review | Access review record | Operations lead |

## Required environment posture

| Variable or feature | Required first-pilot posture | Evidence |
|---|---|---|
| `NODE_ENV` | `production` | Startup log without sensitive values |
| `KURUKOO_CONTROLLED_PILOT` | `true` | Enrolment rejection for an unlisted test account |
| `KURUKOO_WORKERS` | `1` after restore rehearsal; `0` during deterministic maintenance/testing | Process record |
| `KURUKOO_EXTERNAL_EXECUTION_ENABLED` | `false` | Execution-boundary smoke test |
| `KURUKOO_AGENT_ENABLED` | `false` | Agent status check |
| `KURUKOO_AGENT_AUTONOMOUS_LOW_RISK` | `false` | Agent status check |
| `KURUKOO_VOICE_ENABLED` | `false` unless the separate supervised voice checklist is approved | Health/status response |
| `KURUKOO_PAY_PROVIDER` | Unset or sandbox only; no production collection | Payment status response |
| `OTP_DEBUG` / `OTP_LEGACY_LOGIN` | `false` | Auth smoke test |

## Disabled by default for the real-human pilot

The following capabilities remain **disabled** unless a later, separately approved controlled activation is completed: production payment collection, regulated escrow, external dispatch or fulfilment execution, WhatsApp, SMS, Telegram, USSD, FCM delivery, emergency delivery, autonomous agents, and production voice.

The application must continue to represent an accepted quote as **accepted / awaiting confirmation only**. It must not imply payment, booking, provider external contact, dispatch, fulfilment, emergency notification, or completion without evidence from the relevant authoritative integration.

## Optional controlled activation record

An optional capability may be enabled only when this table is completed for that exact capability and environment.

| Field | Required record |
|---|---|
| Capability | Exact feature and environment variable or adapter |
| Credential owner | Named individual or team; credential stored in secret manager |
| Callback/evidence | Signed callback, delivery receipt, or other authoritative evidence source |
| Cost limit | Daily and pilot-total cost cap, alert threshold, and owner |
| Monitoring | Health/error/queue metric and review cadence |
| Test | Passing isolated sandbox or fixture test with expected failure behavior |
| Rollback | Exact disablement action, expected state, and verification step |
| Approval | Named operational, legal/compliance, and product approver as applicable |

## Final launch decision

The pilot lead records one decision after this checklist, the recovery rehearsal, supply onboarding review, and human test-script briefing are complete.

- **Do not invite anyone** when a repository P0/P1, an untested restore, missing production secret, missing operator, missing consent, uncontrolled external capability, or unclear public-provider/quote state remains.
- **Invite only the bounded cohort** when every mandatory item is evidenced and all disabled features remain disabled.
- **Do not interpret this checklist as public-production approval.**
