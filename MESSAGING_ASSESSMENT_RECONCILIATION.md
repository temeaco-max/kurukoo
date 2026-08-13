# Messaging Assessment Reconciliation

The attached assessment was reconciled against the current PR #31 implementation after the durable outbox pass.

| Assessment recommendation | Current implementation status |
|---|---|
| One canonical identity, conversation, request, provider-coordination, and Economic Request model | Preserved. No channel-specific marketplace, dispatch, provider-chat, payment, or fulfilment engine was added. |
| Durable communications outbox and stateful receipts | Implemented with persisted deliveries, outbox leases, bounded retry scheduling, monotonic receipt states, in-app state projection, and idempotent inbound/provider callback records. |
| Consent, opt-out, and suppression | Implemented for external SMS, WhatsApp, and Telegram delivery. Consent is owner-scoped and purpose-aware; opt-outs create an all-purpose SMS denial. Provider notices are suppressed unless explicitly authorised. |
| WhatsApp handshake, signatures, multi-event processing, correlation, idempotency | Implemented. Production still requires Meta account setup, status subscriptions, templates, customer-service-window/template policy configuration, and live monitoring before activation. |
| SMS delivery reports, opt-outs, provider references | Implemented with Africa’s Talking callbacks behind a protected callback boundary. Production still requires a registered sender, live callback URLs, carrier policies, and operational ownership. |
| USSD session persistence and truthful deterministic responses | Implemented. USSD has no provider dispatch, emergency contact, payment, or external-delivery claim. A real service code, carrier approval, callback deployment, response-time monitoring, and market operating procedure remain external prerequisites. |
| Provider invitation notice | The in-app provider queue remains authoritative. A privacy-minimised, consent-gated external SMS notice intent is now created alongside each canonical invitation; it does not reveal customer, address, payment, dispatch, or selection details and is suppressed by default without consent. |
| Live sender/provider health, legal review, template approval, real credentials, operational staff | Not claimable in code. These require jurisdiction-specific review, provider contracts/accounts, configured production secrets, live test receipts, monitoring, incident response, and an operating owner. |
| Replace SQL.js with a production relational database and durable managed worker runtime | Deployment infrastructure prerequisite. The code now uses persisted records and a canonical worker startup hook, but the current repository/runtime cannot truthfully claim production operational durability until deployed to an appropriate managed database and continuously running worker environment. |

The remaining entries are deliberately **external activation prerequisites**, not missing code paths. Channels remain unavailable until their readiness checks and real end-to-end operational evidence are present.
