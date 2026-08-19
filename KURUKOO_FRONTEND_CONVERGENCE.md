# Kurukoo Frontend Convergence — One OS, public web, authenticated Web App, PWA, native clients

This document is the frontend interpretation of the current Blueprint, Product System Map, Client Application Convergence contract and client-surface registry. It is an implementation contract, not a historical roadmap.

## 1. Product/client structure

Kurukoo is one OS with multiple clients:

```text
KURUKOO OS
├── Web App
│   ├── public marketing/frontend website
│   └── authenticated Web App
├── PWA
├── iOS
├── Android
└── Admin Control Room
```

The Web App and PWA share the browser implementation and canonical API/state boundary. iOS/Android use native presentation and device capabilities, but all clients consume the same canonical identity, Memory Profile, conversation, capabilities, agent runtime, Economic Requests, artifacts, payments, notifications and external-integration readiness.

The Admin Control Room is an operational client, not a second consumer application.

## 2. Two consumer visual systems

There are intentionally two consumer visual compositions:

- **Web visual system:** public marketing + authenticated Web App at desktop/tablet/mobile browser sizes.
- **Mobile visual system:** PWA + iOS + Android.

They share brand, semantic tokens, statuses, evidence language and product semantics. They may differ in navigation, geometry and interaction mechanics. A mobile screen set must never be injected into a Web page, and Web styling must not silently become the native mobile visual system.

## 3. Public Web layer

The marketing/public layer teaches and exposes Kurukoo without pretending that externally gated functionality is live. Core public surfaces include:

`/` · `/how-it-works` · `/explore` · `/discover` · `/topics` · `/network` · `/channels` · `/resources` · `/blog` · `/partners` · `/advertise` · `/pricing` · `/about` · `/contact` · `/careers` · `/api-docs` · legal/support surfaces.

Public content should explain capabilities and hand operational work to Chat/Discover/Topics/other canonical surfaces.

## 4. Authenticated Web App

After authentication the browser enters `/app` and uses the canonical authenticated application shell. The primary domains are:

**Agent · Discover · Requests · Tasks · Connect**

Secondary representations include:

Agents · Capability Portfolio · Topics · Reminders · Saved · Cart · Opportunities · Wallet · Points · Top Up · Subscriptions · Checkout · Confirmations · Memory · Notifications · Artifacts · Prayer Companion · Kurukoo Call · Safety.

These are representations of canonical OS state, not parallel engines. Chat remains the universal conversational control surface for actions, interruptions, recovery and continuation.

## 5. Topics

Topics is a durable community-content primitive, not a forum clone or fulfilment engine.

Public Topics:
- browse/filter public context;
- create Topic after authentication;
- moderation boundary;
- replies and reports;
- Chat handoff.

Authenticated Web App has a dedicated Topics representation that links back to `/topics`, while Discover may surface Topic-derived community context. Topic content never becomes provider/price/payment/fulfilment truth by itself.

## 6. Resources

Resources is the educational library and is separate from transactional Help.

`/resources` and `/resources/:slug` are backed by the canonical `contentManager` store using `type='resource'`. The frontend API is `/api/resources` and `/api/resources/:slug`. Resources are linked into Chat so a guide can become a conversational continuation.

Do not create a separate resource database or resource application.

## 7. Historical capability breadth

Historical product features are preserved as explicit entrypoints into existing surfaces through `src/services/clientFeatureEntryPoints.ts`. The inventory includes 30 known entrypoints such as food, groceries, errands, logistics, mobility, repairs, solar, automotive, health, Money Circle, safety/security, gigs, classifieds, advertising, contributors, sports, community/circles, price checks, government services, exam results, airtime/data, universal remote, events, local sellers and prayer.

These are intentionally **not** 30 separate apps. Their entrypoint surface is Explore, Discover, Topics, Tasks, Connect, Wallet/Safety or direct Chat as appropriate.

## 8. Conversation-first rule

Chat remains the universal control surface for:

- requests and Economic Requests;
- reminders/routines;
- memory changes;
- safety/check-ins;
- provider/capability participation;
- agent goals;
- prayer;
- voice;
- corrections, interruption, pause/resume and recovery;
- external integration actions.

A page may represent state and provide entry/continuation actions, but must not create a second request/agent/identity architecture.

## 9. Visual system rules

Shared web/PWA authority begins with `public/css/kurukoo-client-foundation.css` and the canonical icon/token/component layers. Feature/page CSS may exist only where it owns a real composition that cannot be represented by the shared authority.

Mobile/native visual authority is the mobile design/visual contract under `mobile/kurukoo-mobile`.

No new CSS file should be created merely to solve a page-local problem that belongs in shared tokens/components.

## 10. Truthfulness

UI representation is not external evidence. A provider card, Topics post, quote placeholder, payment control, channel card or Call page must not claim live availability, payment, fulfilment, external delivery or provider success until the relevant canonical service and external evidence boundary establishes it.

Feature flags control activation; they do not excuse incomplete repository implementation.

## 11. Future-agent rule

When adding a feature, update all of the following as applicable:

1. canonical skill/capability/agent owner;
2. conversation path or Chat handoff;
3. public teaching surface if users need to discover it;
4. authenticated Web/PWA representation;
5. native representation when device/mobile relevant;
6. Admin/operator representation when operationally required;
7. externalIntegrationReadiness/feature-flag state if externally gated;
8. client surface/feature registry;
9. deterministic contract test.

Historical features may be retired only when explicitly classified as deprecated/removed in current product truth. Otherwise, they must be reconciled into their canonical existing surface rather than silently disappearing.