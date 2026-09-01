# Kurukoo Commercial & Agent Economy Contract

This is the canonical monetisation boundary for the Nigeria-first Kurukoo network. It describes product rules; legal classification of any purchased network unit remains subject to Nigerian regulatory review.

## Commercial authority

All monetised activity ultimately produces a `commercial_ledger` event. Feature-local tables may describe inventory, campaigns, subscriptions, agent sales, unit balances or affiliate state, but they do not become a second revenue authority.

A commercial event carries payer/payee, represented party, gross amount and currency, Kurukoo platform fee, provider entitlement, processing/tax fields where known, agent/skill context, Economic Request correlation where applicable, external settlement evidence, idempotency and settlement status.

No UI, model or agent may claim that money was received or revenue settled without canonical payment evidence.

## Money boundary

Kurukoo does not create or operate a customer fiat stored-value wallet. Actual Naira payment and payout use an appropriately licensed and activated PSP/payment rail. Kurukoo records verified payment evidence and coordinates the resulting work.

## Network units / Points

The existing `pointsEngine` is the runtime authority for Kurukoo network units. Database/API names remain `points_*` for compatibility while the product model is a closed-loop network-utility unit.

Intended behaviour:

- units may be purchased directly from Kurukoo or facilitated by an authorised Kurukoo agent;
- units are credited only after verified settlement evidence;
- authorised agents receive configured sales commission through the commercial ledger/payout boundary;
- limited units may be awarded for defined useful activity;
- eligible providers can consume units for network access/opportunities such as qualified transport or service leads;
- units are not a fiat balance, are not cash-redeemable for ordinary users, are not freely transferable and provide no ownership, profit, interest or investment entitlement;
- customer/provider fares, goods, services and payouts remain fiat transactions through the appropriate payment rail.

A future consumer name such as `Tokens` must not be treated as proof of legal exemption. Before public issuance under that name, the exact unit characteristics must be reviewed under current Nigerian SEC/CBN requirements.

## Network-agent sales

`kurukoo_network_agents` is the distribution/support channel. An active agent authorised to sell units may facilitate a purchase. `kurukoo_points_topups` records the customer, unit quantity, fiat amount, agent, idempotency key, settlement state and external reference. Unit credit occurs only after settlement evidence is verified. Agent commission is calculated from the fiat sale amount and recorded in the commercial ledger.

Agents are not an independent payment institution or second Kurukoo economy.

## Transport economics

Quick Ride remains a canonical Economic Request plus provider/capability matching. Kurukoo's intended transport revenue model does not require Kurukoo to collect and split the passenger's fare. A driver can instead consume network units for qualified ride opportunities or use configured daily/pay-as-you-go/subscription access. The exact pricing schedule is configurable and must be validated against driver economics before launch.

The driver's fare remains separate from Kurukoo's network-access revenue.

## Commercial product catalogue

`commercial_products` is the catalogue for paid Kurukoo capabilities. It includes provider subscriptions plus network-unit packages and transport network-access packages. A zero price means that product is not configured for production billing.

Consumer subscriptions may remain in the existing pricing table where their entitlement semantics depend on country/user context; they must still settle through canonical commercial/payment authorities.

## Network opportunity catalogue

The product catalogue is not an eBay/Jumia clone. The canonical catalogue source/product registry stores offers from providers, businesses, stores, creators, affiliates and controlled external sources. The assistant should resolve relevant offers in context. Ordinary users do not automatically receive unrestricted marketplace-seller privileges.

A product entry represents something Kurukoo can help a user obtain, not a promise that Kurukoo itself owns or stocks the item.

## Creator/content commerce

Opted-in external content may be associated with catalogue offers. YouTube/TikTok/etc. remains the media host; Kurukoo provides attribution, context, conversation, provider/seller coordination, payment and fulfilment. Arbitrary scraping is not part of the model.

The preferred path is:

`external content -> creator attribution -> Kurukoo context -> conversational intent -> verified offer/provider -> payment -> fulfilment -> creator reward`

## Agent/creator/provider rewards

Reward issuance remains bounded and rule-driven. Rewards must not be represented as cash, investment return or guaranteed income. Creator commissions for completed commercial activity are separate from network units and should be settled in fiat where the commercial programme requires cash compensation.

## Recurring subscriptions

Subscription activation creates persistent billing state. Due renewals use the configured payment adapter and only verified settlement creates renewal revenue. Repeated failures move to `past_due`; the system must never claim a renewal that was not paid.

## Advertising and affiliates

Advertising campaign funding is reconciled through the commercial ledger. Affiliate conversion revenue is recorded only from verified conversion evidence; a click alone is not revenue.

## Launch truth

Repository implementation is not evidence of external financial activation. Live unit sales, agent commissions, provider payouts, customer payment, webhooks and bank/mobile-money movement require real activated provider credentials, verified settlement callbacks and the applicable regulatory/commercial approvals.
