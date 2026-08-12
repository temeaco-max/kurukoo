# Browser launch findings

## Fresh built runtime

The compiled runtime was built with `npm run build` and served on port 3001. The existing listener returned HTTP 200 for `/health`; the build completed CSS optimization without duplicate top-level production CSS blocks.

## Homepage

The homepage rendered the canonical Kurukoo identity, the primary **Start chatting** CTA, the conversational fulfilment statement, and truthful copy around request capture, confirmation, payment verification, escrow-ledger semantics, provider availability, and external channels. The homepage preview explicitly labels itself as a demo and states that it does not show live provider, inventory, price, or payment state.

## Chat shell

The built `/chat/` shell rendered a single conversation surface with Requests, Reminders, Saved & offers, Cart, Points, Tasks, Discover, Memory, Safety, Settings, Help, voice control, message composer, message pinning, inspector, and logout. Web Chat was shown as **Available now** while WhatsApp, Telegram, and USSD were shown as **Not connected**.

## Conversation-first journey

Sending `I need a plumber in Ikeja tomorrow` as a guest produced a user message, a truthful requirement prompt, and a progressive profile step asking for the user’s name. The response did not claim a provider, quote, payment, fulfilment, or availability. The browser showed the guest-to-profile transition as connected conversation state.

## Progressive-auth interaction

The profile CTA remained visible after the guest request and the chat composer was retained, demonstrating that the request context remains in the same conversation while identity is requested. The page did not reveal a client JWT or claim that OTP delivery had occurred.

## Channels page

The built `/channels` page identified Web Chat as **Available now** and marked WhatsApp, Telegram, SMS, and USSD as **Not connected** with “Connection coming soon” controls. The page explicitly says these channels are not represented as live until their adapters are configured and preserves one account/conversation relationship.

## Responsive and navigation audit

Fresh-build screenshots were generated at 360, 390, 414, 768, 900, 1024, 1280, and 1440 pixels wide. The 360px view showed a single-column mobile layout, a full-width 44px-class Start chatting control, a compact header menu, readable hero copy, and no visible horizontal overflow. The 1440px view showed the desktop navigation, balanced hero layout, canonical logo, primary CTA, and no visible horizontal overflow.

Route probes from the built runtime returned expected results: `/`, `/channels`, `/help`, and `/offline.html` returned 200; `/chat` and `/discover` redirected into their canonical trailing-slash/public flows; authenticated workspace routes returned 302 to login when unauthenticated. No dead response was observed in the tested core surfaces.
