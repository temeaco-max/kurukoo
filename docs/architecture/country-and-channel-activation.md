# Kurukoo country and channel activation boundaries

## Countries

Kurukoo's canonical `CountryExperience` authority now models five country targets:

- `ng` — Nigeria — NGN — 112
- `gh` — Ghana — GHS — 112
- `gb` — United Kingdom — GBP — 999
- `ca` — Canada — CAD — 911
- `us` — United States — USD — 911

Country support is a configuration authority, not a claim that every external fulfilment rail is live in every market. Payment, channel, regulatory, provider and fulfilment activation remain independently gated.

## WhatsApp

Kurukoo has two intentionally separate WhatsApp paths:

1. `whatsapp-linked-device` — the controlled linked-device/pilot continuity path. It uses the existing linked-session lifecycle and is not equivalent to the official WhatsApp Business Platform.
2. `whatsapp-business` — the official Meta Graph API boundary. It uses explicit business credentials, webhook verification, HMAC signature verification, canonical Chat ingestion and externally evidenced outbound message IDs.

Neither path may claim successful external delivery from configuration alone.

Business activation requires:

- `FF_WHATSAPP_BUSINESS=true` (or the existing canonical WhatsApp feature flag)
- phone number ID
- access token
- app secret
- webhook verify token
- public HTTPS callback
- real inbound webhook evidence
- real outbound receipt/evidence
- retry/idempotency/recovery verification.

The linked-device path must not be used as a production claim for official WhatsApp Business Platform availability.
