# Kurukoo frontend roadmap

## Frontend product map

### Core OS
- [x] Conversation-first entry point and chat surface.
- [x] Discovery and contextual search surfaces.
- [x] Requests, coordination, Work and request detail.
- [x] Activity, approvals and attention states.
- [x] Trust and verification language and provider safeguards.
- [x] Wallet, points and paid transaction surfaces.
- [x] Memory, saved context and artifacts/files.
- [x] Topics, following and opportunities.

### Public experience
- [x] Public navigation rail with collapse/expand behavior.
- [x] Public main surface resizes when the rail collapses.
- [x] Public header navigation is aligned to the central content surface.
- [x] Public trusted-context rail and mobile public navigation.
- [x] User-facing product language across public and authenticated surfaces.

### Ecosystem
- [x] Providers: discovery, provider profile, onboarding, trust, incoming work and earning journey.
- [x] Businesses: discovery, business profile, services/products, team, demand, analytics and advertising paths.
- [x] Creators: watch, creator discovery, creator studio, publishing, audience and revenue-share paths.
- [x] Advertising: campaign setup, audience, creative, placements, budget, measurement and billing surface.
- [x] Plans and subscriptions for people, providers, businesses and creators.
- [x] Wallet and points with an explicit separation between coordination points and money.
- [x] Partners, referrals and affiliate value surfaced from pricing/capabilities.
- [x] Agents, voice/calls, Daily Picks, messages/connections, files and connected services surfaced from Capabilities.

### Navigation
- [x] Authenticated rail surfaces Providers, Businesses, Creators, Advertising, Plans, Subscriptions and Wallet.
- [x] Capabilities and Network are registered in the TanStack route tree.
- [x] `/notifications` continues to redirect to `/activity`.

## Monetisation model represented in the frontend

- [x] People: free access plus paid Kurukoo Plus path.
- [x] Monthly points allowance represented separately from subscription billing.
- [x] Providers: provider plan, incoming demand, customer messaging, reputation/verification and future earnings/payouts.
- [x] Businesses: business plan, team/customer demand, analytics, advertising and payments.
- [x] Creators: publishing, subscribers, topic placement and revenue-share opportunities.
- [x] Advertising: clearly labelled sponsored discovery, campaign setup, targeting, placements, budgets, measurement and billing.
- [x] Wallet: points and money kept separate, with top-ups, refunds and provider payout paths exposed.
- [x] Marketplace, service/product transaction and processing-fee path surfaced without hardcoding unverified rates.
- [x] Partner, referral and affiliate value path surfaced.

## Execution Network convergence

Kurukoo is now treated in the frontend as **the execution network for people and AI**, not merely a collection of assistant pages.

- [x] Canonical `ASK → DECIDE → DONE` interaction model.
- [x] Frontend adapter for the canonical `/api/execution-network` contract.
- [x] 39-pillar execution-network contract available for testing and readiness inspection.
- [ ] Replace illustrative execution cards with live request/provider/offer/evidence data as the corresponding backend activation becomes available.
- [ ] Make Work the visible continuity surface for request → execution → evidence → outcome.
- [ ] Surface external activation truth explicitly instead of implying that repository readiness means live fulfilment.
- [ ] Add provider-side execution controls using the same canonical request/execution objects.
- [ ] Add cross-agent entry points using the same canonical capability contract.

## Frontend work still worth implementing

### Real data and actions
- [ ] Replace illustrative providers, activities, campaigns, balances, transactions, entities and videos with backend data.
- [ ] Make primary actions actually submit, navigate, save or request consent instead of being display-only.

### Provider operations
- [ ] Real onboarding and identity/business verification.
- [ ] Real capability and availability management.
- [ ] Incoming request acceptance/decline, work progression and customer messaging.
- [ ] Earnings, fees, payout status and payout history.

### Business operations
- [ ] Real business profile, location and service/product catalogue.
- [ ] Demand/request management, customer history and team roles.
- [ ] Analytics, ad spend controls, billing and payment approvals.

### Creator operations
- [ ] Upload, edit, moderation and publishing workflows.
- [ ] Audience/subscriber management.
- [ ] Topic placement, comments/discussion and creator payments/revenue share.

### Advertising operations
- [ ] Real campaign creation, review and publishing.
- [ ] Targeting and eligibility rules.
- [ ] Delivery, spend controls, attribution, reporting and advertiser billing.

### Wallet / checkout
- [ ] Real points top-ups and ledger entries.
- [ ] Payment methods, approval screens, refunds and transaction receipts.
- [ ] Provider/business payout flows.
- [ ] Marketplace fee calculation and checkout disclosure.
- [ ] Referral/affiliate attribution and payout handling.

### Agents / voice / context / integrations
- [ ] Production agent runtime with consent boundaries.
- [ ] Live voice and calling/WebRTC connections.
- [ ] QR/context handoff and connected-service authorisation.
- [ ] Real proactive feed and recommendation ranking.

### Authentication
- [ ] Production email/phone authentication.
- [ ] Google/Facebook and QR authentication behind the existing auth surfaces.
- [ ] Account/profile persistence and session handling.

## Backend / integration boundary

The frontend should remain honest about connection state. Illustrative content should be visibly labelled, unavailable actions should say “Coming soon” or “Not connected yet”, and the UI should not claim that a provider, payment, message, call or integration is live when it is not.

The existing Kurukoo bridge uses the `/api/v1/*` contract for the frontend-facing integration layer. The frontend should continue reusing that bridge rather than introducing a second API contract.

The Execution Network contract is intentionally exposed through a small read-only adapter; it does not create a second API authority or execution engine.

The demo store remains useful for shaping the interface, but production behavior should replace it with real API reads/writes when each service is connected.
