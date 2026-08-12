# Kurukoo Controlled Real-World Pilot Certification Report

## Certification conclusion

> **CONTROLLED PILOT READY** — only for an invited, supervised Web Chat Assisted Pilot with production payment, regulated escrow, external execution, outbound channels, emergency notification, and autonomous agents disabled unless their external, legal, commercial, and human-operational gates are separately approved.

Kurukoo is not certified for unrestricted public launch. The repository now behaves truthfully when providers, payment systems, channels, voice, execution connectors, emergency delivery, or autonomous agents are unavailable. A small controlled group can use the core conversation, progressive authentication, canonical Economic Request, QR context, reminders, internal notification inbox, and memory controls without the interface pretending that external fulfilment has happened.

## Baseline and final state

| Item | Evidence |
|---|---|
| Baseline commit | `b6eecd4` — `chore(css): remove verified dead public selectors` |
| Branch | `integration/main-convergence-audit` |
| PR | [#31](https://github.com/temeaco-max/kurukoo/pull/31) remains the integration vehicle. |
| Baseline PR state | Clean, mergeable, with build, FastText, and secret-scan checks successful. |
| Final commit | Pending final publication of this certification pass. |
| Working tree at report authoring | Contains only the certification hardening and documentation changes described below. |

## Certification evidence

The pilot pass covered guest and authenticated journeys, realistic requests across the canonical skills, ambiguous language, QR entry and referral attribution, provider evidence states, payment and escrow boundaries, bounded agent runtime, voice continuity, reminders, Living Memory, channels, safety contacts and check-ins, data ownership, failure recovery, cost exposure, observability, admin surfaces, production-domain assumptions, backup/recovery posture, and human-test preparation.

No real human cohort, production payment, real provider dispatch, outbound channel delivery, emergency contact delivery, or regulated settlement was available in this environment. Those are explicitly classified as external or operational dependencies rather than reported as successful tests.

## Repository fixes made during certification

Four repository-level defects were fixed. Production startup now fails closed when `JWT_SECRET` or `MEMORY_ENCRYPTION_KEY` is absent or shorter than 32 characters. Standard logs no longer emit phone numbers, peer lists, or transaction amounts in OTP, safety-circle, money-circle, or user-deletion paths. External connector authorization now requires `KURUKOO_EXTERNAL_EXECUTION_ENABLED=true`; the deployment template defaults it to false and the controlled fixture enables it explicitly. Referral attribution now rejects self-referral at the service boundary, not only in the current HTTP route.

## Validation results

The final local suite passed `npm run lint`, `npm run build`, `npm run test:routes`, `npm run audit:security`, `npm run audit:services`, `npm run audit:skills`, `npm run audit:messaging`, `npm run audit:css:all`, `npm run test:chat-dom-safety`, `npm run test:email`, `npm run fasttext:test`, and `npm run secrets:staged`. Targeted QR, voice, agent, Stripe, Trust Score, provider-verification, execution-boundary, economic-lifecycle, multi-party, notification, channel-usage, dispute, native-assistance, and production-secret probes also passed.

The fresh compiled runtime on port 3001 returned successful responses for the public route matrix. Direct pages returned 200; canonical redirect pages returned the expected 301. Fresh 360px and 1440px homepage screenshots showed no clipping, horizontal overflow, or page-container regression. `/health` reported `status: ok`, `database: ok`, `payment_provider: sandbox`, and `economic_payments_enabled: false`. The runtime log clearly reported workers disabled for the deterministic browser pass and did not claim unconfigured integrations were active.

## Exact pilot activation procedure

Begin with one persistent HTTPS instance, managed production secrets, a backed-up SQL.js/SQLite file, `KURUKOO_WORKERS=1`, `KURUKOO_VOICE_ENABLED=false`, `KURUKOO_AGENT_ENABLED=false`, `KURUKOO_EXTERNAL_EXECUTION_ENABLED=false`, no production payment provider, and no outbound channel credentials. Confirm `/health`, authentication, logout, profile export/delete rehearsal, QR activation, and internal notifications. Invite only the approved 5–10 tester cohort and record raw usability observations.

Activate voice, sandbox payment, agents, or a channel one at a time only after the provider key, callback signature, quota, cost owner, delivery evidence, consent wording, and rollback procedure have been verified. Enable external execution only after an evidence-backed provider, authorized connector, action allow-list, operator owner, and execution evidence policy exist. Never activate regulated escrow or real settlement without the relevant commercial and legal approval.

## Exact shutdown procedure

For a data-exposure, financial-integrity, false-fulfilment, emergency-notification, runaway-cost, or provider-impersonation incident, immediately set voice, agent, external execution, and payment capabilities to their disabled values; remove outbound channel credentials; stop inviting users; preserve logs and the database backup; and notify the incident owner. Keep the site available only if it can show an accurate unavailable state. Otherwise stop the application through the deployment platform and follow the operator incident plan.

## Remaining dependencies and decisions

| Capability | Remaining requirement |
|---|---|
| Real provider discovery and quote | Evidence-backed provider onboarding, capabilities, service areas, availability, quote, and fulfilment operations. |
| Stripe collection | Server key, webhook secret, HTTPS endpoint, sandbox certification, reconciliation owner, refund/chargeback policy, and currency/amount approval. |
| Regulated escrow and payout | Approved custody/settlement provider, KYC/AML, merchant/settlement model, commercial contract, and finance operations. |
| Voice | Gemini Live key, quota, billing, consent, microphone/browser testing, and cost monitoring. |
| WhatsApp, Telegram, SMS, USSD, email, FCM | Account verification, credentials, webhook/callback, receipts, retry, opt-out, rate limits, monitoring, and operational owner. |
| Emergency coordination | Explicit emergency disclaimer, consent, delivery provider, receipt evidence, escalation rota, and safeguarding policy. |
| Provider verification | Authoritative verifier or trained human-review evidence process with expiry, suspension, appeal, and audit. |
| Legal/compliance | Privacy notice, terms, UK GDPR/GDPR and NDPR review where applicable, processor contracts, retention/deletion policy, KYC/AML, advertising, communications consent, safeguarding, and transfer decisions. |
| Scale | PostgreSQL, Redis/distributed rate limiting, durable queue, object storage, and multi-instance coordination only when measured pilot load requires them. |

## P0–P3 findings

| Severity | Finding | State |
|---|---|---|
| P0 | Production could previously start with fallback security secrets. | Fixed; startup now fails closed. |
| P0 | Payment, escrow, emergency delivery, and fulfilment require authoritative external evidence. | Safely fail-closed; external activation required. |
| P0 | Cross-user ownership and request-lifecycle boundaries. | Passing tested contracts; continue monitoring. |
| P1 | External execution lacked a deployment kill switch. | Fixed; disabled by default. |
| P1 | Self-referral could bypass the HTTP guard through a direct service call. | Fixed; service-level guard and regression added. |
| P1 | Provider verification, real channels, KYC, and regulated settlement remain operational dependencies. | Documented; not falsely activated. |
| P1 | Human cohort usability and latency have not been measured. | Deferred until controlled testers are recruited. |
| P2 | Offline queueing, throttled-network behaviour, and multi-tab concurrency need device/cohort observation. | Deferred pilot observation. |
| P3 | Cosmetic polish and scale infrastructure. | Deferred. |

## Security, cost, recovery, and observability

The security suites passed ownership, route authorization, DOM safety, QR tamper/expiry, webhook signature/replay, connector authorization, evidence, and secret-scan contracts. The primary remaining security responsibility is deployment: managed secrets, HTTPS, WAF/IP rate limiting, log access control, backups, and incident response.

Cost exposure is bounded by AI quotas, voice session/idle/concurrency/rate limits, agent action/retry/concurrency/cooldown limits, attachment limits, authentication boundaries, and fail-closed external adapters. Anonymous attackers could still create infrastructure and provider costs if the pilot is exposed broadly without deployment-level rate limiting, so the pilot must remain invitation-controlled.

The application exposes basic health and heartbeat signals, persistent worker errors, webhook failure paths, and internal notification queues. External uptime, log aggregation, database backup monitoring, provider dashboards, payment reconciliation, delivery receipts, quota alerts, and on-call escalation remain deployment responsibilities.

The low-cost recovery posture is one persistent SQL.js/SQLite file, daily encrypted backups, a pre-release snapshot, a tested restore, single-writer operation, and a rollback artifact. Multi-instance deployment is deferred until measured need.

## Human pilot protocol

No human results are fabricated. Recruit 5–10 invited adults, assign separate accounts, and ask each to start naturally, submit a request, authenticate, reload, close and return, use a reminder, inspect memory, log out, and return. Offer voice and QR only when the corresponding evaluation profile is active. Record confusion, dead ends, misleading language, latency, browser/device, network quality, authentication problems, request problems, navigation problems, and any mismatch between user expectation and authoritative state.

## Final decision

Kurukoo is **CONTROLLED PILOT READY** for a narrow, supervised, Web Chat-first pilot. It is **not PUBLIC LAUNCH READY** because real providers, production payment/escrow, external execution, channels, emergency delivery, verification operations, compliance decisions, human usability evidence, and production monitoring are not yet connected or approved.
