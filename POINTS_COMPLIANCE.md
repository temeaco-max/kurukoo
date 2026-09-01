# Kurukoo Network Units — Nigerian Launch Guardrails

## Scope

Kurukoo is a Nigeria-first intelligent network. The existing Points ledger is the runtime foundation for the network-unit mechanism.

The product may eventually use a consumer-facing name such as `Tokens`, but the legal classification must be confirmed before public issuance of a named digital token. Nigeria's current Investments and Securities Act 2025 and the SEC's digital-asset framework expressly address digital/virtual assets and token issuance. Kurukoo must not assume that a utility label alone removes regulatory obligations.

## Intended product behaviour

1. **Closed-loop utility** — units are usable only for eligible Kurukoo services, access and benefits.
2. **No cash redemption** — ordinary users cannot redeem units for fiat.
3. **No peer-to-peer transfer** — units are not freely transferable between members.
4. **No investment rights** — units provide no ownership, dividend, interest, liquidation, profit-sharing or investment return.
5. **No external payment instrument** — units do not settle arbitrary third-party purchases.
6. **Separate fiat rail** — fares, goods, services, subscriptions and payouts settle through the appropriate regulated payment provider; Kurukoo does not become a customer deposit/wallet operator.
7. **Verified issuance** — purchased units are credited only after verified payment/settlement evidence.
8. **Controlled rewards** — Kurukoo may issue limited units for defined useful activity; rewards are incentives, not a substitute for normal sales.
9. **Agent distribution** — authorised Kurukoo agents may facilitate unit purchases and receive configured commissions; agent sales require evidence and canonical ledger records.
10. **Provider access** — eligible providers may consume units for qualified network opportunities, including transport/lead access, without those units becoming the customer's fare.

## Agent-sale boundary

Agent-assisted sales are a distribution channel, not a second financial system. Agent commission and unit issuance are recorded through the existing commercial ledger and network-agent services. The agent must be authorised for sales, and the unit balance is not credited merely because an intent was created.

## Payment/wallet boundary

Kurukoo should integrate with an appropriately licensed PSP such as OPay, Moniepoint, Paystack or another approved provider. Existing `directWallet.ts` and payout services are intentionally fail-closed until real provider settlement evidence is available.

## Catalogue boundary

The catalogue is a network opportunity catalogue, not a general-purpose open marketplace. It can contain provider/business/store/creator/affiliate/external offers, but Kurukoo should surface relevant offers in context rather than expose unrestricted eBay-style listings by default.

## Launch readiness

This document is a product guardrail, not legal advice or evidence of regulatory exemption. Before publicly selling a consumer unit described as a digital token, Kurukoo must obtain a Nigerian legal opinion and, where applicable, engage the SEC/CBN through the appropriate assessment or licensing route.