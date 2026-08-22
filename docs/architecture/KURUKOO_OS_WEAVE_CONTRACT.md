# Kurukoo OS — Weave Contract

This document is a continuation safeguard: no implementation should treat a new feature as isolated when it participates in an existing Kurukoo outcome, revenue path, channel, memory context, evidence boundary or client surface.

## Canonical flow

User/channel → canonical Chat or Discover → conversation act / AI routing → Skill + Instructions + Memory Profile → Capability Registry / Execution Contract → Economic Request, Agent Goal, Reminder or Safety lifecycle → provider/tool/channel execution → evidence → notification/continuation → commercial ledger where applicable.

## Cross-domain weave

| Capability | Must connect to | Canonical authority |
|---|---|---|
| Outcome Context | Economic Request, dispatch, provider communication, Points, journey events, notifications, web/mobile/Chat | `outcomeContextService`, `platformJourneyWeaver` |
| Discover | Topics, Providers, Products, Offers, Opportunities, Agent Network, Ad Manager, Chat, Watch | `discoverExperience`, `discoverCommercialComposition`, `discoveryNetwork` |
| Products | Provider/business/WhatsApp/store/affiliate sources, Discover, Chat cards, Economic Requests | `catalogueSourceRegistry`, `catalogueInventoryMatcher` |
| Provider lead | Economic Request match, provider subscription, Points, Commercial Ledger, provider notification | `economicDispatchCoordinator`, `orderFinalizer`, `pointsEngine`, `commercialLedger` |
| POS/agent top-up | Agent identity, verified payment evidence, Points, commission, Commercial Ledger, Discover | `agentNetworkCommerce`, `stripe*webhook`, `pointsEngine` |
| Provider communication | Economic Request, WebRTC messaging/voice/location, Trickbridge, notification, masked-PSTN fallback | `providerCommunicationService` |
| Ride/delivery dispatch | vehicle choice or any-vehicle option, broadcast, provider acceptance/lead charge, arrived, live location, pickup/drop-off, completion, review, next availability | `rideDispatchContract`, `economicDispatchCoordinator`, `serviceReviewService` |
| AI | FastText/rules, SmolLM2, Mistral/Gemini/Groq/OpenRouter capacity, health, free/included allowance, PAYG policy, quotas, budgets, telemetry | `aiInferencePolicy`, `unifiedAiEngine` |
| Channels | Web/mobile/WhatsApp/Telegram/SMS/USSD/voice/QR → canonical conversation; no channel-specific business lifecycle | channel adapters + canonical Chat |
| Artifacts | Chat/voice/reports/receipts, Google Drive `drive.file`, managed fallback, Connect, web/mobile workspace | `artifactService`, `artifactRoutes`, `artifactDriveEnhancer` |
| QR | signed context → server activation → conversation/context continuation | `qrContextService`, `qrRouter` |
| Mobile offline | Chat/task mutations → local durable queue → idempotent replay → canonical API | `mobile/kurukoo-mobile/lib/offline-queue.ts` |
| Mobile haptics | send/refresh/task transitions/selection/success/error | `mobile/kurukoo-mobile/lib/haptics.ts` |
| Public acquisition | Home, Explore, Earn, How it works, Network, Channels, Pricing, Help, About, Careers, Legal → onboarding/conversion | public routes/views |
| Admin | provider health, AI telemetry, credentials, agent budgets, ads, disputes, moderation, integration status | Admin Control Room |

## Ride / delivery communication lifecycle

A ride or delivery is one Economic Request and one request-scoped Provider Communication Session:

1. Capture pickup, destination, timing and optional vehicle preference (`bike`, `keke`, `taxi`, or `any`).
2. Broadcast the request to eligible providers.
3. Providers are notified and may accept.
4. The lead charge is assessed and recorded **at provider acceptance** through the canonical Points engine; there is no second lead debit at completion/review.
5. Provider communication begins through WebRTC-capable session state. DataChannel carries text/events where available; server persistence is the recovery path.
6. Provider location is sampled intermittently. Trickbridge/WebRTC keeps the movement representation smooth between meaningful GPS samples; GPS is not continuously server-streamed.
7. Provider marks `Arrived`; the user receives a notification.
8. Provider voice/video controls are enabled after `Arrived`. PSTN masking is an external fallback only; WebRTC is the preferred direct voice/data transport.
9. Provider marks completion. Provider availability is restored so the provider can enter the next matching cycle.
10. User submits a review/feedback. The review confirms the completed outcome, updates trust and provider reputation/Points outcomes, and never double-charges the lead.

## Revenue weave

1. Sponsored Discover/category placement → click/action → Chat/Economic Request → provider conversion.
2. Provider subscription → eligibility/lead access → provider lead fee in Points.
3. User/provider/business Points top-up → authorised POS/agent → verified settlement → Points → agent commission.
4. Product/affiliate offer → Chat/product card → purchase/request → affiliate/provider commercial event.
5. Agent subscription/AI usage → bounded Agent Runtime → ongoing customer/business operations.
6. Eligible completed transactions → evidence/completion → applicable service/commission fee.

## Communication weave

Prefer the lowest-burden available transport:

- Web/mobile WebRTC DataChannel for realtime text/events/location.
- WebRTC audio/video for direct provider communication where both parties support it.
- Trickbridge aggregates/selectively forwards movement signals so GPS is sampled sparingly rather than continuously server-routed.
- External PSTN number masking is a fallback transport, not the core identity model.
- WhatsApp/Telegram/SMS/USSD are channel adapters into the same relationship/context.

## Points / agent network weave

Agents are network participants, not a second wallet system.

```text
active agent
  → customer assisted top-up intent
  → payment evidence
  → verified settlement authority
  → Points credit
  → commission accrual in Commercial Ledger
  → agent payout request
  → OPay / Moniepoint / approved manual settlement adapter
```

A customer, provider or business can top up through the ordinary authenticated payment path; an authorised POS agent can also create an assisted sale. Points are not credited merely because an agent submits an external reference; verification is required first.

## Storage weave

- User-owned Google Drive is preferred durable artifact storage when the required least-privilege scope is active.
- Managed owner-scoped storage is a bounded fallback/staging path.
- Artifact metadata remains in Kurukoo for discovery, ownership and Chat continuity.
- Drive metadata includes file ID, web view/content links, thumbnail and `Kurukoo / Artifacts` folder attribution when verified.

## Mobile continuation requirements

Any backend capability added after Expo creation must be added to `mobile/kurukoo-mobile/lib/platform-contract.ts` with its canonical owner, API boundary and client status. Native clients must never invent a second source of truth.

## Completion rule

A feature is not “complete” merely because its service exists. The implementation is complete only when the relevant source of truth, client surface, channel/agent continuation, evidence boundary, notification path, revenue path and operational/readiness status are connected—or explicitly marked as a genuine external activation boundary.
