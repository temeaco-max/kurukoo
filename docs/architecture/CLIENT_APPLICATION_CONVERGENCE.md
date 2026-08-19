# Kurukoo Client Application Convergence Contract

**Status:** Canonical architecture contract
**Date:** 2026-08-19
**Authority:** Current Blueprint + repository implementation

## Purpose

Kurukoo is one operating system exposed through multiple client experiences. Client applications are presentation/runtime shells over the same canonical OS; they are not separate business-logic products.

## Canonical client model

```text
                           KURUKOO OS
                               |
       +-----------------------+-----------------------+
       |                       |                       |
  Canonical state         Canonical logic       Native intelligence
  + memory               + execution            + teacher network
       |                       |                       |
       +-----------------------+-----------------------+
                               |
                     canonical API / events
                               |
       +----------------+------+----------------+----------------+
       |                |                       |                |
    WEB APP           PWA                 iOS / Android       ADMIN
       |                |                       |                |
 marketing +       mobile web            native mobile       operator /
 authenticated     experience            experience          control plane
 app
```

### Web App

The Web App contains both the public marketing experience and the authenticated product experience. The marketing area must not define the visual language of the authenticated OS workspace.

Authenticated Web App surfaces include Chat, Discover, Requests, Tasks, Agents, Connect, Notifications, Memory, Wallet, Points, Top Up, Subscriptions, Checkout, Confirmations, Artifacts, Opportunities, Capabilities, Safety, Topics, Partners/provider workspaces and other canonical projections exposed by the OS.

### PWA

The PWA is the mobile-oriented Web App client. It shares the Web App's canonical data, API contracts, feature registry, semantics and component vocabulary while adopting the mobile shell, touch-first interaction, install/offline/update behavior and browser/device constraints.

The PWA is not a second backend and not a second source of truth.

### iOS / Android

Native clients share the same canonical OS contracts and sources of truth. Native-only capabilities (camera, microphone, push, haptics, secure device storage, background execution where supported) are implemented at the client boundary and must call canonical server services for durable state and execution.

### Admin

Admin is the operator/control plane over the same OS. It is not a parallel consumer application and must not create parallel user identity, memory, capability, agent, economic-request, artifact or provider state.

## Visual systems

Kurukoo has two consumer visual systems:

1. **Web visual system** — public Web + authenticated Web App/desktop/tablet composition.
2. **Mobile visual system** — PWA + iOS + Android.

They share semantic design tokens, typography, iconography, status/evidence language, component meaning and interaction semantics. They may differ in layout composition, navigation mechanics, safe-area behavior, touch geometry and native affordances.

### Non-negotiable visual rules

- Never inject the mobile screen set into a Web page.
- Never inject a Web screen set into a native mobile screen.
- Responsive resizing may change composition but must not silently change product/screen ownership.
- Partners, Channels, Discover, Chat, Connect and workspace surfaces must use their declared client family.
- Shared semantic tokens have one authority. Client aliases may derive from them; pages must not redefine the brand palette independently.
- New visual components belong in the shared design-system/component layer before page-specific CSS is added.

## Information architecture

### Mobile/PWA primary navigation

The canonical mobile primary navigation is:

- Agent
- Discover
- Requests
- Tasks
- Connect

A mobile surface may expose secondary account/economic actions such as Wallet, Points, Top Up, Subscriptions and Profile from its shell/account affordances without changing the primary five-tab contract.

### Desktop Web navigation

The same five product domains remain the semantic anchors but are represented by a desktop sidebar/navigation rail/workspace layout. The desktop layout is not a mobile bottom bar copied onto a wide screen.

### Marketing navigation

Marketing navigation remains optimized for discovery, SEO, education and conversion. It must hand off into the authenticated Web App through canonical identity and `/chat`/application routes rather than duplicating app execution logic.

## Canonical feature sources

All clients read/write canonical OS state through the existing server/service contracts. Local device state is permitted only as cache, offline queue, rendering state, session/device state or other explicitly non-authoritative client state.

Canonical examples:

| Concern | Canonical source |
|---|---|
| Identity | canonical auth/identity services |
| Memory | Memory Profile |
| Conversation | conversation/chat services + conversation IDs |
| Context | Brain/context arbitration |
| Skills | Skill Registry / Skill Flows |
| Capabilities | Capability Registry / Capability Portfolio |
| Agent goals | Agent Runtime |
| Economic requests | Economic Request lifecycle |
| Providers | Provider/entity/readiness services |
| Nearby presence | Nearby Pulse |
| Opportunities | Opportunity Engine |
| Artifacts | ArtifactService + StorageRouter |
| Notifications | canonical notification/queue services |
| Payments | canonical payment/economic services |
| Points | Points economy |
| Subscriptions | subscription services |
| External integrations | externalIntegrationReadiness + adapters |
| AI routing | provider-neutral AI router |
| Student model | Student registry/runtime |
| Training | Behaviour Pack -> scenario/compiler -> corpus -> trainer -> registry |
| Safety | canonical safety/interruption services |
| Admin state | canonical domain state + audited operator actions |

## Artifact storage invariant

For user-owned durable artifacts, connected user-owned storage is preferred. Google Drive is the first-class initial provider. Kurukoo-managed storage is for temporary staging, processing, cache, bounded retry and fallback when the user has no connected storage.

## External integration invariant

External credentials never justify removing an integration's repository implementation. Each integration must have implementation, UI/UX, state machine, feature flag, contract/mock coverage, security boundary and activation evidence states. Missing credentials produce a truthful unavailable/configuration state; they do not produce a fake success state.

## Client feature state contract

Each client feature is classified separately as:

- represented — client surface exists;
- implemented — canonical behavior exists;
- contract-tested — deterministic boundary tests pass;
- provider/device verified — real external evidence exists;
- production-active — deliberately enabled and observed.

A feature may be represented and implemented while remaining externally inactive.

## Mobile/Web synchronization rule

The four consumer client targets do not get separate copies of domain state. They query the same authenticated user identity and canonical backend. Realtime/push/event updates may be delivered differently per client, but the resulting durable state must converge to the same OS authority.

## Future client rule

When adding another client/channel, first add it to the client surface registry and bind it to canonical contracts. Do not start by cloning an existing application's business logic.

## Completion gate

A client family is considered converged only when:

1. screen ownership is explicit;
2. visual system inheritance is explicit;
3. canonical source-of-truth mapping is explicit;
4. feature representations exist for relevant capabilities;
5. auth/identity preserves context across client transitions;
6. responsive/device differences are intentional;
7. duplicate CSS/components are removed or justified;
8. the client's tests cover route/state boundaries;
9. external activation states remain truthful.
