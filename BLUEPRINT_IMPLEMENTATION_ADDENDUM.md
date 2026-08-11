# Kurukoo Blueprint Implementation Addendum — 2026-08-11

This addendum records implementation decisions that must be treated as the current interpretation of `BLUEPRINT.md` v5.62. It exists because the blueprint contains historical version notes as well as current architectural intent; this file records the implementation truth after the latest Economic OS refactor.

## 1. Universal Economic Request model

Kurukoo is one economic coordination system, not a collection of vertical transaction products.

```text
Conversation
  → intent
  → canonical skill
  → progressive requirement capture
  → Economic Request
  → shared capabilities
  → provider/inventory discovery
  → real availability
  → quote
  → user confirmation
  → trusted payment
  → fulfilment
  → completion
  → rating / dispute / memory
```

Category-specific requirements are configuration/data. They are not separate economic engines.

Shared capabilities include:

- discovery
- availability
- verification
- quote
- reservation
- payment
- escrow
- contract
- fulfilment
- tracking
- evidence
- cancellation
- dispute
- completion

## 2. Artist / creator / celebrity policy

Artist, creator, celebrity, DJ, MC, athlete appearance and similar talent requests are **ordinary Economic Requests**.

They must use the same customer-facing conversation and economic lifecycle as rides, food, keke, repairs, cars, tickets, workers, accommodation and product sourcing.

Artist-specific requirements are allowed where genuinely necessary, for example:

- artist or talent identity
- event type
- event date
- venue
- audience size
- performance duration
- budget
- representation/manager contact
- technical rider
- travel/accommodation requirements

Artist-specific capabilities are also allowed where justified, for example:

- representative verification
- contract generation/review
- negotiated availability
- travel coordination
- technical-rider capture
- escrow/cooling-off policy

These are **capabilities/policies on the shared Economic Request**, not a separate artist booking system.

A public artist profile does not imply availability, representation, authenticity or price. Kurukoo must verify those facts before making such claims.

## 3. Economic truth requirements

The implementation must never convert an internal database state into an unsupported real-world claim.

```text
Escrow ledger row       ≠ money held
Provider row            ≠ verified provider
Provider availability   ≠ current availability
Listed starting rate    ≠ confirmed quote
Fulfilled DB state      ≠ verified external fulfilment
Sandbox payment         ≠ production payment
```

The UI and chat copy must use precise states such as:

- verification pending
- verified
- verification expired
- provider unavailable
- starting rate
- quote requested
- awaiting payment
- payment verified
- escrow ledger active
- fulfilment in progress
- completion confirmed

## 4. Canonical skill catalogue

`src/services/skillFlows.ts` is the canonical source for:

- economic categories
- skill-to-category mapping
- requirement definitions
- capability definitions
- skill flows

Other routes/services may validate or consume this metadata, but must not create competing requirement catalogues.

## 5. Provider discovery

Provider discovery must:

1. match the requested canonical skill or valid provider capability;
2. require an explicit verification state when the UI claims verification;
3. respect the supplied location/service-area constraint;
4. use shared presence/availability where the skill requires live availability;
5. never invent distance, availability or verification data.

Precise geospatial/radius matching may be introduced when reliable coordinates/geocoding are available. Until then, text service-area matching must not be presented as GPS precision.

## 6. Universal catalogue/product ordering

Catalogue-bearing requests should converge on the shared Economic Request flow. Do not create separate order engines for food, groceries, car parts, clothing, equipment or other catalogue categories.

The intended progression is:

```text
item + quantity + location
  → provider/product match
  → product/inventory confirmation
  → real quote
  → user confirmation
  → trusted payment
  → optional delivery leg
  → completion
```

Where the current provider data model does not yet contain sufficient structured inventory data, the system must request confirmation rather than fabricate catalogue availability or price.

## 7. Chat mandate

Chat remains the primary interface. A category must not launch a separate visible "system" when the shared conversational flow can capture its requirements.

The PWA, WhatsApp, Telegram, SMS, USSD and email adapters should converge on the same underlying conversation/economic request semantics appropriate to the capabilities of each channel.

## 8. Legacy architecture

`src/index.ts` is a composition/startup boundary. `src/legacyApp.ts` is transitional page/SEO infrastructure only. New business APIs, economic engines or category-specific transaction systems must not be added to the legacy module.

Dead legacy handlers may be deleted only after route extraction and integration coverage prove they are unreachable.

## 9. Production infrastructure boundaries

The low-cost SQL.js/single-instance architecture remains valid for launch where its operational constraints are acceptable.

Move to PostgreSQL, Redis, queues, object storage/CDN or additional external services when one of these becomes a real requirement:

- multi-instance writes
- concurrent worker coordination
- production-scale presence/rate limiting
- high-volume media
- payment/transaction volume
- regulatory/provider requirements

Do not add infrastructure solely to satisfy a technology checklist.

## 10. Definition of done for economic capabilities

A skill is not considered fully implemented merely because it appears in the canonical catalogue or audit.

A production-ready skill must demonstrate, as applicable:

1. canonical intent routing;
2. requirement capture;
3. shared Economic Request creation;
4. correct provider/inventory discovery;
5. real availability semantics;
6. truthful quote semantics;
7. trusted payment integration when payment is required;
8. fulfilment/dispatch integration;
9. completion evidence;
10. cancellation/dispute handling;
11. Memory Profile integration;
12. unified conversation integration;
13. behavioural integration tests.

## 11. Implementation rule for future agents

Before changing or creating anything:

1. inspect the current repository file and relevant services;
2. search for an existing implementation of the requested capability;
3. reuse/extend the canonical implementation if it exists;
4. create a new file only when the required boundary genuinely does not exist;
5. never create a parallel artist, ride, food, car, ticket, repair or worker economic engine.
