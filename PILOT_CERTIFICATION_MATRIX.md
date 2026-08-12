# Kurukoo Controlled Real-World Pilot Certification Matrix

**Certification target:** controlled pilot, not unrestricted public launch.  
**Branch:** `integration/main-convergence-audit`  
**Baseline:** `b6eecd4`  
**Certification build:** current working tree after pilot-hardening fixes  
**PR vehicle:** [#31](https://github.com/temeaco-max/kurukoo/pull/31)

> This matrix distinguishes repository evidence from external configuration, provider contracts, legal decisions, and human operations. No production payment, real provider dispatch, real channel delivery, or human-test result is claimed here.

## Classification key

| Classification | Meaning |
|---|---|
| **PASS** | Verified in repository tests or fresh local runtime without an external dependency. |
| **PASS WITH EXTERNAL DEPENDENCY** | The repository boundary is implemented and truthful, but real operation requires a configured provider, credential, contract, or operator. |
| **FAIL — REPOSITORY BUG** | A repository defect was discovered and fixed during this certification pass. |
| **FAIL — CONFIGURATION** | Safe operation depends on deployment configuration that is currently absent or intentionally disabled. |
| **FAIL — EXTERNAL PROVIDER** | The repository boundary exists, but the external provider or callback contract is not connected. |
| **FAIL — PRODUCT DECISION REQUIRED** | The implementation is not unsafe, but pilot policy must be chosen before activation. |
| **DEFERRED** | Not required for a controlled pilot or requires scale, legal, or commercial work beyond this pass. |

## Certification matrix

| Scenario | Result | Evidence and current state | Failure, impact, and remaining action | Severity |
|---|---|---|---|---|
| Clean homepage to first chat | PASS | Fresh compiled runtime returned the homepage and mobile/desktop screenshots showed usable primary actions. | None. | P3 |
| Guest natural-language request | PASS | Conversation-first auth, FastText/router, chat stream, and Economic Request tests passed. | None. | P2 |
| Clarification of ambiguous language | PASS | Intent router remains authoritative and rule fallback does not force an economic flow when clarification is needed. | Continue human observation during pilot. | P2 |
| Progressive name → phone → OTP | PASS | `test:conversation-first-auth`, auth-entry, QR migration, and route contracts passed. | Real SMS/WhatsApp OTP delivery requires configuration. | P1 external dependency |
| Guest abandonment and return | PASS WITH EXTERNAL DEPENDENCY | Guest cookies, conversation persistence, migration, and reload contracts exist. | Browser storage, cookie policy, and domain HTTPS must be verified on the pilot domain. | P1 configuration |
| Authenticated continuation after migration | PASS | QR/OTP migration retains the canonical conversation and message context. | None in repository. | P1 |
| Logout and safe new guest start | PASS WITH EXTERNAL DEPENDENCY | Auth boundaries and guest session path are implemented. | Human pilot must verify the exact logout wording and browser-cookie behaviour on the deployed domain. | P2 |
| Multiple conversations and refresh | PASS WITH EXTERNAL DEPENDENCY | Conversation workspace and ownership route suites passed. | Two-browser and stale-tab concurrency should be observed by pilot operators. | P2 |
| User-to-user request isolation | PASS | Security and route contracts enforce ownership-scoped access. | None found in tested paths. | P0 |
| Realistic repair, transport, food, product, service, and reminder requests | PASS | 46 categories, 204 seeded skills, canonical parity, FastText/router, and lifecycle tests passed. | Live provider matches are unavailable without evidence-backed provider data. | P1 external dependency |
| Request changes and cancellation language | PASS WITH EXTERNAL DEPENDENCY | Canonical lifecycle and transition guards exist. | Human operators must define cancellation/refund policy for paid requests. | P1 product decision |
| Canonical Economic Request convergence | PASS | Economic request audit verified one lifecycle across 46 categories and 204 skills. | None. | P0 |
| Discovery with no eligible provider | PASS | Discovery and deferred rematch tests do not fabricate a quote or availability. | Real provider supply must be onboarded. | P1 external dependency |
| Provider profile alone treated as verified | PASS | Evidence-gated provider verification, discovery projection, execution boundary, and provider-entity suites passed. | None. | P0 |
| Pending, expired, failed, and suspended provider states | PASS | Provider-verification lifecycle and expiry tests passed. | Operator evidence review remains required. | P1 human operation |
| Provider capability and service area | PASS WITH EXTERNAL DEPENDENCY | Provider entities and active capability checks exist. | Provider onboarding, service-area declaration, and verification evidence process are not externally connected. | P1 external dependency |
| Quote and availability truthfulness | PASS WITH EXTERNAL DEPENDENCY | Fallback copy and storefront boundaries no longer claim unverified provider, price, or availability. | Real quote and availability adapters must be connected. | P0 external dependency |
| Payment disabled without Stripe | PASS | Stripe contract is configured-only, webhook-signed, replay-windowed, and fail-closed. Live health reports sandbox with economic payments disabled. | Configure Stripe secrets, HTTPS webhook, currency/amount policy, and reconciliation owner. | P0 configuration |
| Payment success, failure, cancellation, duplicate, replay, wrong amount, wrong currency, wrong user | PASS WITH EXTERNAL DEPENDENCY | Adapter and webhook contract tests cover signature and replay boundaries. | Sandbox end-to-end Stripe test remains required before any pilot collection. | P0 external dependency |
| Escrow and payment evidence | PASS WITH EXTERNAL DEPENDENCY | Escrow/trust/dispute suites require authoritative payment evidence. | Regulated custody/settlement model and commercial provider agreement are absent. | P0 legal/external dependency |
| Fulfilment versus ready-for-fulfilment | PASS | Execution evidence and lifecycle boundaries distinguish acknowledged/failed/succeeded; no external connector means no fulfilment claim. | Authorize only a reviewed connector and document evidence ownership. | P0 external dependency |
| External execution disabled by deployment policy | FAIL — REPOSITORY BUG, FIXED | Added `KURUKOO_EXTERNAL_EXECUTION_ENABLED=false` default and regression assertion. | Operators must explicitly enable it only with an authorized connector. | P1 fixed |
| Dummy execution connector | PASS | Existing isolated execution-boundary fixture enables the dummy connector explicitly and verifies idempotency/evidence. | Never enable the dummy connector for real users. | P1 |
| Autonomous agent disabled by default | PASS | Agent runtime reports disabled and regression covers ownership, bounded tools, cancellation, cooldown, retries, and high-risk denial. | Controlled agent pilot requires explicit enablement and operator monitoring. | P1 configuration |
| Agent attached to existing request | PASS | Voice/chat agent continuity and runtime tests use a shared bounded goal linked to the canonical request. | No agent objective should be activated for anonymous users or unsupported skills. | P0 |
| Voice to text and text to voice continuity | PASS WITH EXTERNAL DEPENDENCY | Voice integration contract verifies ephemeral sessions, shared conversation identity, restricted tools, and transcript path. | Gemini key, quota, HTTPS, browser microphone permissions, and usage monitoring required. | P1 external dependency |
| Voice interruption, silence, timeout, quota, and provider outage | PASS WITH EXTERNAL DEPENDENCY | Session and cost controls exist; provider-unavailable path remains bounded. | Requires real Gemini Live sandbox testing and operator quota alerts. | P1 external dependency |
| QR referral, contributor, offer, product, location, and channel contexts | PASS WITH EXTERNAL DEPENDENCY | Signed opaque QR context, bounded metadata, safe `/start`, idempotent activation, and channel truthfulness passed. | Printed QR deployment, entity records, and attribution policy remain operational work. | P1 external dependency |
| QR tamper, expiry, replay, duplicate scan, malicious parameters | PASS | QR regression covers signature, expiry, bounded parsing, idempotency, and no scan-time request/Points creation. | None found. | P0 |
| Referral attribution and Points qualification | PASS | Existing QR/referral/Points engines remain the authority; rewards require the qualifying event. | Fraud thresholds, account/device policy, and dispute policy require business decisions. | P1 product decision |
| Self-referral abuse | FAIL — REPOSITORY BUG, FIXED | Added service-level self-referral rejection and regression coverage in the canonical QR test. | Add external fraud monitoring only if pilot volume warrants it. | P1 fixed |
| Reminders create/edit/snooze/complete/delete | PASS WITH EXTERNAL DEPENDENCY | Native assistance, reminder routes, worker composition, and persistence paths passed. | Timezone and missed-reminder behaviour require human pilot observation. | P2 |
| Living Memory persistence, retrieval, deletion, disablement | PASS WITH EXTERNAL DEPENDENCY | Memory profile, ownership, access-log, export/delete, and encryption paths exist. | Legal retention, export format, and user-facing consent policy require review. | P1 legal/operations |
| Safety contact activation | PASS | Owner consent is required and the response explicitly says no contact notification has been sent. | External notification delivery and emergency policy are not configured. | P0 external dependency |
| Emergency guidance and check-in | PASS WITH EXTERNAL DEPENDENCY | Safety routes persist owner-scoped check-ins and explicitly disclaim replacement of emergency services. | Emergency service, SMS/voice delivery, consent, and escalation operations required. | P0 external dependency |
| Channel state truthfulness | PASS | Unconfigured adapters report unavailable/not connected; notification queue retains internal delivery without claiming FCM delivery. | WhatsApp, Telegram, SMS, USSD, email, and FCM contracts remain to be activated individually. | P1 external dependency |
| Cross-user data access | PASS | Ownership-scoped route, trust, agent, notification, memory, and conversation tests passed. | None found in tested boundaries. | P0 |
| Sensitive log review | FAIL — REPOSITORY BUG, FIXED | Redacted OTP, safety-circle, money-circle, and deletion logs; production secret boundary added. | Continue log review after each new integration. | P1 fixed |
| Production secret fallback | FAIL — REPOSITORY BUG, FIXED | Production startup now fails closed without `JWT_SECRET` and `MEMORY_ENCRYPTION_KEY` of at least 32 characters. | Deploy owner must provide high-entropy secrets through the secret manager. | P0 fixed |
| Poor connectivity and browser refresh | PASS WITH EXTERNAL DEPENDENCY | PWA shell/service worker and canonical persistence exist; public runtime returned correctly after refresh. | Real throttled-network and offline queue behaviour require device testing. | P2 |
| Server and worker restart | PASS WITH EXTERNAL DEPENDENCY | Workers are composable and bounded; persistent SQL.js/SQLite state is used. | Operator must implement backup/restore and restart runbook. | P1 operations |
| Anonymous cost abuse | PASS WITH EXTERNAL DEPENDENCY | Voice session, agent action, AI quota, attachment, authentication, and payment boundaries are bounded. | Add deployment-level IP/WAF/rate controls before inviting uncontrolled traffic. | P1 operations |
| Operator/admin readiness | PASS WITH EXTERNAL DEPENDENCY | Admin verification, route contracts, health, agent inspector, trust, dispute, and request inspection surfaces exist. | Human operator, escalation rota, and evidence review process are still required. | P1 human operation |
| Human tester run with 5–10 people | DEFERRED | A controlled-human protocol is prepared but no human results are fabricated in this certification. | Recruit 5–10 testers and record confusion, dead ends, latency, and misleading language. | P1 operations |

## Fixed defects in this certification pass

The pass identified four repository-solvable issues. Production startup previously substituted a known JWT fallback and allowed the memory encryption service to use its built-in fallback; production now fails closed when either secret is absent or too short. Standard logs previously included phone numbers, peer lists, or transaction amounts in OTP, safety-circle, money-circle, and deletion paths; those logs now report operational state without personal or financial data. External execution previously had no deployment kill switch; it now defaults to disabled and the controlled regression fixture enables it explicitly. Finally, the referral service now rejects self-referral even when called outside the current HTTP guard.

## Pilot blockers that are not repository bugs

The controlled pilot must keep production payment collection, regulated escrow, external execution, real provider matching, outbound channels, emergency notification, and autonomous follow-up disabled until the corresponding credentials, callbacks, commercial agreements, evidence processes, and human ownership are complete. A pilot can safely begin with Web Chat, deterministic intent fallback, guest/progressive authentication, internal notifications, reminders, memory controls, QR contextual entry, sandbox-only payment boundary tests, and operator-supervised request inspection.

## Human-test protocol status

No real human cohort was available in this environment. The exact protocol is documented in `PILOT_OPERATING_GUIDE.md`; the certification result therefore does not claim human usability or real-world latency results.
