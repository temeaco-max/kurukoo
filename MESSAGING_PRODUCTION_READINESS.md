# Messaging Production-Readiness Boundary

## Implemented canonical controls

Kurukoo now persists external outbound intent in `communication_deliveries` and `communication_outbox` before attempting transport. The background worker leases due rows, executes the existing channel transport boundary, records provider acceptance separately from delivery, bounds retries, and leaves an unavailable adapter as `not_configured` rather than fabricating delivery.

The external channel policy is owner-scoped. SMS, WhatsApp, and Telegram deliveries are denied by default except a reply to an inbound conversation event. Users may explicitly grant or deny per-purpose external delivery through authenticated notification preference endpoints. A denial or expired consent marks a delivery `suppressed`; it does not attempt transport.

| Channel | Durable delivery behavior | Receipt and callback behavior |
|---|---|---|
| WhatsApp | Conversation replies are queued for the outbox; no request-time send or typing claim is made. | Signed Meta webhook processing is retained. Status callbacks are replay-safe and advance only monotonically through `sent`, `delivered`, `read`, or failure evidence. |
| SMS | Conversation replies are queued for the outbox and use the existing Africa’s Talking send adapter. | Delivery reports update the shared delivery record idempotently. Provider opt-outs record an all-purpose SMS denial. |
| USSD | USSD is an interactive callback session, not an outbound messaging channel. Menu interactions are replay-safe by `(sessionId, input)`. | Session-end outcomes are persisted idempotently. USSD remains explicit that it does not dispatch providers, contact emergency services, or deliver external notifications. |

## Activation prerequisites

No channel is represented as live until its required production controls are configured.

| Channel | Required before operational activation |
|---|---|
| WhatsApp | Live Meta app and business account, production token, phone-number ID, app secret, verified callback token, subscribed status webhooks, template policy and approval where required, consent policy, and receipt monitoring. |
| SMS | Africa’s Talking production credentials, registered sender policy where required, delivery-report callback, callback token in the configured URL, opt-out callback, consent policy, and delivery-failure monitoring. |
| USSD | Africa’s Talking service code, enabled controlled rollout flag, protected session and session-outcome callback URLs, callback token, session monitoring, carrier/regulatory approval, and support procedure. |
| Outbox runtime | A persistent application runtime with `KURUKOO_WORKERS` not set to `0` and `KURUKOO_COMMUNICATION_OUTBOX_ENABLED` not set to `false`. The worker is started through the canonical application startup path, leases durable due work, and records provider acceptance separately from delivery; this development sandbox is not an operational production host. |

## Validation

The messaging boundary and related provider/economic flows passed focused regression tests. The browser-facing product copy describes external execution as controlled and evidence-gated, matching the outbox rule that provider acceptance is not delivery and an unconfigured or suppressed channel is never represented as external fulfilment. Compilation, production build, security and service audits, DOM-safety checks, and staged-secret scanning passed after implementation.
