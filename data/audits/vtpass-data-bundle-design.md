# VTpass Data-Bundle Integration Design Notes

## Scope

Implement a provider-neutral `data_bundle` economic outcome that preserves the owner, recipient phone, network, variation code, amount, currency, and request reference throughout payment, provider activation, status requery, and evidence reporting. Reuse the existing Economic Request, Paystack verified-payment, fulfilment, and truthful completion boundaries; do not create a parallel vertical engine.

## Official VTpass facts

VTpass documents data-bundle purchase as a POST to `/api/pay` (live `https://vtpass.com/api/pay`, sandbox `https://sandbox.vtpass.com/api/pay`) with service identifiers such as `mtn-data`; its documented success response uses code `000`, transaction status `delivered`, and a provider `requestId`.[1] VTpass also documents a POST `/api/requery` endpoint using the original `request_id` to query transaction status.[1] The official documentation page exposes a variation-code endpoint for data plans and describes the purchase flow as variation-code lookup, purchase using the variation code, and transaction-status query.[1]

## Truth and state rules

A provider acceptance or an initial `code: 000` response must not be treated as Kurukoo completion unless the returned transaction status is an explicitly delivered/successful state and the response is retained as evidence. Pending, initiated, processing, unknown, or failed provider states remain non-complete. Requery must use the original provider request ID and be idempotently correlated to the Economic Request. Paystack settlement must be verified before provider activation; no provider call is made for an unverified payment.

## Proposed request fields

| Field | Meaning |
| --- | --- |
| `recipient_phone` | Nigeria recipient number, normalized and retained exactly as the activation target. |
| `network` | Provider-neutral network selection, for example MTN, Airtel, Glo, or 9mobile. |
| `variation_code` | VTpass plan identifier; never inferred as a confirmed plan when absent. |
| `bundle_label` | Human-readable plan label retained from catalogue/variation evidence. |
| `amount_minor` | Integer NGN amount used for verified payment and reconciliation. |
| `currency` | Expected `NGN`. |
| `provider_request_id` | VTpass request reference for activation and requery correlation. |
| `provider_transaction_id` | VTpass transaction identifier when returned. |
| `provider_status` | Raw normalized provider state retained as evidence. |

## Sources

[1]: https://vtpass.com/documentation/mtn-data/ "VTpass MTN Data API Documentation"
