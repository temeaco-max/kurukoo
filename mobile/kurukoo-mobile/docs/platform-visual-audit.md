# Kurukoo Platform Visual Audit

The canonical screen-set assets under `Kurukoo-develop/docs/design/assets/` remain the source of truth. The audit below distinguishes implemented visual families from open functional or reference-diff work; it does not claim pixel parity where no exact capture exists.

| Design family | Canonical asset | Current implementation owner | Shared visual authority | Audit result |
|---|---|---|---|---|
| Public frontend website | `kurukoo-frontend-website-set.png` | `kurukoo-website/client/src/App.tsx` | `client/src/index.css` tokens, hero, header, preview, trust, footer rules | Public hero/opening board implemented; dedicated single-frame diff still required |
| Web Chat | `kurukoo-web-chat-set.png` | Desktop `App.tsx`; mobile `app/(tabs)/index.tsx` | Composer, message, source, status, feedback and context selectors | Composer controls and source/status hierarchy implemented; authenticated browser fixture open |
| Admin | `kurukoo-admin-screen-set.png` | Canonical admin route in `Kurukoo-develop` | Admin-specific route styles and aggregate analytics boundary | Admin route and aggregate feedback analytics exist; exact screenshot audit open |
| Agents | `kurukoo-agents-screen-set.png` | Mobile Agents surface and desktop workspace routes | Shared cards, status pills, typography and lifecycle states | Implemented surface family; real data model and exact diff remain open |
| Partners and opportunities | `kurukoo-partners-screen-set.png` | Mobile Partners/Opportunities and desktop workspace routes | Shared page frame, cards, lifecycle/status language | Implemented governed states; real data model and exact diff remain open |
| Nearby Radar | `kurukoo-nearby-radar-screen-set.png` | Mobile Discover/Radar and desktop `/discover` | Radar tokens, privacy/source states, filters and map/list rhythm | Dense Radar workspace implemented; exact viewport diff remains open |
| Checkout | `kurukoo-checkout-screen-set.png` | Mobile Checkout and desktop checkout route | Transactional cards, pending/confirmed/error status hierarchy | Boundary and state treatment implemented; payment-provider integration remains open |
| Confirmation and notifications | `kurukoo-confirmations-screen-set.png` | Mobile Confirmation/Tasks/Notifications | Evidence, receipt, next-action and notification card authorities | Truthful states implemented; exact screen-set diff remains open |

## CSS convergence rule

Application-owned CSS must consume the shared Kurukoo tokens and primitives: warm cream background `#F7F2EC`, surface `#FFFFFF`, terracotta accent `#B95D3C`, ink `#24221F`, muted text `#6D665F`, border `#E6DED5`, success `#2E8060`, and warning `#B87928`. Route-specific styles may control composition, but they must not redefine the palette, logo, typography, status language, focus treatment, or interaction sizing independently.

All interactive controls must preserve a minimum 44px target, visible keyboard focus, reduced-motion behavior, truthful disabled/loading states, and the established terracotta action hierarchy. Shared shell, button, card, status, composer, feedback, and responsive selectors are the convergence layer; a route is not considered complete if it visually matches only through one-off literal overrides.

## Open evidence

The hosted desktop browser fixture currently does not expose the authenticated Chat composer reliably to Playwright. The dedicated hero implementation input must also be a single-frame desktop capture; the first generated diff was correctly rejected because it used a composite multi-surface image. These are evidence and harness gaps, not reasons to weaken the canonical visual system.
