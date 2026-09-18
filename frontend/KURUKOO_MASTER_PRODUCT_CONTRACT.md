# Kurukoo Master Product Contract

Status: LOCKED — 2026-09-11

## Product

**Kurukoo — AI that gets things done.**

Primary action: **Tell Kurukoo what needs doing.**

Users should experience one assistant that can move an intention to an outcome across digital, physical and hybrid execution. The execution network is internal infrastructure, not the consumer-facing definition.

## Universal experience

**Tell → Understand → Find/Plan → Choose → Approve → Do → Show proof → Done**

Supported routes:

- Digital: Tell → Understand → Plan → Access → Act → Verify → Done
- Physical: Tell → Understand → Discover → Compare → Approve → Coordinate → Fulfil → Verify → Done
- Hybrid: Tell → Understand → Plan → Digital + Physical execution → Coordinate → Verify → Done
- User-assisted: Tell → Understand → Prepare → Ask user → User acts → Continue → Verify

## Product layers

- **Assist** — conversation-first control surface.
- **Discover** — people, providers, businesses, products, places, services, opportunities, information, creators and agents.
- **Execute** — digital agents, browser/API actions, providers, businesses, communication and transactions.
- **Work** — everything Kurukoo is doing, waiting on, or has completed.
- **Memory** — user-controlled continuity and context.
- **Trust** — permissions, identity, evidence, history, transactions and disputes.

Home, Explore, Nearby, Topics, Opportunities, Providers, Businesses, Creators, Agents, Activity, Wallet, Points, Resources and similar surfaces are capabilities inside these layers. They are not separate products.

## Execution model

Providers are one execution resource among many. Resources include people, businesses, inventory, websites, APIs, connected apps, agents, communication channels, logistics, devices and future robotics/IoT.

Internal execution graph:

**Intent → Context → Capability → Execution resource → Consent → Action → Evidence → Outcome → Memory/Trust**

## Global core / local execution

The core product is global. Local adapters supply country-specific payments, identity, language, providers, logistics, communication channels, government systems and regulatory requirements.

Nigeria is an execution environment, not the definition of Kurukoo.

## Frontend/backend lock

Every user-facing capability is a paired vertical slice:

**Frontend surface → canonical backend capability → persistence/state → execution → evidence → UI outcome**

Frontend-only fake completion and backend-only invisible capability do not count as product-complete.

Canonical repositories:

- Frontend: `temeaco-max/remix-of-start-the-journey`
- Backend: `temeaco-max/kurukoo`
- Integration truth: `main`

## Truth rules

Never fabricate providers, availability, pricing, payments, integrations, agent actions, completion evidence, rankings or metrics. Demo/preview states must be labelled honestly.

## UX rule

Lead with the user's goal, not architecture. Internal terms such as Economic Request, execution graph and evidence gates should not dominate ordinary UI.

The test for every screen is:

> Does this help the user move from intention to outcome?

## Implementation rule

From this point forward, frontend and backend work are implemented together by outcome vertical. Each vertical must cover request, understanding, discovery/planning, choice, consent, execution, evidence, Work/Activity state, recovery and tests. Do not substitute additional architecture documents for working product capability.
