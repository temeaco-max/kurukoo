# FCM external contract notes

The optional FCM adapter is based on the official Firebase Cloud Messaging HTTP v1 contract, verified on 2026-08-13.

| Topic | Verified constraint | Kurukoo implementation consequence |
|---|---|---|
| Send authentication | HTTP v1 uses an OAuth 2.0 access token derived from a service account or application default credentials. | The server reads only `FCM_SERVICE_ACCOUNT_JSON`, creates short-lived OAuth assertions, and never sends service-account material to clients. |
| Targeting and response | A device-token send returns an FCM message name when Firebase accepts the request. | The canonical communication ledger records `accepted` with only the opaque provider reference; acceptance is not represented as device delivery. |
| Delivery evidence | Firebase documents aggregate reports/Data API and optional BigQuery exports; reporting is delayed and is not a synchronous per-message receipt callback. | The FCM boundary does not move a delivery to `delivered` or `read`. The durable in-app notification remains the deterministic fallback and owner-scoped read signal. Aggregate analytics are deployment-dependent and consent-gated. |

Sources: [FCM HTTP v1 send API](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Understanding FCM delivery](https://firebase.google.com/docs/cloud-messaging/understand-delivery).
