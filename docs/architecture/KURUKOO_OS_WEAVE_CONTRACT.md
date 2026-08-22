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
| Ride/delivery dispatch | broadcast, provider acceptance/lead charge, arrived, live location, pickup/drop-off, completion, review, next availability | `economicDispatchCoordinator`, `serviceReviewService` |
| AI | FastText/rules, SmolLM2, Mistral/Gemini/Groq/OpenRouter capacity, health, quotas, budgets, telemetry | `aiInferencePolicy`, `unifiedAiEngine` |
| Channels | Web/mobile/WhatsApp/Telegram/SMS/USSD/voice/QR → canonical conversation; no channel-specific business lifecycle | channel adapters + canonical Chat |
| Artifacts | Chat/voice/reports/receipts, Google Drive `drive.file`, managed fallback, Connect, web/mobile workspace | `artifactService`, `artifactRoutes`, `artifactDriveEnhancer` |
| QR | signed context → server activation → conversation/context continuation | `qrContextService`, `qrRouter` |
| Mobile offline | Chat/task mutations → local durable queue → idempotent replay → canonical API | `mobile/kurukoo-mobile/lib/offline-queue.ts` |
| Mobile haptics | send/refresh/task transitions/selection/success/error | `mobile/kurukoo-mobile/lib/haptics.ts` |
| Public acquisition | Home, Explore, Earn, How it works, Network, Channels, Pricing, Help, About, Careers, Legal → onboarding/conversion | public routes/views |
| Admin | provider health, AI telemetry, credentials, agent budgets, ads, disputes, moderation, integration status | Admin Control Room |

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

## Storage weave

- User-owned Google Drive is preferred durable artifact storage when the required least-privilege scope is active.
- Managed owner-scoped storage is a bounded fallback/staging path.
- Artifact metadata remains in Kurukoo for discovery, ownership and Chat continuity.
- Drive metadata includes file ID, web view/content links, thumbnail and `Kurukoo / Artifacts` folder attribution when verified.

## Mobile continuation requirements

Any backend capability added after Expo creation must be added to `mobile/kurukoo-mobile/lib/platform-contract.ts` with its canonical owner, API boundary and client status. Native clients must never invent a second source of truth.

## Completion rule

A feature is not “complete” merely because its service exists. The implementation is complete only when the relevant source of truth, client surface, channel/agent continuation, evidence boundary, notification path, revenue path and operational/readiness status are connected—or explicitly marked as a genuine external activation boundary.
