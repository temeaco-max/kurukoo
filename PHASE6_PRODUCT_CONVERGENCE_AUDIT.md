# Phase 6 Product Convergence Audit

**Date:** 12 August 2026  
**Branch audited:** `feat/frontend-product-convergence`  
**Baseline:** local `main` at `ba2d49f`; convergence target currently exists as `origin/integration/near-completion` at `0bb5255`.

## Executive conclusion

Kurukoo is most coherent when treated as a **conversation-first fulfilment network** rather than a directory, a collection of vertical mini-products, or a dashboard-led SaaS application. The implementation has a viable canonical backbone: a persistent profile identity, a shared conversation boundary, declarative skills, Economic Requests, explicit provider/execution boundaries, and a truthfulness-first public surface.

The Phase 6 and 7 audit found that the highest-value missing native-assistance capability was not another category flow. It was **personal continuity**: a user should be able to ask the conversation to remember a future action, while safety check-ins should be represented accurately without pretending that an external contact was reached. The selected implementation therefore added conversation-native reminders and personal safety-contact/check-in records using the existing profile, message, authentication, and background-worker boundaries. It deliberately did not create a new wallet, identity, notification system, provider lifecycle, dashboard application, or emergency-dispatch claim.

> **Convergence decision:** Native assistance belongs inside the same conversation and profile as fulfilment. A reminder is not an Economic Request, a lead, a payment action, or a provider request. Discovery and management of these capabilities must reside within the primary conversational interface.

## Product capability map

| Capability class | Canonical implementation boundary | Current status | Truthful product boundary |
|---|---|---:|---|
| **Conversation and identity** | `src/routes/chatRouter.ts`, `src/routes/authRoutes.ts`, `src/services/chatConversationService.ts`, `memory_profiles` | Implemented | Guests can express intent; a persistent or protected action requires the existing authenticated phone-based session. |
| **Native reminders** | `src/services/reminderService.ts`, `src/routes/reminderRoutes.ts`, `src/services/intentRouter.ts`, `src/services/backgroundWorkers.ts` | **Implemented in Phase 6 & 7** | An authenticated user can create, list, cancel, and receive a conversation-recorded reminder. Push is queued rather than described as delivered when FCM is unconfigured. Supports absolute and relative time parsing. |
| **Personal safety contacts and check-ins** | `src/services/safetyService.ts`, `src/routes/safetyRoutes.ts`, `src/services/backgroundWorkers.ts` | **Implemented in Phase 6 & 7** | Contacts and timed check-ins are owner-scoped. Supports explicit consent activation. An expired check-in becomes `escalation_pending`; Kurukoo does not claim that a contact or emergency service was reached without a configured, authorised delivery provider. |
| **Matching and fulfilment** | `src/services/skillFlows.ts`, `src/services/find-worker.ts`, `src/services/agenticStorefront.ts`, Economic Request routes | Implemented with guarded boundaries | Provider matching, quote review, payment evidence, fulfilment evidence, disputes, and completion remain distinct lifecycle steps. |
| **Known seller and delivery coordination** | `economic_offers`, `economic_participants`, `src/services/economicParticipants.ts` | Implemented | Seller availability, listed prices, and participant evidence remain declared data. They are not stock confirmation, tracking, or multi-party settlement. |
| **External execution** | `src/services/executionConnector.ts`, `provider_execution_connectors`, `execution_requests` | Implemented boundary; external adapters not configured | Connectors require explicit authorisation and idempotency. No named external provider, PSP, hardware platform, or fleet integration is claimed. |
| **Payments, escrow, and disputes** | `src/services/escrow.ts`, `src/services/disputeResolution.ts`, `src/routes/trustRoutes.ts` | Lifecycle controls implemented; real PSP absent | A local ledger is not proof that money is held. Release requires verified payment evidence, and a dispute freezes eligible escrow during the cooling-off period. |
| **Public discovery and support** | `src/routes/publicRoutes.ts`, `views/*`, `content/explore/categories.json` | Implemented with Phase 5 truthfulness corrections | Web Chat is the active public channel. Pages communicate conditional request paths rather than fabricated availability, verification, app-store, payment, or hardware-control claims. |

## Canonical architecture

```text
Conversation entry (guest or authenticated)
        ↓
Canonical intent router
        ├── Native assistance
        │     ├── reminders → shared messages + optional configured push
        │     └── safety contacts/check-ins → explicit pending escalation state
        │
        └── Network fulfilment
              ↓
       skills + skill_flows
              ↓
       Economic Request
              ↓
 provider discovery / quote / verified payment evidence
              ↓
 execution or fulfilment evidence / dispute / completion
```

The map preserves the five non-negotiable shared layers identified in the blueprint: one profile identity, one conversation, one presence source, one bounded Points/economic model, and one proactive-information surface. Reminders and safety check-ins participate in the profile and conversation layers but do **not** enter the Economic Request lifecycle.

## Phase 6 implementation and corrective findings

The active `feat/kurukoo-blueprint-convergence` pull request already contained a reminder and personal-safety implementation. Rather than recreate that subsystem, the work adopted only its native-assistance commits into the current convergence branch and deliberately excluded its overlapping authentication and public-copy commits, which would have duplicated Phase 5 work.

The adoption audit found two boundary defects that were corrected before validation.

| Finding | Risk | Correction | Regression evidence |
|---|---|---|---|
| `reminderRoutes` and `safetyRoutes` used `router.use(authenticateUser)` while mounted at `/api`. | The middleware intercepted unrelated `/api/*` paths, including the retired chat-auth path, and violated explicit route ownership. | Authentication is now attached to each declared reminder and safety endpoint only. | `test:conversation-first-auth` again receives the expected `404` for the legacy chat-auth endpoint; native route tests confirm authenticated access. |
| Any non-general chat skill entered the generic `finalizeOrder(..., 'lead')` path. | An authenticated reminder could create an economic lead/order, violating the native-assistance/economic-lifecycle separation. | The reminder card type remains in the shared conversation but bypasses `finalizeOrder`. | `test:native-assistance` asserts that a chat-created reminder persists to the owner profile and creates no lead order. |
| Guest reminder intent reached `routeIntent` with a temporary anonymous phone. | A guest could create persistent reminder data before identity was established. | Reminder persistence now requires a non-anonymous authenticated profile; the guest flow returns the existing chat auth gate without a reminder row. | `test:native-assistance` asserts no `anon_%` reminder row exists after a guest request. |

The canonical chat client now renders a safe, inline reminder confirmation card and provides a unified management surface in the context inspector (right sidebar). Dynamic fields are inserted with DOM node text content. The cards state the essential commercial boundary: personal reminders and safety check-ins do not create provider requests or payment steps.

## Route and data ownership

| Surface | Canonical route/API | Authentication | Owner isolation | Notes |
|---|---|---|---|---|
| List reminders | `GET /api/reminders` | Required | Session phone only | Supports optional completed-history query. |
| Create reminder | `POST /api/reminders` | Required | Session phone only | Validates non-empty title and future due time. |
| Cancel reminder | `POST /api/reminders/:id/cancel` | Required | `id` and session phone | Cannot cancel another user’s reminder. |
| List safety contacts | `GET /api/safety/contacts` | Required | Session phone only | Excludes revoked records. |
| Add safety contact | `POST /api/safety/contacts` | Required | Session phone only | Defaults to pending status. |
| Activate contact | `POST /api/safety/contacts/:id/activate` | Required | `id` and session phone | Requires explicit `consentConfirmed: true`. |
| Revoke safety contact | `POST /api/safety/contacts/:id/revoke` | Required | `id` and session phone | Cannot revoke another user’s contact. |
| List check-ins | `GET /api/safety/check-ins` | Required | Session phone only | Returns all check-ins for the session user. |
| Start/complete check-in | `POST /api/safety/check-ins`, `POST /api/safety/check-ins/:id/complete` | Required | Contact/check-in owner only | Expiry remains a pending escalation until an actual delivery integration is configured. |

## Duplication and legacy assessment

The audit found no need for a new native-assistance identity, message table, worker framework, notification transport, or lifecycle. The existing background worker, `messages` table, JWT middleware, and profile phone key are the appropriate integration points.

The following areas remain deliberately **unmodified** because changing them would require a dedicated convergence plan rather than opportunistic duplication:

| Area | Audit observation | Required future approach |
|---|---|---|
| `public/js/app.js` and `public/dashboard.html` | The legacy/parallel dashboard client has been removed. The Request Hub (`/web`) now uses `kurukoo-hub.css` and secure DOM node creation for rendering active requests, reminders, and safety contacts. | Cleanup complete. |
| `src/services/iotBridge.ts` and device UI prototypes | They are future integration stubs, not a controlled device execution boundary. | Keep hardware control out of public claims until a shared authorised connector, identity, audit, and evidence design exists. |
| Payments, escrow, external provider verification, and FCM delivery | The architecture fails closed but production adapters are not configured. | Add credentialed, contract-reviewed adapters with receipt/evidence semantics; do not simulate success. |
| AI-agent/provider representation | First-class AI agents have a separate operational model; mirrored provider records are descriptive `software_service` entities. | Preserve skills as the capability source of truth and do not create a second agent/provider lifecycle. |

## Validation record

| Validation | Result |
|---|---|
| `npm run lint` | Passed. |
| `npm run test:native-assistance` | Passed. Covers future-time validation, reminder delivery idempotency, queued unconfigured push state, owner isolation, guest authentication gating, and fail-closed safety escalation. |
| `npm run test:conversation-first-auth` | Passed. Confirms guest continuity, contextual hub protection, logout, and absence of chat-owned auth routes. |
| `npm run test:economic-lifecycle` | Passed. Confirms deferred-match, quote, escrow/Points, and SMS identity boundaries remain unchanged. |
| `npm run test:routes` | Passed. Includes composition, public runtime, provider entities, multi-party coordination, execution boundary, dispute lifecycle, native assistance, and economic lifecycle contracts. |
| `npm run audit:security`, `audit:services`, `audit:skills`, `audit:messaging` | Passed. The service audit reports documented category/default skill-flow fallback as a warning, not a validation failure. |
| `npm run test:chat-dom-safety` and `npm run build` | Passed. |
| Browser validation | Passed on rebuilt local runtime. A fresh guest reminder request showed the canonical sign-in gate and created no anonymous reminder. After local OTP sign-in, the same request rendered an inline **Reminder saved** card and stated that it does not create a provider request or payment step. |

## Git reconciliation position

The local branch contains Phase 5 changes plus the native-assistance subset of the active blueprint-convergence work. It does not import that pull request’s overlapping login and public-copy commits, because those changes were already present in the current branch and would create unnecessary conflict.

The repository currently has many open, chained pull requests. `main` is locally one commit ahead of `origin/main`, while `integration/near-completion` contains the legacy-boundary convergence history. The correct next integration action is a **reviewed pull request from this branch**, with an explicit comparison against the current intended integration target. No direct merge to `main` was performed.

## Remaining roadmap

The next work should follow the ordering below rather than expanding into unrelated vertical features.

| Priority | Work | Definition of done |
|---|---|---|
| **P0** | Complete production payment, provider assurance, and delivery adapters. | Production claims require observable evidence, time-bounded consent operations, and recorded delivery or settlement results. |
| **P0** | Owner-side credential rotation and reviewed secret-governance controls. | Historical credential exposure is remediated outside source code; the primary branch requires reviewed passing checks. |
| **P1** | Make reminder management discoverable in the existing authenticated conversation drawer or a small profile panel. | A user can review and cancel reminders without a parallel dashboard; all actions call the existing `/api/reminders` routes. |
| **P1** | Add deliberate safety contact activation/consent and an authorised delivery adapter. | Safety status reflects real consent and delivery evidence; `escalation_pending` is never presented as a completed escalation. |
| **P1** | Expand conversational scheduling parsing. | Locale-aware absolute date/time, recurrence, appointment follow-ups, and clarification prompts are added to the same `reminderService`, with timezone and ambiguity tests. |
| **P1** | Resolve duplicate dashboard architecture through an explicit migration decision. | The legacy client is either proven active and converged on canonical cookie/session APIs or safely removed with runtime coverage. |
| **P2** | Introduce PostgreSQL, Redis, queues, and object storage only at documented scale/reliability thresholds. | The single-instance SQL.js launch path is not destabilised by speculative infrastructure. |

## References

[1]: ./BLUEPRINT.md "Kurukoo Blueprint"
[2]: ./BUILD_STATUS.md "Current Build Status"
[3]: ./SECURITY_AUDIT_STATUS.md "Security Audit Status"
[4]: ./src/routes/chatRouter.ts "Canonical chat route"
[5]: ./src/services/reminderService.ts "Conversation-native reminder service"
[6]: ./src/services/safetyService.ts "Personal safety contact and check-in service"
[7]: ./scripts/test-native-assistance.ts "Native assistance regression"
[8]: ./public/js/kurukoo-primary-chat.js "Canonical Web Chat client"
