# Kurukoo QR Context Architecture

## Product boundary

QR is a **contextual entry mechanism** for the one Kurukoo conversation. A physical sign, referral, contributor invitation, network capability, offer, product, location, or truthful channel invitation can open `/start`, which redirects to `/chat` with validated context. QR is not authentication, payment, a Points engine, a referral engine, a channel adapter, or a marketplace.

```text
QR or deep link → validated context → existing guest chat → text or voice
→ FastText and intentRouter → existing skill / assistance / Economic Request
→ existing authentication, referral, payment, execution, and fulfilment boundaries
```

## Context model

`QrContext` is the shared semantic representation. Its supported types are `referral`, `contributor`, `network`, `offer`, `product`, `location`, `channel`, and `public`. Context values are length-limited, type-validated, and never contain a cookie, OTP, password, API key, payment credential, raw personal data, or session token.

A QR URL contains only safe public context such as `/start?context=offer&entity=phone-repair`. Signed opaque contexts are available through `qrContextService` for future cross-device continuation; they expire and reject tampering. Scanning never creates an Economic Request or awards Points.

## API and UX

| Surface | Role | Boundary |
|---|---|---|
| `GET /start` | Validated redirect to the canonical chat shell | Passes only whitelisted, bounded context values. |
| `POST /api/qr/activate` | Adds a contextual greeting to the existing guest or authenticated conversation | Creates no new QR conversation or request. |
| `POST /api/qr/generate` | Authenticated creation of a user’s referral or safe contextual QR SVG | Uses the current session only; cannot generate another user’s personal referral QR. |
| `/referral-qr/` | Generator and local QR-image scanning surface | External/unsupported scanned URLs are not opened automatically. |

The chat keeps one visible contextual-arrival banner and one persisted assistant greeting. The standard microphone remains available, so a user can scan then continue by text or voice without switching product surfaces.

## Referral and Points

A referral QR identifies a referral code but does not award anything on scan. The QR greeting metadata migrates with the existing guest conversation. After successful normal name–phone–OTP authentication, `applyQrReferralAttribution` uses the existing referral service to register valid attribution. Existing referral qualification and Points rules remain the only authority for a reward.

## Channel truthfulness

Channel QR context starts a contextual Kurukoo conversation. It does not claim WhatsApp, Telegram, SMS, or USSD is connected unless the existing adapter is truly configured. The current web channel is available; other channel labels continue to follow the existing channel registry’s truthful availability state.

## Voice relationship

Web Voice is another interface to the same active chat conversation. It is not telephone calling, IVR, WhatsApp voice, Telegram voice, or a separate voice request system. A QR arrival can therefore be discussed with the existing chat microphone and will route through the same FastText, intent router, skills, and Economic Request lifecycle.

## Security checks

The implementation validates context type, channel, parameter lengths, HMAC signature when used, same-origin scanned URL, and route ownership. It does not persist raw image data, audio, provider credentials, ephemeral voice tokens, or authentication material in QR metadata.
