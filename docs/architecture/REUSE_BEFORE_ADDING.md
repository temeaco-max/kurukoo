# Kurukoo — Reuse Before Adding

This is a persistent implementation rule for all future agents working on the platform.

## Rule

Before creating a new service, route, database table, queue, UI state model, transport, wallet, product model, offer model, notification model, AI gateway, or agent runtime, first locate the existing canonical owner.

Add new code only when:

1. the requested capability has no suitable canonical owner;
2. the new code can be an adapter/composition layer over an existing owner;
3. the new code has an explicit lifecycle, authority and failure boundary; and
4. a regression test proves it is not duplicating an existing owner.

## Canonical ownership map

| Capability | Canonical owner | New code should do |
|---|---|---|
| Conversation | `canonicalChatTurnService` / Chat routes | Adapt channels; never implement another conversational authority |
| AI inference | `unifiedAiEngine` + `aiInferencePolicy` + provider adapters | Add provider adapters/policy, not another AI gateway |
| Intent/cheap routing | FastText/routing convergence | Add training/evaluation data, not another classifier authority |
| Skill behaviour | `skillBehaviourConvergence` / `skillBehaviourRegistry` | Add shared behaviour data or specialist overrides |
| Economic lifecycle | `skillFlows` + Economic Request routes | Add skill requirements/capabilities, not skill-specific economic engines |
| Skill execution | `skillExecutionContract` | Add interaction semantics shared by classes of skills |
| Memory | Memory Profile/living memory | Read/use relevant memory; never create a second user memory store |
| Provider network | `discoveryNetwork` + provider verification lifecycle | Add source/adapters, not another provider directory |
| Discover | `discoverExperience` + discovery network + commercial composition | Compose canonical objects; do not create duplicate master records |
| Products/inventory | catalogue source registry + inventory matcher + commercial catalogue | Add ingestion adapters, not another product database |
| Promotions/ads | `adManager` | Add placements/creative composition, not another ad engine |
| Points | `pointsEngine` | Add authorised earning/top-up/lead events; never create a second wallet |
| Commercial accounting | `commercialLedger` | Add event producers; never create another ledger |
| Agent economy | network-agent commerce + commercial ledger + Points | Add agent roles/payout adapters; keep settlement in existing ledger |
| Notifications | `pushNotifications` / internal notification queue | Add context/actions, not another notification queue |
| WebRTC | `webrtcSignalling` | Add session orchestration/adapters; media/data stay peer-to-peer |
| Provider communication | provider communication session | Connect WebRTC/voice/channel adapters to an Economic Request |
| Voice | canonical voice router/provider adapters | Add transport/provider adapters, not separate business flows |
| Channels | channel adapters → canonical Chat | Never duplicate domain/skill logic per channel |
| Agent runtime | existing agent runtime/coordinator | Add skills/capabilities/budget policies, not another agent engine |
| Admin | existing Admin Control Room/domain routes | Add operator modules under one protected surface |
| Public web | existing public/discover/earn/help/legal routes | Extend existing funnels instead of adding duplicate sites |
| Mobile | Expo app + platform contract | Add native presentation over canonical APIs; never recreate backend logic |

## Current shared interaction rule

Economic/coordination skills use `SkillExecutionContract.interaction` to express their user journey. A dispatch-capable skill can therefore use:

`request → match → provider accepts lead → live session → provider arrives → fulfilment → completion/evidence → review → next availability/settlement`

without a ride-only engine.

Transport preference such as `vehicle_type` belongs to the shared transport skill contract, not a privileged ride subsystem.

## Current communication rule

For provider/customer communication, WebRTC may carry:

- text/data messages;
- provider location/event updates;
- presence;
- audio;
- video.

Trickbridge is an optimisation/aggregation adapter. External telephony masking is a fallback transport, not the canonical communication architecture.

## Current Points/agent rule

A Points top-up must settle only from the existing verified payment boundary. Agent commission is a commercial-ledger obligation first; payout is a separate authorised settlement step. Do not split payment into arbitrary client-side shares.

## Mandatory review question

Before merging any feature, ask:

> “Which existing Kurukoo owner already knows this fact, owns this lifecycle, or executes this action?”

If the answer is one of the owners above, extend or compose that owner first.
