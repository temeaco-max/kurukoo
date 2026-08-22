# Kurukoo Desk — Screen Convergence Phase 1 Gap List

**Baseline:** `525ce3a4f40012baf4a852864874ef163eba5210`
**Scope:** `/desk` only. No other canonical screen is modified by this phase.
**Reference authority:** `docs/design/KURUKOO_DESK_REFERENCE_BOUNDARY.md` + `src/services/deskVisualFoundation.ts` + `src/services/kurukooOsComponentRegistry.ts`.

## Current ownership

- Route/runtime entry: `src/routes/appSurfaceRoutes.ts::renderApp(section='desk')`
- HTML/template: `views/app.ejs` (the existing authenticated app renderer)
- Desk runtime: `public/js/kurukoo-app-extensions.js` → `public/js/kurukoo-desk-system.js` + `public/js/kurukoo-desk-live-hydration.js`
- Desk CSS: `public/css/kurukoo-desk-system.css` plus existing authenticated app CSS stack
- Shell/header/navigation: `views/app.ejs` with the existing Desk system shell augmentation and authenticated navigation runtime
- Data/hydration: existing canonical services exposed through the existing app route plus Desk point/notification hydration; no new data authority is introduced

## Gap classification

| Area | Classification | Current owner | Target owner | Reason | Other screens affected |
|---|---|---|---|---|---|
| Route/render chain | CORRECT | `appSurfaceRoutes.ts` → `views/app.ejs` | Same | Canonical route already resolves to the frozen Desk renderer | No |
| Header shell | CORRECT | `views/app.ejs` + `kurukoo-desk-system.js` | Same | Existing shell owns Search, notifications, account, points and cart controls | No semantic change |
| Fixed navigation rail | CORRECT | `views/app.ejs` + existing shell CSS | Same | Canonical shared navigation already exists; no duplicate Desk rail needed | No |
| Context continuation | CORRECT | `views/app.ejs` | Same | Desk already routes continuation to canonical Chat | No |
| Desk content hierarchy | MISSING | `views/app.ejs` Desk branch | Existing Desk composition via existing Desk runtime | Current branch only exposes generic Conversation + Continuity cards | Desk only |
| Welcome/personal orientation | MISSING | None | Existing Desk runtime using authenticated identity | Required Desk reference module | Desk only |
| Today's flow | MISSING | None | Existing Desk runtime | Required Desk module and activity-flow semantics | Desk only |
| Continue conversation | MISSING as a dedicated module | Generic continuity card in `views/app.ejs` | Existing Desk runtime | Reference requires a distinct continuation composition | Desk only |
| Active requests | MISSING | None | Existing Desk runtime with `/requests` continuation | Required module; no new request authority | Desk only |
| Tasks & reminders | MISSING | None | Existing Desk runtime with `/tasks` and Chat continuation | Required module | Desk only |
| Opportunity radar | MISSING | None | Existing Desk runtime with `/discover` continuation | Required module | Desk only |
| Points | INCONSISTENT | Desk header hydration only | Existing Desk runtime + existing `/points` authority | Reference requires a content module, not only a header control | Desk only |
| Topics for you | MISSING | None | Existing Desk runtime with `/topics` continuation | Required module | Desk only |
| Guide content | MISSING | None | Existing Desk runtime with existing help/resources continuation | Required module; no new content authority | Desk only |
| Sponsored/provider placement | MISSING | Existing authenticated advertising runtime | Existing Desk composition reusing canonical sponsored semantics | Required reference module; must remain evidence-gated | Desk only |
| Connected channels | MISSING | Existing `/connect` authority | Existing Desk runtime + `/connect` continuation | Required readiness module | Desk only |
| Context right rail | PARTIAL | `kurukoo-desk-system.js` context drawer | Same | Drawer exists but content is generic rather than Desk Pulse/Safety/Activity composition | Desk only |
| Pulse/timeline | MISSING | None | Existing Desk runtime | Required right-rail module | Desk only |
| Safety check-in | MISSING | None | Existing Desk runtime with `/safety` continuation | Required right-rail module | Desk only |
| Activity summary | MISSING | None | Existing Desk runtime | Required right-rail module | Desk only |
| Agent Presence | INCONSISTENT | Existing shell/runtime presence vocabulary only | Existing shared Agent Presence owner | Desk needs state treatment without creating a second presence system | Desk only |
| Semantic state treatment | PARTIAL | Generic app card/status treatment | Existing Desk runtime + canonical state vocabulary | Loading/unavailable/error/recovery should be explicit per Desk module | Desk only |
| Responsive composition | PARTIAL | Existing shared CSS | Existing Desk CSS/runtime | Current generic two-card layout is not the approved Desk composition/density | Desk only |
| Product completeness | CORRECT | Canonical product surface contract | Same | No Desk capability/action is to be deleted to match the reference | No |
| Global token system | CORRECT | Existing canonical token/CSS owners | Same | No visual-token redesign is justified | No |

## Implementation boundary for Phase 1

Only the existing Desk renderer/runtime is extended. No route, template renderer, shared token system, global navigation, Chat surface, or second Desk implementation is created.

The Desk composition must use existing OS visual vocabulary and truthful continuation links. When a supporting data source is unavailable, the Desk presents an explicit unavailable/ready state rather than inventing live availability, payment, provider acceptance, fulfilment or safety delivery.
