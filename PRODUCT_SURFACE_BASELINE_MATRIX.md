# Kurukoo Product Surface Baseline Matrix

**Date:** 2026-08-13
**Scope:** Product-wide conversation-first UI/UX completion brief in `pasted_content_28.txt`
**Authority:** The live route registry and canonical services take precedence over historical blueprint wording when they differ.

## Baseline and branch findings

The repository already contains a substantial conversation-first product shell. The authoritative public router owns `/chat`, authenticated workspace routes, discovery, channels, network, resources, and account continuation. The current chat client already supports guest conversation, in-chat identity state, OTP handoff, request/storefront cards, context-aware suggestion bars, native reminders, safety check-ins, request history, and a collapsible workspace shell. The existing provider/economic boundaries remain canonical; no category-specific request, cart, provider, or reminder engine is warranted.

PR #23 is merged into `main`. PR #25 is open against `main`. The designated PR #31 is open from `integration/main-convergence-audit` into `integration/near-completion`; its current GitHub merge state is dirty and must be resolved before the integration pull request can merge. Existing prior frontend branches are already contained by neither `main` nor `integration/near-completion` according to the local ancestry check, so their work must be handled through the current convergence branch rather than duplicated.

## Capability matrix

| Product capability | Existing backend / canonical owner | Existing frontend | Status | Reuse / implementation decision |
|---|---|---|---|---|
| Conversation-first guest entry | `chatRouter`, guest session migration, `conversationalAuthService` | `/chat` accepts guest conversation; identity gates appear inline | **Partially complete** | Keep the chat-first flow. Upgrade the inline OTP card to the established six-digit, resend, and change-number interaction rather than redirecting to another identity product. |
| Account continuation | `authRoutes`, OTP service, guest migration | `/login` is a compact name → phone → OTP continuation screen with return context | **Implemented** | Preserve `/login` for recovery/deep links. Harmonize its presentation with in-chat identity; do not duplicate auth routes. |
| Kurukoo identity and avatar | Shared brand assets and SVG icon sheet | Chat/sidebar/header largely use logo asset; residual `K` alt/text placeholders remain | **Partially complete** | Normalize every assistant/avatar/fallback to the canonical logo and semantic icon system. |
| Workspace / request hub | Canonical Economic Request APIs, reminder/safety/points services | `/chat` sidebar and `/requests` through `/settings` workspace templates | **Implemented, uneven depth** | Keep one chat plus workspace shell. Improve data-backed request tracker and truthful empty/preview states; do not create another dashboard. |
| Dynamic context inspector | Economic Request, reminders, safety, agent goal services | Right inspector has request/points/memory/reminder/safety/goal panels | **Partially complete** | Make the primary card and header state reflect the actual canonical request stage. |
| Intent suggestions | FastText/router metadata and response cards | Reusable `renderSuggestions` bar is present | **Partially complete** | Reuse the bar and improve only the server-provided category metadata and visual semantics; no duplicated hardcoded category strip. |
| Product/service cards | Canonical storefront / Economic Request cards | Provider offers, quotes, participants and action buttons render in chat | **Partially complete** | Add consistent availability/price/quote-state semantics and no-inventory/no-payment disclaimers where data is absent. |
| Cart surface | Existing cart route and request/storefront context | `/cart` has truthful visual placeholder and summary boundary | **Visual shell complete** | Keep it as a review surface. Do not fabricate inventory, subtotal, checkout, payment, or fulfilment. |
| Request / fulfilment timeline | `skillFlows.ts` Economic Request lifecycle | `/requests` lists canonical request states; chat shows storefront progression | **Partially complete** | Add a shared visual timeline driven by existing states without adding a lifecycle or changing transition policy. |
| Deferred requests | Open-intention and background-worker services | Deferred-status area and request copy exist | **Partially complete** | Expose the established awaiting-match / partially-matched controls visibly and truthfully. |
| Reminders | `reminderService`, owner-scoped reminders API | `/reminders`, workspace cards, inspector, chat creation/cancellation | **Implemented, incomplete controls** | Reuse the service. Surface status filtering and edit/snooze only when the existing API supports it; otherwise label as unavailable. |
| Safety / emergency contacts | `safetyService`, owner-scoped safety routes | Inspector and `/safety` views with consent/revoke actions | **Implemented** | Retain the non-emergency and no-delivery-adapter boundary. Improve clarity and iconography only. |
| Channels | Channel capability services and deployment flags | `/channels` and chat sidebar accurately mark Web active, other adapters not connected | **Implemented** | Retain current truthful status; remove residual text-glyph channel icons. |
| Sponsored placements / proactive cards | Ads manager, daily picks, notification/proactive data | Controlled empty ad area and dismissible proactive prompt in workspace | **Visual framework complete** | Use clearly labelled preview/empty states. Do not imply active campaign inventory or target users without data. |
| Daily Picks | Existing daily-picks and profile/request/reminder sources | `/daily-picks` summarizes requests/reminders with sponsored placeholder | **Partially complete** | Extend the existing source-backed surface rather than inventing a new recommendation engine. |
| Discover | Discovery route / map APIs and verified provider policy | `/discover` map and cards exist | **Implemented, needs polish** | Preserve data-backed markers and privacy language; remove decorative fake-live signals. |
| Network | Provider, business, contributor, AI-agent concepts | `/network` cards exist but are lightweight and emoji-led | **Partially complete** | Improve visual presentation of the existing Network concept without creating a directory or claiming availability. |
| Resources | Resources routes / content APIs | `/resources` and articles exist with meaningful destinations | **Implemented, compact taxonomy** | Extend only route-backed groups and remove dead/unregistered links. |
| Settings / profile / memory | Profile, memory, notification, channel, auth services | `/settings` and `/memory` have truthful account cards and placeholders | **Partially complete** | Improve the account workspace with existing controls; mark unsupported export/deletion/editing controls unavailable rather than faking actions. |
| Points | `pointsEngine` and balance API | `/points`, chat header, inspector balance | **Implemented** | Preserve closed-loop, non-fiat wording and deployment availability guard. |
| Tasks / contributors | `microTasks` and task routes | `/tasks` visual preview cards | **Visual shell complete** | Use only clear preview/availability states until task activation is data-backed. |
| Public homepage | Public router and shared public styles | Homepage implements CTA, demo storefront, network/memory/discovery/channel sections | **Partially complete** | Reconcile headings, CTA, terminology and semantic icons with `homepage_copy.md`; preserve no-fabrication preview policy. |
| Responsive/accessibility system | Shared CSS tokens and existing contracts | Site, chat, workspace, auth CSS use shared fonts/tokens | **Partially complete** | Verify 360–1440px fresh runtime behavior; remove mixed text-glyph icons and retain keyboard/focus/touch safety. |
| Public terminology | Copy references and route-backed templates | Most paths say Kurukoo and Web Chat; homepage retains “fulfillment & Orchestration network” | **Partially complete** | Remove internal “Economic OS”, generic bot, unjustified marketplace/guarantee, and unsupported channel/payment/dispatch language from user-facing surfaces. |
| Hardware, dispatch, payment, external messaging | Connector/payment/channel adapter boundaries | Some historic blueprint language exists, but live surfaces generally explain constraints | **Disabled / external dependency** | Do not represent these capabilities as operational without configured adapters and evidence. |

## Prioritized non-duplicative scope

The first implementation batch should converge the canonical chat, workspace, and public shell: semantic brand/avatar reuse, in-chat identity card controls, dynamic request context/timeline rendering, shared icon use, sidebar/account consistency, and terminology/CTA correction. The second batch should deepen the existing workspace sections using live request, reminder, safety, points, and daily-picks APIs where available, while maintaining clearly marked preview states for unimplemented functions. No new request, provider, catalogue, payment, reminder, notification, task, memory, cart, discovery, or channel engine is justified by the evidence.

## Explicit truthfulness boundaries

The UI must continue to distinguish public/provider record from verified/provider-owned data; listed rate from confirmed quote; accepted quote from payment, booking, dispatch, or fulfilment; internal notification from external delivery; and channel setup preview from a configured channel adapter. Web Chat is the active deployment channel. WhatsApp, Telegram, SMS, and USSD remain not connected. Payment, regulated escrow, delivery/dispatch, emergency notification, hardware control, and autonomous execution must remain disabled or conditional until their real integrations are configured and produce evidence.

## Source evidence

| Evidence source | Verified finding |
|---|---|
| `src/routes/publicRoutes.ts` | Single public route owner for chat, workspace, channels, discovery, resources, account continuation, and public pages. |
| `public/chat/index.html` and `public/js/kurukoo-primary-chat.js` | Existing conversation-first workspace, native assistance, requests/cards, identity card handling, suggestions, and logo assets. |
| `views/workspace.ejs` and `public/js/kurukoo-workspace.js` | Shared authenticated workspace and canonical request/reminder/safety/points API consumption. |
| `views/login.ejs` and `src/services/conversationalAuthService.ts` | Existing continuity-friendly OTP flow and in-chat auth state machine. |
| `BLUEPRINT_IMPLEMENTATION_ADDENDUM.md` | Canonical Economic Request, truthfulness, conversation-first, and no-parallel-engine mandates. |
| `FRONTEND_PAGES.md` and `homepage_copy.md` | Current public page ownership, no-fabrication copy policy, channel boundaries, and shared style requirements. |
| GitHub PR inspection | PR #23 merged; PR #25 open; PR #31 is the designated open integration vehicle and needs merge-conflict resolution. |

*This internal baseline deliberately records implementation truth rather than treating a historical blueprint entry as proof that a capability is active.*
