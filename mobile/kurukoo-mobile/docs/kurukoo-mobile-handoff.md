# Kurukoo Mobile Handoff

## Canonical context continuity

The native Chat and Tasks surfaces share one `KurukooContextProvider` mounted in `app/_layout.tsx`. It owns the active canonical task context and paused task identifiers. A task opened from Tasks enters Chat with its exact `{ kind, id, title }` identity; Chat does not infer or replace that identity by recency or generic similarity.

Task pause/resume and active-context state are persisted locally through AsyncStorage under `kurukoo.mobile.context.v1`. This is deliberately a **device-local continuity layer**, not a claim of server synchronization or cross-device durability. Cross-device task truth remains a future integration with Kurukoo's canonical backend services.

## Current flow

`Tasks → Open in Chat → setActiveTask(task) → Chat renders exact task context → Clear context`.

Pause/resume changes only the selected task identifier and leaves another active task context untouched. Malformed persisted state fails closed to an empty context. The native app does not create a second Chat engine, task engine, or provider execution path.

## Validation

The deterministic suite covers exact task identity preservation, isolated pause/resume updates and malformed-state fallback. The project must continue to pass `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm exec expo export --platform web` before each checkpoint.

## Remaining activation boundary

The current implementation is repository-side complete for local native continuity and first-launch verification-state gating. It does not claim live synchronization, push delivery, external messaging, provider fulfilment, payment success, or completed external device-link delivery. Those remain ready for external activation through the existing server/API seams when credentials, policy and real-device evidence are available.

## Local notification boundary

Tasks can request a local reminder through `lib/notifications.ts`. The payload is built by the pure `notification-contract` module and contains only an allowlisted task continuation kind, exact task identifier, title and the `/ (tabs)` Chat route. The root response observer validates this shape before restoring the task context and navigating to Chat.

This is local scheduling only. It does not claim Expo push delivery, FCM, APNs, background server execution or remote notification delivery. Those capabilities remain disabled until a development/release build, device registration, provider credentials and physical-device evidence are available. Web behavior fails closed with a truthful unavailable status.

## Device-token readiness boundary

Connect now exposes a device-readiness check for Email and push. The check reports web unavailability, missing permission, missing EAS project identity, physical-device/build requirements, or a token prepared for backend registration. A token-ready result is **not** a delivery or connection claim; the token is not automatically sent to a server in this repository.

Remote notification activation still requires a configured backend registration endpoint, secure token storage and ownership binding, FCM/APNs or Expo service credentials, platform registration, and real-device delivery evidence. The app deliberately reports these as readiness states rather than presenting them as live capabilities.

## Requests and Reminders local continuity

Requests and Reminders now persist only their paused item identifiers through `kurukoo.mobile.work-surfaces.v1`. The pure `work-surface-state` contract deduplicates and bounds identifiers and fails closed for malformed state. This is local continuity for the native surface; it does not claim backend synchronization, remote reminder delivery, provider fulfilment or cross-device durability. The existing Chat surface remains the return destination and no second request, reminder or notification authority is introduced.

## Reminder editing and runtime warning boundaries

Reminders now expose local title, context and 24-hour time editing. Drafts are stored under `kurukoo.mobile.reminder-drafts.v1` and validated locally before being presented as saved; malformed drafts fail closed. This remains device-local continuity and does not claim remote notification delivery.

The shared card primitive now uses `boxShadow` instead of deprecated shadow props. Expo Notifications is lazy-loaded only on native inside the existing root observer, so web does not initialize the response listener or push-token path. The remaining `pointerEvents` warning is emitted by the managed React Native Web/runtime dependency rather than an application-owned selector and requires a dependency-level upgrade when the shared runtime owner changes.

## Complete canonical visual-family coverage

The mobile adaptation now exposes the canonical visual families through one shared surface dispatcher and the existing Chat, Discover, Tasks and More authorities. Web Chat is owned by the primary Chat route; Nearby Radar by Discover, Go Live and discovery detail; Checkout and Confirmations by the sourced-offer and confirmation surfaces; Partners, Agents and Admin by `/surface/[kind]` with `partners`, `agents` and `admin` kinds; Connect, Memory and Safety use the same dispatcher; Requests and Reminders use their dedicated detail owners; and Tasks remains the persisted task-continuity authority.

The mobile adaptations intentionally preserve the canonical truth boundaries rather than pretending desktop-only operational services exist locally. Each surface has a visible Back to Chat path, shared status language, evidence/next-state sections, a governed primary action, and no external success claim without independent provider evidence. More exposes every role-specific surface so each canonical family is reachable end-to-end.

## Trusted visual comparison and final tuning

The final mobile tuning was compared against the canonical Web Chat and Nearby Radar screen sets. Chat now keeps the Ask composer persistently visible above tab navigation, preserving the canonical primary action authority while the conversation and Context panel scroll independently. Nearby Radar and Go Live preserve the canonical Radar active state, Map/List and source filters, approximate-location explanation, consent boundary, broadcast attribution, review state and lifecycle vocabulary. Consent now uses the shared checkmark icon authority rather than placeholder text.

The final authority scan reports no platform-default System typography, invented chevron/arrow/bullet controls, or duplicate checkbox label treatment in application surfaces. Type-check, lint and tests pass. Managed Expo preview capture intermittently exits during Metro restart; this is a runtime capture limitation rather than an application validation failure, and the latest successful portrait captures cover Chat, Discover, Go Live, More, Requests, Reminders, Tasks, Admin, Checkout and Confirmation.

## Native reminder controls and device QA boundary

Reminders now use the Expo SDK 54-compatible `@react-native-community/datetimepicker` on native platforms and a validated ISO date field on web. Drafts persist date, time, title, and context locally. The Schedule on device action requests local notification permission and schedules only a future date trigger on the physical device; it reports local scheduling readiness and never claims remote delivery or provider fulfilment.

Deterministic tests cover date-bearing draft round trips, malformed-state rejection, future-date validation, title/context requirements, and 24-hour time validation. A physical iOS or Android build remains required to verify the native picker surface, notification permission prompt, and notification appearance after app relaunch. The remaining `props.pointerEvents` warning is emitted by the Expo SDK 54 / React Native Web managed dependency chain (`react-native-web` is pinned through Expo Router); changing it independently would risk an unsupported dependency combination, so it remains explicitly dependency-owned until the shared runtime is upgraded.

## Canonical visual parity pass

The canonical Agents, Partners, Checkout, Confirmations, Nearby Radar and Web Chat sets were re-read as strict visual authorities. The mobile implementation now has family-specific adaptations rather than a single generic surface summary: Agents includes directory filters, owner/risk/status/autonomy metadata, policy-reviewed goal rows and active goal queue; Partners includes onboarding steps, capability strength, availability chips, opportunities and impact metrics; Checkout includes the four-step request journey, cart/provenance, price and payment boundaries; Confirmation includes prepared and accepted-internally states, object list, lifecycle timeline and evidence; and Notifications includes pending, verified, not-delivered and prepared cards with Continue in Chat and truthful Retry behavior.

The canonical frontend website set remains a separate desktop web product surface. It is available in the reference repository, but the active project is an Expo mobile app and does not contain a website route tree. Exact desktop website parity therefore requires a separate web project or an attached website checkout; the mobile project should not invent a second desktop implementation authority.

## Exact token convergence pass

The mobile surfaces use the canonical warm palette, Inter body typography and Space Grotesk headings through the shared theme and font authorities. The runtime mark is now unified as follows:

| Surface | Authority | Platform treatment |
| --- | --- | --- |
| In-app mobile BrandMark | `assets/images/kurukoo-logo.png` | Contained image at regular or compact size |
| iOS/Expo launcher and splash | `assets/images/icon.png` and `splash-icon.png` | Full square source; splash uses contain sizing |
| Web favicon | `assets/images/favicon.png` | Same source bytes as launcher icon |
| Android adaptive foreground | `assets/images/android-icon-foreground.png` | Transparent foreground extracted into a 560px safe-area composition |
| Android monochrome | `assets/images/android-icon-monochrome.png` | White mark with the same alpha geometry |
| Desktop website shell and Chat | `client/public/kurukoo-logo.png` | Same launcher source with responsive 28px shell and 20px compact sizing |

The platform crop previews show the mark centered without clipping on iOS contain rendering and fully inside the Android circular mask and safe-area guide. Physical iOS and Android builds remain the final validation step for OS-specific splash scaling and launcher masking.

## First-launch device verification

The mobile app now starts with the canonical first-device verification surface before mounting the Chat/tab navigation. The screen uses the high-fidelity content hierarchy: progress indicator, Kurukoo identity, “Let’s make sure this is your phone,” secure-link explanation, phone/lock illustration, editable email row, terracotta “Verify this device” action, “Not a Kurukoo provider yet” secondary path, and privacy copy.

Completion is persisted locally under `kurukoo.mobile.device-verification.v1`. Only the explicit `verified` and `not-provider` states are accepted; missing or malformed values fail closed back to first launch. The current Verify action truthfully reports that activation is ready but does not claim that a link was sent because the authenticated device-verification callback is not yet connected. The secondary path records `not-provider` and enters the existing Chat surface without presenting provider status as verified. A future authenticated callback can call the same completion boundary with `verified`.

The native configured splash remains a brief asset-loading surface. Expo release-build validation is still required because Expo Go and development builds do not reproduce all standalone splash behavior.
