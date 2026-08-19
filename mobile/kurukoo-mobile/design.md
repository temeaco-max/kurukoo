# Kurukoo Mobile Interface Design Plan

## Product direction

Kurukoo Mobile is a conversation-first operating system for getting practical things done. The native app shares the web OS visual language while adapting it to portrait use, one-handed reach, safe-area insets, native sheets and platform navigation.

## Screen list

| Screen | Primary content and functionality |
|---|---|
| Welcome / Chat | Warm welcome from Agent, recent context, quick prompts and the composer for natural requests. |
| Active conversation | User and Agent messages, action proposals, exact-object confirmations, continuation and notification states. |
| Requests | Open, waiting, completed and cancelled requests with status and Continue in Chat. |
| Reminders | Reminder list, reminder detail, pause/edit/cancel actions and notification continuation. |
| Discover / Nearby Radar | Approximate-location map/list, source-attributed entities, Radar state and low-bandwidth mode. |
| Tasks | Active, paused, waiting and completed goals with pause/resume/cancel controls. |
| Connect | WhatsApp, Telegram, email and other channel readiness with truthful activation states. |
| Memory | Provenance-backed memories, in-use context, revocation and privacy controls. |
| Safety | Safety check-ins, emergency access, trusted contacts and protective interruptions. |
| Cart / Checkout | Sourced offer, seller/provider provenance, request review, payment boundary and order tracking. |
| Notifications | Internal notification queue, provider-pending states and Continue in Chat. |
| Settings | Profile, country, language, notification preferences, privacy, security and appearance. |

## Key user flows

### Conversation to action

User opens Chat → Agent welcomes the user → user describes a need → Brain arbitrates context → Agent proposes the relevant capability → user clarifies or confirms → canonical service executes or queues the action → notification appears in place → user continues in the same conversation.

### Request to provider network

User asks for a product or service → Kurukoo shows a sourced offer or creates an Economic Request → provenance and price state are visible → user confirms the request → provider/opportunity lifecycle advances only with evidence → user receives internal progress notifications → final external delivery or fulfilment is shown only when independently evidenced.

### Nearby Radar

User opens Discover → app explains approximate location → user enables Radar or chooses list mode → source-attributed discoveries appear → selecting an entity opens the exact canonical context → a provider may Go Live only after explicit location consent → discovery lifecycle remains separate from claimed/verified provider status.

### Authentication and trusted device

Guest starts Chat → private mutation requires progressive identity → user completes the available verification path → trusted-device state is shown in Chat → conversation resumes without sending the user to an unrelated page.

## Visual system

The mobile brand uses warm cream `#F7F2EC`, raised white `#FFFFFF`, charcoal `#24221F`, terracotta `#B95D3C`, muted text `#6D665F` and soft border `#E6DED5`. Inter is used for body/UI text and Space Grotesk for display headings. Primary touch targets are at least 44pt, cards use 14–16pt radii, and spacing follows a 4pt rhythm. Motion is restrained to 80–300ms transitions with reduced-motion support.

## Platform adaptations

On iOS, use native-feeling bottom sheets, safe-area-aware composer placement, swipe-back navigation, SF Symbol-style icon semantics and notification continuation. On Android, use predictable back behavior, Material-compatible touch feedback, adaptive system bars, native notification actions and lower-bandwidth list/map alternatives. Both platforms keep the same canonical state vocabulary and Chat ownership.
