# Route-System Browser Validation — 2026-08-22

## Scope

This evidence log records controlled local browser observations of the merged current-main route system. It distinguishes repository behavior from real-world/provider activation and does not claim external delivery, payment, device, or fulfilment success.

## Authenticated Tasks Observation

| Area | Observed result |
|---|---|
| Authenticated header | The shared header rendered Search, Points, Cart, notification bell, context, workspace, and account controls. The notification control exposed the canonical bell, an unread count, and an accessible unread label. |
| Shared navigation | Desk, Discover, Requests, Tasks, and Connect appeared in the primary workspace navigation; Tasks was visibly active. |
| Tasks state | The route rendered the dedicated Available work, In progress, and Completed metrics together with its canonical work queue. |
| Lifecycle persistence | The controlled local record appeared as **Completed** after its previously verified canonical `available → in_progress → completed` transition. It retained a source-aware continuation action instead of inventing a local completion state. |
| Truth boundary | The card explicitly identified the record as a local-only controlled validation item. No external work, provider, payment, or fulfilment outcome was implied. |

## Constraints

This is browser evidence in a controlled local development session. Physical-device layout, external payment/provider states, linked-device delivery, installed PWA behavior, and real notification delivery remain separate activation boundaries.

## Route-owned Requests and Connect Validation

| Route | Controlled authenticated runtime evidence | Result and boundary |
|---|---|---|
| Requests | The generic fallback was replaced by a dedicated three-metric lifecycle workspace with canonical `/api/chat/economic-requests` hydration. The empty route rendered `0` for active, action-required, and completed metrics, with an explicit Chat continuation and no claim of provider, payment, booking, or fulfilment success. | **Repository and controlled-runtime verified.** This test did not create or settle an Economic Request and therefore is not external fulfilment or payment evidence. |
| Connect | A single route-owned resource workspace replaced the generic fallback and duplicate extension path. Google Drive, Sheets and Notion rendered truthful `Not configured` states. Microsoft Calendar and OneDrive rendered explicit `Unavailable` because their endpoints were unreadable in this runtime; no connection was inferred. | **Repository and controlled-runtime verified for truthful readiness states.** External OAuth, provider callbacks, connected-source access, pairing, device delivery and notification receipt remain unverified. |

After cache-versioned visual authorities loaded, controlled desktop inspection at a 1280px viewport verified a three-column Connect provider grid with five discrete cards. Each card retained readable status text; none exposed a compressed provider action. The route’s responsive rules retain a two-column composition between 700px and 992px and a single-column composition below that threshold; representative narrow-width validation remains part of the final cross-route pass.

## Notifications and Reminders Observations

| Route | Controlled authenticated runtime evidence | Boundary |
|---|---|---|
| Notifications | The shared header bell retained its unread count and accessible unread label. The route displayed a canonical notification card with a visible **Mark as read** control and an explicit Web/PWA/native state boundary. | The visual state and local control presence are verified. Device permission, push transport, delivery and receipt remain unverified. |
| Reminders | The route rendered its canonical create form with labelled reminder, datetime and optional-note inputs, a 44px primary creation control, an explicit empty state, recovery context and a continuation link. | UI and owner-scoped empty-state rendering are verified. This observation did not create a new reminder or verify background scheduling, notification delivery or device receipt. |

## Chat Continuation Surface Observation

The authenticated Chat surface rendered the canonical conversation-first composition with a visible notification bell and unread count, Points and Cart controls, 44px quick actions, accessible compose controls, a context inspector, and a retained local-only completed task trace. The Chat inspector explicitly labels WhatsApp and Telegram as setup-required and states that safety contact delivery needs a configured delivery service. This verifies controlled web rendering and shared control geometry only; it does not verify external channel pairing, physical-device behavior, message delivery, or safety-contact notification receipt.

## Agents and Memory Observations

| Route | Controlled authenticated runtime evidence | Boundary |
|---|---|---|
| Agents | The owner-scoped agent runtime rendered its explicit empty state and a 44px path to start an agentic task in Chat. The copy keeps runtime execution bounded by canonical policy and evidence. | No agent goal was created, started, paused, resumed, cancelled, or observed executing. |
| Memory | The Memory route rendered the authenticated test profile and named owner-scoped fields with a visible save control, alongside its cross-client state boundary. | The existing local profile record was observed but not changed. No native-client sync or cross-device persistence was verified. |
| Safety | The route initially exposed visually blank trusted-contact and check-in panels when their canonical arrays were empty. The route runtime now renders clear owner-controlled empty copy in both panels, including the boundary between stored check-ins and external delivery or receipt. | No safety contact, consent activation, revocation, check-in completion, emergency-service action, delivery or receipt was performed or claimed. |

## Checkout and Confirmations Observations

| Route | Controlled authenticated runtime evidence | Boundary |
|---|---|---|
| Checkout | The route exposed no payment-start action because the canonical request authority returned no payable request. Its empty state and recovery copy explicitly keep payment readiness separate from completion. | No payment intent, payment method, settlement, provider callback or fulfilment outcome was created or verified. |
| Confirmations | The canonical request-history surface rendered an explicit empty state with lifecycle and recovery language rather than synthesizing a confirmation. | No actual confirmation, payment receipt, provider state or real-world fulfilment is implied. |

## Saved and Cart Observations

| Route | Controlled authenticated runtime evidence | Boundary |
|---|---|---|
| Saved | The owner-scoped Saved surface rendered its explicit empty state, a 44px continuation action, and a secondary card that asks the user to refresh availability and evidence before creating an Economic Request. | No saved record was created or removed in this observation. Source availability and downstream economic state remain independently canonical. |
| Cart | The review-cart surface rendered an explicit empty state and an evidence-gated checkout boundary that distinguishes pending, failed and cancelled outcomes from completion. | No item was added, removed, associated with a request, or sent to payment. This is not payment, settlement, provider or fulfilment verification. |

## Resolved Discovery Notes

The initial current-main audit found Requests on a generic lifecycle fallback and Connect with crowded provider controls. Those findings drove the route-owned implementations documented above. They are retained only as the discovery record for this completion pass, not as current implementation status.

The shared notification bell continued to expose an unread count and accessible label throughout the before-and-after observations.

## Current-Main Discover Responsive Observation

The controlled authenticated Discover route rendered the shared header, canonical Nearby Pulse empty state, opportunity links and explicit Chat activation path. At the observed 1280px browser viewport, the route's outer `.k-app-grid.two` measured 905px with two 444.5px columns, but the nested Nearby and Opportunities cards each measured only 191px wide while their parent visual region measured 445px. The nearby activation button measured 145×75px and opportunity links met or exceeded the shared 44px target. The nested column compression is a repository-side responsive composition gap; it does not indicate provider availability, location activation, offer validity, or external delivery.

| Evidence level | Result |
|---|---|
| Controlled browser layout | Shared shell and current Discover rendering observed; nested cards compress at the inspected intermediate content width. |
| External system state | No location permission, Nearby Pulse activation, provider availability, source transport, or downstream delivery was initiated or verified. |


The DOM measurement identifies the immediate layout mechanism: outer Discover cards measured 445px, but nested `.k-action-row` containers computed as `display: block` with a 145.25px computed width despite inline `flex-direction: column; align-items: stretch`. Nested opportunity surfaces therefore inherited a 145px content width. This is a shared action-row sizing conflict in the existing authenticated visual stack, not a lack of canonical Discover data.

A second DOM inspection refines the root cause: Discover has an outer 905px two-column grid (two 445px cards) and a nested `.k-app-grid.two` inside the first 445px card. That nested grid is 399px wide, creating two 191.25px tracks for Nearby and Opportunities. The route’s browser-visible compression is therefore a nested two-column composition at insufficient available width. The correction should change only that Discover inner composition to a truthful single-column stack at this container width, while preserving the outer page grid and canonical source/action behavior.

After the route-owned correction, the nested Discover grid measured one 905px track with its two cards at 905px wide. The continuation links measured 44px high (Open Chat, Explore Topics, Explore Nearby and Open Opportunities). Controlled browser rendering therefore verifies the repository-side nested-grid correction and preserves the existing external boundaries.

## Current-Main Call and Capabilities Observations

| Route | Controlled browser evidence | Boundary |
|---|---|---|
| Call | The shared authenticated shell rendered two readable 44px-aware voice and peer-communication cards. Copy explicitly distinguishes Web Voice as a Chat interface and names relay/provider readiness as an external dependency. | No microphone permission, voice session, WebRTC signalling, relay, peer connection, provider activation, or physical-device behavior was initiated or verified. |
| Capabilities | The authenticated capability portfolio rendered its owner-scoped loading and explicit empty state without a generic card overwrite or misleading role claim. | No capability was registered, enabled, exercised, or observed across a provider/device boundary. |
