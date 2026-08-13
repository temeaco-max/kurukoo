# PR #31 Convergence Completion Report

**Branch:** `integration/main-convergence-audit`
**Integration target:** `integration/near-completion`
**Merge policy:** This work is prepared for PR #31 only. It must **not** be merged directly into `main`.

## Delivered convergence work

This pass completed the canonical communications and affiliate-commercial boundaries without creating parallel provider, payment, request, coordination, notification, task, or memory systems. The implementation preserves the Economic Request architecture and makes unavailable integrations visible as unavailable rather than fabricating action or outcome.

| Area | Delivered evidence | Operational boundary retained |
|---|---|---|
| Communications | Added the `communication_deliveries` ledger and idempotent `channel_inbound_events`; SMS, Telegram, WhatsApp, and internal notifications now use explicit stateful results. WhatsApp validates signed raw-body webhooks, provides Meta callback verification, deduplicates inbound events, and correlates provider status receipts. | `accepted`, `submitted`, and `sent` are not represented as `delivered`; channels without their full configured prerequisites report `not_configured`; USSD does not claim dispatch or emergency action. |
| Internal notifications | Internal notifications create canonical delivery records, remain queued internally until read, and are exposed through the existing authenticated notification route and chat inspector. | An in-app record is not an external push, SMS, WhatsApp, or emergency-contact delivery claim. FCM remains explicitly unconfigured. |
| Channel readiness | Channel configuration now checks the prerequisites required to make its operational claim, rather than only send credentials. | WhatsApp requires send, webhook, signature, and receipt prerequisites; SMS requires Africa’s Talking sending and delivery-report configuration; USSD requires its controlled activation prerequisites. |
| Affiliate referrals | Added evidence-gated merchant, offer, click, and conversion authorities; active offers carry disclosure, clicks retain one-way hashed identity attribution, and conversion references are idempotent. The existing protected Saved & offers workspace now reads the canonical offer API and follows canonical visit routes. | Affiliates are external merchants, not Kurukoo providers. Offers do not prove inventory, availability, a quote, payment, fulfilment, a payout, or provider verification. |
| Commercial metrics | Replaced inferred administrative revenue calculations with canonical evidence-only metrics for verified customer collection records, internal escrow ledger state, subscriptions, Points lead activity, advertising configuration, and affiliate evidence. Administrative marketing now leaves unmeasured engagement unavailable. | Plan labels, Points debits, ad budgets, affiliate clicks, and internal escrow rows are not fiat revenue, settlement, payout, regulated custody, or advertising billing evidence. |
| Client truthfulness | The existing affiliate-card renderer no longer falls back to a fabricated merchant, price, image, or destination. Affiliate actions require the canonical attributed `visitUrl`. The chat inspector explains notification delivery states precisely. | No default external merchant action is taken; no state is silently promoted to external delivery. |

## Canonical journey evidence

| Journey | Regression evidence | Confirmed result |
|---|---|---|
| Customer to provider coordination | `npm run test:provider-coordination` and `npm run test:economic-lifecycle` | Evidence-verified provider invitation, provider-owned quote, customer acceptance, handoff, deferred re-match, and internal-only notification behavior work without fabricated payment, dispatch, or fulfilment. |
| Payment and escrow boundary | `npm run test:stripe-payment`, `npm run test:economic-lifecycle`, and the full route suite | Stripe execution is configured-only, webhook verification is signature and replay-window guarded, and escrow/Points controls remain canonical. |
| Provider Go Live and Radar | `npm run test:presence-routes` and `npm run test:discovery-routes` | Valid real location is required; no fallback coordinates are created; nearby projections remain privacy-safe and truthfully unavailable where sources do not exist. |
| Contributor task lifecycle | `npm run test:contributor-lifecycle` | Owner-scoped task acceptance and evidence, administrator review, and idempotent Points awards are preserved. |
| Affiliate referral loop | `npm run test:affiliate-lifecycle` | Merchant and offer evidence gates, disclosure, hashed attributed click, conversion idempotency, no Points conflation, and evidence-only commercial projections pass. |
| Communications boundary | `npm run test:communications-boundary`, `npm run test:notification-queue`, `npm run test:email`, and `npm run test:channel-usage` | Receipt-backed state handling, webhook idempotency, no false external delivery, and non-fiat usage accounting pass. |

## Validation gate

The following complete gate passed after implementation:

```text
npm run lint
npm run build
npm run audit:security
npm run audit:services
npm run test:routes
npm run test:chat-dom-safety
npm run secrets:staged
npm run audit:css
```

The built `dist` application was also started locally. `/chat` rendered in guest mode with the existing inspector and no runtime error. `/saved` redirected an unauthenticated session to the existing sign-in route, preserving the protected affiliate-offer boundary. The details are recorded in [`RUNTIME_VERIFICATION_NOTES.md`](./RUNTIME_VERIFICATION_NOTES.md).

## Remaining external prerequisites

The platform deliberately does **not** claim these are active. They require external onboarding, contracts, credentials, compliance review, and live receipt evidence.

| Capability | Required external prerequisite |
|---|---|
| WhatsApp | WhatsApp Business account, approved templates where required, Meta-app webhook verification, production send credentials, consent policy, and incoming delivery/read receipts. |
| SMS and USSD | Africa’s Talking production account, approved sender/service configuration, delivery-report webhook, controlled USSD service code, legal and carrier compliance. |
| Push | A configured FCM delivery adapter, secure device-token lifecycle, consent policy, and delivery/engagement evidence. |
| Payments, settlement, and escrow custody | Live PSP account and webhook, reconciliation, settlement, payout controls, required licences/compliance, and a regulated custody model where applicable. |
| Provider verification and KYC | Verified regional identity/KYC providers, policy, review operations, and evidence retention controls. |
| Affiliate commerce | Signed merchant agreement, current offer and destination approval, customer disclosure/consent policy, conversion feed, commission confirmation, settlement evidence, and dispute process. |
| Advertising billing and measurement | Approved inventory contract, billing/settlement system, measurement authority for impressions/clicks, and privacy/consent controls. |

## Files and ownership boundaries

The primary canonical additions are `src/services/communicationDelivery.ts`, `src/services/affiliateService.ts`, `src/services/commercialMetrics.ts`, and their route/persistence integrations. The small client projections only consume those existing APIs. No new Economic Request lifecycle, provider engine, payment engine, escrow engine, agent runtime, contributor system, or legacy route boundary was created.

Future work should avoid reintroducing fabricated client cards, default merchant destinations, inferred revenue, zero-coordinate presence, unsupported external delivery claims, or direct client authority over providers, payments, escrow, or request state.
