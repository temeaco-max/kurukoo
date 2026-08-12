# Kurukoo QR Context Architecture

## Product boundary

QR is a **contextual entry mechanism** into the one canonical Kurukoo conversation. It is not authentication, a QR conversation engine, a referral engine, a Points engine, a payment mechanism, a marketplace, a channel adapter, or a voice system.

```text
QR scan → /start → signed bounded context validation → existing guest conversation
→ one contextual greeting → text or Web Voice → FastText → intentRouter
→ existing skillFlows → existing Economic Request lifecycle when a user later asks for work
```

A scan has no economic side effect. Only a subsequent ordinary user message can pass through FastText, `intentRouter`, `skillFlows`, and the existing Economic Request lifecycle.

## Reconciliation audit

| Component | Status | Reconciled behaviour |
|---|---|---|
| `qrContextService` | **IMPLEMENTED** | Owns bounded context parsing, credential-like key rejection, HMAC signing, expiry, tamper rejection, opaque entry URLs, contextual copy, and post-auth referral registration. |
| `GET /start` | **IMPLEMENTED** | Verifies an opaque signed context and forwards only `qr` to `/chat`; malformed or expired values redirect to a safe chat error state. |
| `POST /api/qr/activate` | **IMPLEMENTED** | Requires a verified token, reuses the owned canonical conversation, persists one greeting in the existing message ledger, and is idempotent for the same QR activation. |
| `POST /api/qr/generate` | **IMPLEMENTED** | Authenticated generator of a signed `/start?qr=…` URL and QR SVG. Referral codes are created through the existing referral service. |
| `/referral-qr/` | **IMPLEMENTED** | Generates through the canonical API and opens only same-origin `/start` URLs after scanning. |
| `referralService` | **IMPLEMENTED** | Remains the sole referral registration and qualification authority. Its stale parallel QR URL builder was removed. |
| Points | **IMPLEMENTED** | QR activation neither invokes Points nor creates a qualifying referral reward. Referral registration remains `registered` until the existing qualification flow applies a reward. |
| Channel registry | **IMPLEMENTED** | Adapter credential checks determine whether a channel context may say a channel is configured; otherwise it explicitly says the channel is not connected. |
| Chat conversation creation | **IMPLEMENTED** | `ensureConversation` reuses a supplied owned conversation or the current conversation for the same guest/account; no QR-specific conversation table exists. |
| Guest session migration | **IMPLEMENTED** | Canonical conversation and message ownership migrate to the verified phone; browser OTP and in-chat OTP both run post-migration QR referral attribution. |
| FastText and `intentRouter` | **IMPLEMENTED** | QR adds only a persisted contextual greeting. Subsequent text uses the existing classifier and router without a QR intent path. |
| Web Voice adapter | **IMPLEMENTED** | Reads and sends the same `kurukoo_conversation_id`; QR does not modify or duplicate the free browser voice implementation. |

## Context model and security

`QrContext` supports `referral`, `contributor`, `network`, `offer`, `product`, `location`, `channel`, and `public`. Values are type-checked, character-restricted, and length-bounded. The parser rejects unknown keys and credential-like keys, including OTPs, passwords, cookies, session identifiers, API keys, payment credentials, raw contact data, and voice tokens.

Generated URLs use only an opaque HMAC-signed token:

```text
/start?qr=<opaque-token>
```

The token contains a bounded context and expiration timestamp. `/start` and `/api/qr/activate` both verify it, reject tampering or expiry, and never expose raw context values in the URL. QR scanning never opens an external destination automatically.

## Conversation, referral, and Points boundaries

Activation persists the contextual greeting through `appendChatMessage` with QR metadata in the existing `messages` and `chat_message_meta` tables. The metadata includes a non-reversible activation hash; reopening the same QR reuses the same greeting instead of adding another one. The arrival banner is rendered once for the activation and removed from the URL after activation.

A referral QR can register attribution **only after** the guest conversation has migrated through normal verified identity. Both OTP paths call `applyQrReferralAttribution` after migration. That function delegates to `trackReferral`, which records a `registered` referral and does not award Points. Existing qualification is still required before the referral service can upgrade status and award a reward.

## Channel and voice truthfulness

A channel QR remains a contextual web entry. Web is available in the browser. WhatsApp, Telegram, SMS, and USSD are described as configured only when their existing adapters have the required credentials; otherwise the user is told that the channel is not connected and can continue in Web Chat.

Web Voice remains independent of QR. It starts a normal voice session with the active `kurukoo_conversation_id`, so a QR-originated conversation can immediately continue by voice while retaining the same memory, transcript, and request boundaries.

## Validation coverage

`scripts/test-qr-context.ts` exercises all supported context families, signed `/start` handling, expiry and tampering rejection, sensitive metadata rejection, repeated activation idempotence, no scan-time Economic Request creation, no scan-time Points path, same-origin scanning, guest-to-OTP migration, post-auth referral registration, and QR-to-voice conversation handoff.

## Remaining deployment dependencies

QR contextual entry has no external dependency. Channel-context wording reflects configuration only: WhatsApp requires `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`; Telegram requires `TELEGRAM_BOT_TOKEN`; SMS and USSD require the configured Africa's Talking credentials. Web Voice remains available only when its existing server-side Gemini configuration is enabled; the QR flow never creates or exposes a voice credential.
