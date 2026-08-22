# Kurukoo OS — Canonical Branch and Ownership Contract

## Canonical source

`main` is the canonical Kurukoo OS source of truth.

All product, backend, web, PWA and Expo mobile capabilities must converge into the same canonical service/contract owners on `main`. Feature and integration branches are temporary workspaces only.

## Branch rule

Do not treat historical branches as parallel products. Before merging a branch:

1. compare it with the latest `main`;
2. preserve newer `main` work;
3. reuse canonical owners instead of introducing duplicates;
4. require the convergence/route/FastText/mobile gates;
5. close the branch's PR after successful consolidation.

A stale branch must never be force-reset over newer `main` simply to make a PR green.

## Canonical platform owners

- Chat: canonical Chat turn/relationship services
- AI routing: FastText/rules + unified AI gateway + provider health/cost policy
- Skills: canonical skill catalogue + behaviour registry + execution contract
- Memory: owner-scoped Memory Profile/living memory
- Discover: Discover composition over providers, products, offers, topics, opportunities, promotions and agent network
- Products: canonical catalogue/source registry + inventory matcher
- Economics: Economic Request + commercial ledger + Points
- Provider/agent network: provider verification + agent/POS commerce
- Physical execution: existing provider entities and skill capabilities, canonical Economic Requests, participant/connector authorization, execution evidence, provider communication sessions, and privacy-bound location context. Human, business, vehicle, robot, drone, autonomous asset, and external-platform participants differ by declared capability, authorization, connector, constraints, and evidence; they do not create a separate delivery, transport, payment, communication, or agent lifecycle.
- Communications: provider communication session; WebRTC data/audio/video; Trickbridge optimisation; external PSTN masking only when explicitly required/configured
- Notifications: canonical notification/reminder queue and channel adapters
- Channels: thin adapters entering canonical Chat
- Mobile: Expo iOS/Android consuming the canonical API/contracts; no competing native business logic
- Admin: protected operator surfaces over the same canonical services

## Current consolidation

The current canonical consolidation was merged to `main` as commit `e56d40463a42823a374ea184c00cffc0940ecb1c`.

Stale convergence PRs were closed after their useful implementation scope was consolidated into the current `main` tree. Historical branches may remain for traceability, but they are not independent Kurukoo OS implementations.

## Physical execution foundation

Physical execution is an additive capability profile on an existing provider skill, not a second provider directory. The stable participant identity remains the canonical provider identity; `provider_type` remains descriptive and grants no verification, payment, or dispatch privilege. A declared profile may describe participant type, transport mode, service area, capacity, operating constraints, supported payloads/actions, communication methods, evidence methods, and pricing model.

Matching continues through canonical provider capability discovery. Paid coordination remains one Economic Request. A physical action becomes an existing `execution_request` only after the request owner, participant capability, verification/availability, connector authorization, action scope, destination binding, expiry, and safety-policy reference all pass. The execution connector remains the durable idempotency and evidence boundary.

Progress is derived from existing execution states and typed evidence. A participant or connector claim is not automatically a verified outcome: provider/connector evidence can remain unverified or pending review, and a successful execution state maps to `evidence_pending` unless verified evidence exists. The local dummy connector is a simulator only; it never proves a real courier, vehicle, robot, drone, or autonomous delivery system.

Quick Ride remains a canonical Economic Request plus `economicDispatchCoordinator` broadcast over vehicle/capability constraints. Taxi, bike, keke, future robot taxi, and future autonomous vehicle support reuse that same request, participant, connector, communication, location-consent, and evidence model. Future external Agent-to-Agent work may nominate an authorized physical participant, but it must consume this boundary rather than become a second Kurukoo or a new agent runtime.
