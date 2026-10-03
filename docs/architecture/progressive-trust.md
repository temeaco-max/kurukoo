# Kurukoo Progressive Trust and Channel Evidence

## Purpose

Kurukoo keeps the phone number as the primary channel identity because WhatsApp, Telegram, SMS, IVR, USSD, safety contact, and phone-based routing depend on it. Authentication does not need to force every ordinary conversation through SMS, however. The repository now supports a progressive model in which account establishment, device trust, channel evidence, email evidence, social evidence, and phone ownership remain separate facts.

A user may begin as a guest, establish a durable account through the conversational flow, trust a device through authenticated registration or an independent push approval, connect a channel such as WhatsApp, and unlock only the capabilities that the recorded evidence supports. Kurukoo must not collapse these facts into one generic verified flag.

## Evidence states

| Evidence | Meaning | Does not prove |
|---|---|---|
| Guest session | A temporary conversation exists. | User identity or contact ownership. |
| Established account | Kurukoo has a durable profile and conversation identity. | Ownership of the supplied phone or email. |
| Trusted device | A device credential was registered through an authenticated session or independently approved challenge. | Phone-number ownership. |
| WhatsApp linked session | A personal WhatsApp session was paired and received a valid inbound message. | Ownership of every phone number supplied elsewhere. |
| Signed WhatsApp webhook | Meta webhook authentication passed and a sender number was received. | That the number is safe for every telephony action. |
| Telegram webhook | Telegram secret validation passed and a Telegram subject was received. | A phone number, because Telegram may expose only a synthetic user/chat identity. |
| Email webhook | A signed Resend/email webhook was linked to a canonical profile email. | Phone ownership. |
| Verified phone | A phone-provider or equivalent independent verification succeeded. | Trustworthiness of every future browser or channel. |
| Location consent | The user permitted a stated location purpose for a bounded period. | Identity or background location permission. |

## Device and push endpoints

The authenticated user route owns the following endpoints:

```text
POST /api/device/register
GET  /api/device/status
POST /api/device/challenge
POST /api/device/challenge/:id/approve
GET  /api/trust/progressive
```

`POST /api/device/register` accepts a client-generated device identifier, credential type, optional label, and push capability. The raw identifier is not stored in the database; it is HMAC-digested with the application secret. Registration is meaningful only after the request is authenticated.

`POST /api/device/challenge` creates a short-lived challenge for a target device. The target becomes trusted only if an already active trusted device approves the exact challenge. A notification may be queued through the existing FCM/internal notification boundary, but the API distinguishes internal queuing from provider delivery.

`POST /api/device/challenge/:id/approve` requires an already trusted approver device. A new browser cannot safely approve itself and thereby claim independent trust. Challenges expire after five minutes and cannot be reused after approval, denial, or expiry.

The current implementation does not request browser notification permission automatically. Permission and FCM token registration remain explicit client actions. The existing `/api/fcm/register` endpoint can bind a supplied FCM token to the authenticated device when a device identifier is supplied.

## Channel evidence

All canonical channel adapters continue to hand inbound messages to `canonicalChatTurnService`. The shared `BaseChannelHandler` records bounded evidence after the channel parser accepts the message and before canonical Chat runs. The direct Meta WhatsApp adapter and the personal Baileys linked-device adapter record their own verified evidence because they do not inherit the shared base handler. The email adapter records evidence only after webhook authentication succeeds and the sender email is linked to a canonical profile.

Evidence records contain channel, evidence type, bounded external subject, bounded source reference, consent state, and observed time. Raw message bodies and credentials are excluded. Evidence is an observation, not a fabricated provider assertion. Real delivery, account linking, and provider activation remain externally dependent.

## Personalized workspace behavior

The public and guest Chat surface remains conversation-first. Guest users can use public conversation and discovery, but private reminders, saved context, tasks, Points, account settings, and other profile-bound surfaces are hidden in the client and protected by authenticated server routes.

Authenticated users receive their own profile-linked context, private workspace navigation, recent conversations, notifications, channel connections, memory, tasks, and account controls. The central Chat template remains shared; personalization changes the available data and actions rather than creating a second frontend architecture.

## Location consent

Discover requests browser geolocation only when an authenticated user opens the Discover surface and the browser grants permission. The client rounds the coordinates to coarse precision before sending them to:

```text
POST /api/location/consent
```

The request includes a purpose and an expiry. The current Discover purpose is `nearby_discovery` with a 30-minute consent window. No background location claim is made. Guests receive a clear sign-in prompt instead of a location request. Users can alternatively provide an area manually through the conversation.

## Production activation

The following non-secret flags are explicit production gates:

```dotenv
KURUKOO_PROGRESSIVE_TRUST_ENABLED=false
KURUKOO_PUSH_APPROVAL_ENABLED=false
KURUKOO_CHANNEL_EVIDENCE_ENABLED=false
KURUKOO_LOCATION_CONSENT_ENABLED=false
```

Production operators must set them deliberately after reviewing privacy, notification, device-revocation, recovery, and provider requirements. The repository is complete for activation when the flags and provider prerequisites are supplied, but it does not claim that push, WhatsApp, Telegram, SMS, email, or location delivery is live without external evidence.

## Boundary ownership

Five boundaries are adjacent and easy to confuse. Each has exactly one owner. Do not
add a second store, queue, or lifecycle for any of them; extend the owner instead.

| Boundary | Canonical owner | Persistence | HTTP surface | State |
|---|---|---|---|---|
| Trusted contact | `src/services/authChallengeService.ts` (`addTrustedContact`, `listTrustedContacts`, revoke/recovery) | `trusted_contacts`, owner-scoped, verified flag | `src/routes/authRoutes.ts` | Implemented |
| Contact consent | `src/services/trustedContactService.ts` (`createTrustedContactConsentRequest`, `respondToTrustedContactConsent`, `revokeTrustedContactConsentRequest`) | `trusted_contact_consent_requests` | `src/routes/trustedContactConsentRoutes.ts` | Implemented; guarded by `scripts/test-trusted-contact-consent.ts` |
| Notification | `src/services/pushNotifications.ts` (`sendFcmPush`, `transitionNotificationDelivery`, `recordNotificationAttempt`, `listQueuedNotifications`) | `internal_notifications` with delivery state, attempt count, backoff, dead-letter | `src/routes/notificationRoutes.ts`, `src/routes/fcmPublicRoutes.ts`, `src/routes/adminFcmRoutes.ts` | Implemented behind provider credentials |
| Linked device | `src/services/telegramLinkedDeviceService.ts`, `src/services/whatsappLinkedDeviceService.ts` | provider session plus canonical participant state | `src/routes/telegramLinkedDeviceRoutes.ts`, `src/routes/whatsappLinkedDeviceRoutes.ts` | Implemented; gated by `pilotReadiness` / `externalIntegrationReadiness` |
| Payment | `src/routes/paymentRoutes.ts` with `src/services/stripePayment.ts` and `paystackPayment.ts` | orders, escrow, points ledger | `src/routes/paymentRoutes.ts`, `stripeAgentPointsWebhookRoutes.ts` | Implemented; `externalIntegrationReadiness` reports `productionActive=false` until a provider is activated |

### Deliberate gap: the trusted-contact provider adapter

`src/services/contactSyncService.ts` is the placeholder for importing a contact
provider's address book. It is intentionally inert:

- `getContactSyncReadiness()` reports unavailable unless `KURUKOO_CONTACT_SYNC_ENABLED=true`
  and `KURUKOO_CONTACT_SYNC_SOURCE=trusted_provider`, and its `reason` states the boundary is
  `ready_for_adapter_validation`.
- `startContactSyncService()` logs that no adapter is activated and changes no contact data.

The adapter stays unimplemented until the provider, consent, ownership, retention and
deletion contract is approved. The consent lifecycle above already exists, so the
missing piece is the provider adapter only — not a second consent store. Readiness text
must not be promoted to a claim that any contact was imported or verified.

## Remaining activation requirements

| Capability | Repository state | External requirement |
|---|---|---|
| Trusted browser record | Implemented | Production secret, HTTPS, session review, device-revocation UX. |
| Push approval | Implemented behind flag | Firebase credentials, notification permission, real device token, provider acceptance, and real approval test. |
| WhatsApp | Canonical adapters and linked-device pairing surface exist | Meta credentials or personal linked-device QR pairing, real account test, and delivery evidence. |
| Telegram | Canonical webhook adapter exists | Bot token, webhook secret, HTTPS callback, and real message test. |
| SMS | Canonical inbound/outbound boundary exists | Africa’s Talking or another approved provider, sender configuration, callback validation, and delivery test. |
| Email | Resend boundary and email channel exist | Verified sending domain, Resend key, webhook configuration, inbox delivery test, and privacy decision. |
| Location | Consent and coarse persistence exist | Browser permission, privacy notice, retention policy, and product-specific purpose review. |

The acceptance standard is **repository-side complete → ready for external activation**. The system must not describe a queued notification as delivered, a linked adapter as connected, or observed channel evidence as universal identity verification.

## Email OTP bootstrap and recovery

Email OTP is now available through the existing conversational and dedicated authentication surfaces. The phone remains required for a new phone-first account and remains the canonical communications identity. Email verification sets `email_verified_at`; it does not set `phone_verified_at`.

The dedicated endpoints are:

```text
POST /api/auth/request-email-otp
POST /api/auth/verify-email-otp
```

The login page keeps phone as the default path and provides an explicit `Use email for the code instead` option. The user still supplies the phone number, while the code is sent to the supplied email address. The conversational onboarding flow accepts an email in the verification step, asks for the phone that should remain connected, and then continues in the original Chat session after successful verification.

Email OTP codes are six digits, expire after ten minutes, allow at most five attempts, are hashed with the application secret, are deleted after successful verification, and are never included in production responses. The canonical email log stores `[redacted]` for sensitive OTP bodies. Development-only debug codes are available only when `NODE_ENV` is not production and `OTP_DEBUG=true`.

The deployment gate is:

```dotenv
KURUKOO_EMAIL_OTP_ENABLED=false
RESEND_API_KEY=
EMAIL_FROM=
```

Production activation requires setting the gate explicitly, supplying a Resend API key, verifying the sending domain, configuring a valid `EMAIL_FROM`, and completing a real inbox test. A generated database record or an internal email queue entry is not delivery evidence.

## Coordinator and AI Brain integration

Trust, channel-evidence, and privacy lifecycle changes now pass through the existing Coordinator event envelope. The Coordinator may observe bounded state transitions and produce notifications or wait-for-user projections, but these events do not grant autonomous authority to approve devices, verify phone ownership, release a privacy mapping, or activate an external connector.

The current bounded event vocabulary includes:

```text
trust.device.registered
trust.challenge.created
trust.challenge.approved
trust.challenge.denied
trust.device.revoked
channel.evidence.observed
privacy.number_mapping.created
privacy.number_mapping.released
```

Event payloads contain hashed or bounded identifiers, channel names, lifecycle states, source references, and timestamps. Raw device identifiers, OTP values, phone numbers, message bodies, provider credentials, and external secrets are excluded. Canonical services remain the owners of truth and the Coordinator remains an observer/orchestrator under policy.

## Admin management

The existing admin console now includes a Progressive Trust & Channel Readiness panel. It reads:

```text
GET /api/admin/trust/readiness
GET /api/admin/trust/devices/:phone
POST /api/admin/trust/devices/:phone/:deviceId/revoke
GET /api/admin/connectors/telegram-linked-device/status
POST /api/admin/connectors/telegram-linked-device/start
POST /api/admin/connectors/telegram-linked-device/stop
POST /api/admin/connectors/telegram-linked-device/logout
```

The panel exposes feature-gate state, trusted-device counts, pending approvals, WhatsApp and Telegram connector state, channel-evidence counts, and privacy-mask readiness. It does not expose secrets or claim external delivery. Deployment feature flags and provider credentials remain environment-managed rather than editable as arbitrary admin values.

## Personal Telegram linked device

Kurukoo now has a separate personal Telegram MTProto linked-device boundary. It is deliberately distinct from the Telegram Bot API webhook adapter. The central Connect workspace renders WhatsApp and Telegram pairing panels using the shared linked-device styling and central workspace architecture.

The Telegram API boundary is:

```text
GET  /api/telegram-linked-device/status
POST /api/telegram-linked-device/start
GET  /api/telegram-linked-device/pairing-qr
POST /api/telegram-linked-device/stop
POST /api/telegram-linked-device/logout
```

The connector uses the maintained `teleproto` package, persists a StringSession only under `.data/telegram-linked-device`, and is disabled unless the explicit deployment flags, API ID, API hash, and owner phone are present. It accepts direct inbound messages only by default, ignores self messages and status broadcasts, keeps group messages disabled by default, records bounded channel evidence, and routes accepted text into canonical Chat rather than creating a Telegram-specific Chat engine.

The personal Telegram path is therefore:

```text
Telegram QR-linked session
→ inbound direct message
→ bounded Telegram channel evidence
→ canonicalChatTurnService
→ existing FastText / SmolLM2 / hosted policy
→ Telegram reply
→ Coordinator chat.turn.completed telemetry
```

A real QR scan, Telegram API credentials, possible Telegram two-step password, and real inbound/outbound exchange remain required before activation can be described as connected.

## Privacy number masking

Privacy number masking is not an authentication replacement. It protects provider-facing communication after a canonical request has been authorized. The execution connector allocates an owner-scoped proxy mapping through `privacyBridge` when `FF_PRIVATE_NUMBER_MASKING=true` and the masking provider boundary is configured. The execution request stores the proxy contact for provider-facing routing while the real owner number remains protected inside the canonical service boundary.

The mapping lifecycle is:

```text
authorized execution request
→ owner-scoped proxy allocation
→ provider-facing execution uses proxy contact
→ callback/status resolves proxy to the canonical owner internally
→ mapping expires or is explicitly released
→ privacy.number_mapping.released Coordinator event
```

Direct replies to the user’s own WhatsApp, Telegram, SMS, or email channel are not masked because those channels already address the user through the verified or observed channel boundary. Provider, seller, delivery, callback, IVR, and other external execution contacts are the masking target. The system must not display a proxy as proof of phone ownership, and it must not claim that a provider call or message was delivered without provider evidence.

The current privacy state is manageable from admin readiness, while actual provider-owned proxy number allocation, voice/SMS routing, consent, retention, and delivery evidence remain external activation requirements.


## Phone OTP delivery truth

Phone OTP generation, hashed storage, expiry, attempt limits, and verification are implemented. An OTP-specific phone delivery adapter is not currently wired. The Africa’s Talking credentials configure the separate SMS/USSD channel boundary, and WhatsApp credentials configure the WhatsApp channel boundary; neither is treated as evidence that a phone OTP was delivered.

In development, a code may be returned only when the controlled debug/test gates are enabled. In production, Kurukoo must not expose the code and must not claim that it was sent until an approved phone-OTP delivery adapter returns an accepted provider response. Email OTP through Resend is the currently implemented low-cost external delivery alternative and still preserves phone as the primary communications identity.
