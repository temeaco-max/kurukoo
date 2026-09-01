# Kurukoo OS — Canonical Branch and Ownership Contract

## Canonical source

`main` is the canonical Kurukoo OS source of truth.

All product, backend, web, PWA and Expo mobile capabilities must converge into the same canonical service/contract owners on `main`. Feature and integration branches are temporary workspaces only.

## Product model

Kurukoo is Nigeria-first at launch. The product experience is `Discover -> Ask -> Act -> Complete -> Earn` with Chat as the primary intelligent control surface. Users, creators, providers, businesses, transport operators, couriers, contributors and Kurukoo agents are participants in one network, not separate products.

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
- AI: unified AI gateway and canonical tool/capability execution; model choice remains provider health/cost policy
- Skills: canonical skill catalogue + behaviour registry + execution contract
- Memory: owner-scoped Memory Profile/living memory
- Discover: composition over providers, products, offers, topics, opportunities, promotions, creators and agent network
- Products/offers: canonical catalogue/source registry + inventory matcher; network opportunity catalogue, not a general-purpose unrestricted marketplace
- Economics: Economic Request + commercial ledger + closed-loop network-unit/Points ledger
- Money: regulated external payment-provider adapters; Kurukoo does not create a customer fiat wallet or deposit-taking balance
- Provider/agent network: provider verification + agent/POS commerce + agent commission settlement
- Creator commerce: opted-in external content attribution into the existing catalogue, Chat, Economic Request, payment and fulfilment owners; no parallel commerce engine and no arbitrary scraping
- Physical execution: existing provider entities and skill capabilities, canonical Economic Requests, participant/connector authorization, execution evidence, provider communication sessions, and privacy-bound location context
- Communications: provider communication session; WebRTC data/audio/video; Trickbridge optimisation; external PSTN masking only when explicitly required/configured
- Notifications: canonical notification/reminder queue and channel adapters
- Channels: thin adapters entering canonical Chat
- Mobile: Expo iOS/Android consuming the canonical API/contracts; no competing native business logic
- Admin: protected operator surfaces over the same canonical services

## Network-unit economics

The existing Points engine is the runtime foundation for Kurukoo network units. It may be exposed later under a legally cleared consumer name such as `Tokens`, but naming does not determine regulatory classification.

Network units may be purchased directly through a verified payment provider or facilitated by authorised Kurukoo agents. Agent sales earn configured commission. Limited units may be awarded for defined useful activity. Eligible providers may consume units for network access/opportunities such as transport leads. Ordinary units are not fiat, are not freely transferable, and are not redeemable for cash.

The current Nigerian launch must not publicly present a token as an investment, store of value, transferable currency or profit-bearing asset. Final issuance structure is subject to Nigerian legal/regulatory review.

## Catalogue principle

Kurukoo's catalogue is an index of current network offers and capabilities. It connects an offer to the participant who can fulfil it. It should be searched in conversational context rather than presented as an exhaustive eBay-style marketplace by default. Ordinary users do not automatically receive unrestricted seller powers.

## Physical execution foundation

Physical execution is an additive capability profile on an existing provider skill, not a second provider directory. The stable participant identity remains the canonical provider identity; `provider_type` remains descriptive and grants no verification, payment, or dispatch privilege. A declared profile may describe participant type, transport mode, service area, capacity, operating constraints, supported payloads/actions, communication methods, evidence methods, and pricing model.

Matching continues through canonical provider capability discovery. Paid coordination remains one Economic Request. A physical action becomes an existing `execution_request` only after the request owner, participant capability, verification/availability, connector authorization, action scope, destination binding, expiry, and safety-policy reference all pass.

Progress is derived from existing execution states and typed evidence. A participant or connector claim is not automatically a verified outcome: provider/connector evidence can remain unverified or pending review, and a successful execution state maps to `evidence_pending` unless verified evidence exists. The local dummy connector is a simulator only.

Quick Ride remains a canonical Economic Request plus `economicDispatchCoordinator` broadcast over vehicle/capability constraints. Transport revenue is not inherently a percentage of the passenger fare: the intended launch model allows drivers to pay for network access/opportunity using network units while passenger/provider fare settlement remains separate.
