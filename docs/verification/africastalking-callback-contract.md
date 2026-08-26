# Africa's Talking Callback Contract

This implementation uses the following official provider contracts and keeps credential values outside the repository.

| Boundary | Contract used | Kurukoo route / behavior |
|---|---|---|
| Incoming SMS and delivery report | Africa's Talking sends form-encoded `POST` callbacks. Incoming messages include `id`, `from`, and `text`; delivery reports include `id`, `status`, `phoneNumber`, and optional `failureReason`. [SMS Notifications](https://developers.africastalking.com/docs/sms/notifications) | `POST /webhook/sms` routes inbound chat through the channel registry, deduplicates provider message IDs, and records delivery report state in canonical persistence. |
| USSD session | Africa's Talking sends form-encoded `POST` callbacks for each session step; responses must be `text/plain` and returned within 10 seconds. [USSD Overview](https://developers.africastalking.com/docs/ussd/overview) | `POST /ussd` passes `sessionId`, `serviceCode`, phone, and full accumulated text to the persisted USSD menu handler. |
| USSD completion | Africa's Talking can emit a session-end callback with `sessionId`, `status`, and session metadata. [USSD Notifications](https://developers.africastalking.com/docs/ussd/notifications) | Carrier session state is stored by `sessionId`; normal USSD responses continue to append durable canonical channel messages. |
| Airtime | The provider supports sandbox airtime submission at `/version1/airtime/send`; provider response acceptance is distinct from final delivery status. [Airtime API guide](https://blog.africastalking.com/africas-talking-airtime-api-basic-usage-guide-b849fe6c88f) | `POST /airtime` records idempotent provider callbacks against a canonical airtime operation. Kurukoo only marks completed when callback evidence reports success. |

> **Sandbox result:** The session health check found a configured credential but could not complete a TLS connection from this execution environment. Local deterministic tests cover provider request parsing, callback handling, idempotency, and fail-closed transport behavior. No real handset delivery, SMS send, or airtime purchase is claimed by this record.
