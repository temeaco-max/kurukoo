# Kurukoo QR architecture

QR is an entry and continuity mechanism for the existing Kurukoo relationship. It is **not** a second registration, request, payment, referral, points, or channel system.

## Supported context types

A Kurukoo QR may resolve to a public HTTPS URL with an opaque context identifier and optional contextual parameters:

- `public` — generic Kurukoo entry
- `referral` — referral invitation
- `contributor` — contributor onboarding/invitation
- `network` — provider/business/physical-agent/network entry
- `offer` — known offer or promotion
- `product` — product/service context
- `location` — physical Kurukoo location/signage
- `channel` — channel connection hand-off
- `continue` — short-lived cross-device continuation

Example public pattern:

`https://kurukoo.ai/start?context=referral&ref=ABC123`

The client treats these values as context only. It does not grant trust, provider verification, points, payment, account access, or channel connectivity.

## Guest-first onboarding

Scanning must preserve the existing conversation-first identity model:

`scan -> contextual guest conversation -> protected/durable action -> name -> phone -> OTP -> authenticated profile`

A QR code must never contain a password, session cookie, authentication credential, payment credential, or raw personal information.

## Referral integration

The existing referral service remains the authority for referral attribution and Points rewards. QR is only the acquisition/attribution entry point.

`referral QR -> guest conversation -> authenticated identity -> server-side referral attribution -> existing referral/Points engine`

The client must never award Points merely because a QR was scanned or a referral link was opened. Referral rewards must continue to be granted only by the existing server-side referral rules and verified qualifying event.

## Contributors and agent networks

A contributor or agent-network QR can open a contextual conversation:

`QR -> contributor/network context -> Kurukoo conversation -> existing contributor/provider/offer/request capability`

An agent network may distribute or promote a QR for onboarding, a verified campaign, a known offer, or an approved Points-related action. The QR itself does not make the agent verified and does not create a new commerce engine.

If an agent sells a product, service, or Points package, the QR should resolve to the existing offer/Economic Request/cart/payment architecture. Never represent a QR scan as a completed purchase.

## Channels

A channel QR may start a connection hand-off for a user's chosen channel, for example:

`QR -> context=channel&channel=whatsapp -> conversation -> channel connection flow`

`QR -> context=channel&channel=telegram -> conversation -> channel connection flow`

The UI must check the existing channel registry/configuration before saying a channel is connected. If an adapter is unavailable, the product says `Not connected` or `Coming soon`; it must not simulate a successful connection.

## Cross-device continuation

A future continuation QR should contain only a short-lived, single-use opaque server token. Never encode the user's authenticated session or conversation data directly in the QR.

## Security and trust

- Accept only HTTPS Kurukoo URLs and approved Kurukoo hosts.
- Treat all QR query parameters as untrusted input.
- Limit parameter lengths.
- Do not auto-execute payments, dispatches, external calls, or account changes from a scan.
- Show the resolved context before continuing where appropriate.
- Preserve Economic Request and skillFlows as the canonical transaction model.
- Preserve the existing referral, Points, contributor, provider, offer, and channel services rather than duplicating them.
