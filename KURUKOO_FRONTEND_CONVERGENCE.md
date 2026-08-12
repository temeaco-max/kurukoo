# Kurukoo Frontend Convergence — Conversation Workspace

This document records the frontend interpretation of the current Blueprint and product-system map.

## Conversation is the product surface

The Web Chat is the primary authenticated workspace. The sidebar is supporting navigation, not a competing dashboard. Users can start with a request, reminder, safety check-in, sourcing task, discovery request or other intent and remain in the same conversation.

## Workspace navigation

The workspace exposes:

- Conversation history
- Reminders
- Safety & check-ins
- Saved context
- Points
- Channels
- Settings
- Help
- Logout

Reminders and safety links seed natural-language chat requests rather than opening parallel mini-apps.

## Identity

Authentication remains phone/OTP-first. The workspace retains JWT as the signed identity mechanism and uses the HttpOnly session cookie in the browser. Logout ends the session without deleting the Memory Profile or conversation history.

## Channels

Web Chat is the only active channel in the current deployment. WhatsApp, USSD and SMS are represented as doors into the same Kurukoo relationship but are explicitly marked not connected until their adapters are configured. The public Channels page follows the same rule.

## Iconography

`public/icons/kurukoo-icons.svg` is the shared semantic icon layer for the workspace. The Kurukoo favicon/brand asset is used for the assistant and workspace identity. Emoji are not used as the primary PWA/public-site icon system.

## Advertising placements

The current workspace includes a reserved, hidden sponsored context slot (`pwa-context`). Future approved ads can be injected there by the existing ad system. Ads must remain clearly labelled, frequency-capped and excluded from safety, payment and dispute critical paths.

## Ordering and fulfilment cards

Product/fulfilment UI must remain request-linked. Existing storefront cards are the place for offers, requirements, delivery selection and execution evidence. A future catalogue/cart surface may only be introduced when backed by structured inventory and quote semantics; the frontend must not simulate stock, confirmed pricing or payment.

## Global navigation

Public navigation now uses the Blueprint hierarchy: How it works, What you can ask, Discover, Network, Channels, Resources and About. `Start chatting` is the universal primary CTA. Legacy channel-first marketing language such as `Chat on WhatsApp`, `*7000#`, `Start a Free Trial` and `Ask Anything` must not be reintroduced into shared public navigation/footer surfaces.

## Truthfulness

The frontend must distinguish configured capabilities from future integration boundaries. A channel card, provider card, quote, execution reference or availability statement is not itself evidence that an external system is live. The UI should use conditional wording until the corresponding connector/evidence boundary is active.
