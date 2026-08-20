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
- Communications: provider communication session; WebRTC data/audio/video; Trickbridge optimisation; external PSTN masking only when explicitly required/configured
- Notifications: canonical notification/reminder queue and channel adapters
- Channels: thin adapters entering canonical Chat
- Mobile: Expo iOS/Android consuming the canonical API/contracts; no competing native business logic
- Admin: protected operator surfaces over the same canonical services

## Current consolidation

The current canonical consolidation was merged to `main` as commit `e56d40463a42823a374ea184c00cffc0940ecb1c`.

Stale convergence PRs were closed after their useful implementation scope was consolidated into the current `main` tree. Historical branches may remain for traceability, but they are not independent Kurukoo OS implementations.
