# KURUKOO — ENGINEERING AGENT CONTRACT


## 0a. Repository Boundaries (canonical decision)

**Repository ownership is not the same as product ownership.** Kurukoo is one product composed of bounded repositories developed side-by-side in the local workspace:

- **kurukoo (this repo)** — canonical backend. `src/` stays at root. Owns conversation, auth, memory, Economic Requests, providers, presence, execution, commerce, notifications, Admin APIs, database, external integrations and SEO endpoints.
- **remix-of-start-the-journey (frontend repo; workspace copy at `frontend/`)** — canonical **web UI**: marketing, authenticated OS (Chat, Work, Explore, Perch, Artifacts, Connect), admin client, and **PWA** (a capability of web, not a separate app).
- **mobile/kurukoo-mobile** — canonical mobile app (Expo/RN); iOS and Android are native targets of it. `mobile/kurukoo-mobile/server/` is a demo/tRPC scaffold, never a backend authority.
- **Admin** — one privileged client (currently `frontend/public/admin/`) consuming the canonical Admin API.

Rules:

1. Clients never copy backend logic — they consume stable backend API contracts.
2. EJS retires only through evidence: replacement exists → connected → consumers migrated → runtime verified → remove.
3. No monorepo restructuring (`apps/`+`packages/`); no mass folder moves.
4. Do not merge repositories to eliminate folder duplication.

Full table: `docs/architecture/REPOSITORY_BOUNDARIES.md`. Migration inventory: `docs/consolidation/MIGRATION_MAP.md`.

## 0. Purpose
## 0. Purpose

You are working on **Kurukoo**.

Your job is not to produce code for its own sake.

Your job is to make Kurukoo **more capable of helping a real person get something done**, while preserving truth, safety, continuity, architectural coherence and existing useful functionality.

Kurukoo should increasingly feel like **one capable assistant**, not a collection of applications, workflows, dashboards or exposed internal architecture.

The product is a **conversational fulfilment network and personal assistance platform for everyday life and work**.

Internal terms such as Economic OS, orchestration, capabilities, agents, providers, skills, connectors and execution modes describe implementation. They are not the primary product experience.

---

# 1. GOVERNING TRUTH

Before changing anything, establish the current truth.

Use this hierarchy:

1. Explicit user requirements for the current task.
2. `BLUEPRINT.md` — canonical product and architecture intent.
3. `docs/architecture/CURRENT_PRODUCT_TRUTH.md` — canonical current-state classification and ownership.
4. Canonical code on `main`.
5. Behavioural and contract tests.
6. Runtime evidence.
7. Real-world external-provider/device/person evidence.

If sources disagree, do not silently choose whichever is convenient.

Determine whether the disagreement represents:

- outdated documentation;
- incomplete implementation;
- a compatibility boundary;
- a real architectural conflict;
- missing runtime evidence.

Fix the appropriate authority rather than creating another authority.

### Important

Documentation does not make functionality real.

A registry entry does not make an integration live.

A route does not prove a user journey works.

A passing unit test does not prove runtime operation.

A simulated provider does not prove a real provider is active.

A UI state does not prove an external action succeeded.

---

# 2. VERIFICATION VOCABULARY

Keep these dimensions separate.

### Repository verification

The implementation, ownership, contracts and tests exist on canonical `main`.

### Runtime verification

The actual application executes the relevant journey successfully in a controlled runtime.

### Real-world verification

A real external provider, device, person, payment system, communication channel or other external dependency actually performed and confirmed the outcome.

Use:

- `FOUNDATION`
- `IMPLEMENTED`
- `VERIFIED`
- `PARTIAL`
- `UNVERIFIED`
- `BLOCKED_EXTERNAL`
- `SUPERSEDED`
- `NOT_IMPLEMENTED`

Never use `COMPLETE`, `DONE`, `LIVE`, `READY` or `PRODUCTION` as a generic substitute for evidence.

Always say **what dimension is verified**.

---

# 3. THE PRODUCT SPINE

The most important architectural rule is:

> **Kurukoo is one assistant with multiple supporting surfaces, not multiple products connected together.**

The primary conversational spine is:

```text
User
  ↓
Chat / Voice
  ↓
canonical conversation
  ↓
context + identity + memory + safety arbitration
  ↓
intent / semantic interpretation
  ↓
canonical capability owner
  ↓
stateful action/request when required
  ↓
Work when execution/coordination is required
  ↓
existing provider / participant / connector
  ↓
progress + evidence
  ↓
verified outcome
  ↓
Memory / Activity / notifications / continuity
  ↓
back to the same conversation and request context
```

Not every request follows every stage.

Simple questions may stop in conversation.

A reminder may use the reminder owner.

A device question may use a device capability.

A commerce request may enter Cart or an economic flow.

A service request may become an Economic Request and then Work.

The important rule is:

**use the canonical owner appropriate to the request instead of creating another workflow.**

---

# 4. CURRENT USER-FACING PRODUCT STRUCTURE

Do not revert to historical navigation models.

### Authenticated primary OS surfaces

The current shell uses:

- **Your Perch** — `/perch`
- **Chat / Voice** — `/chat`
- **Work** — `/work`
- **Explore** — `/explore`
- **Artifacts** — `/artifacts`
- **Connect** — `/connect`

Activity remains a continuity/history surface but is not the primary navigation rail.

Compatibility routes may exist. Do not remove them blindly.

### Public OS surfaces

The public experience is separate from the authenticated OS but should still feel like the same Kurukoo product.

Current public concepts include:

- Home
- Chat / Voice
- Integrations
- Use Cases
- Pricing
- Capabilities

Do not expose internal architecture as the public product definition.

---

# 5. KURUKOO MUST FEEL LIKE AN ASSISTANT

The user should not have to understand:

- agents;
- skills;
- capabilities;
- providers;
- execution modes;
- orchestration;
- model routing;
- connectors;
- Economic Request internals;
- database structures;
- service boundaries

to accomplish an ordinary task.

Prefer:

**conversation + sensible defaults + progressive disclosure**

over:

**forms + configuration + technical terminology**.

Internal architecture should become visible only when it helps the user understand or control something.

---

# 6. CHAT IS THE CONVERSATIONAL CONTROL SURFACE

Chat is not merely a messaging page.

It is the primary conversational control surface for Kurukoo.

The canonical conversation system owns conversational continuity.

Use the existing:

- `canonicalChatTurnService`
- `chatConversationService`
- context arbitration
- conversation context pack
- conversational auth
- safety handling
- memory context
- canonical intent routing

before introducing another conversation path.

Do not create:

- a second chat engine;
- a second conversation state machine;
- a second conversational identity system;
- a separate agent conversation authority.

Voice is an extension of the same relationship.

---

# 7. CONTEXT ARBITRATION

Kurukoo conversations can contain multiple active contexts.

A user may:

- answer an earlier question;
- switch topics;
- continue a Work item;
- ask about a provider;
- discuss a reminder;
- open a product;
- return to an Agent goal;
- ask an unrelated question.

Do not route every message as if it were a completely new request.

Context interpretation must determine whether the message:

- continues the active context;
- answers a pending question;
- changes topic;
- creates a new context;
- resumes an existing canonical object;
- is ambiguous and requires natural clarification.

Preserve unrelated active contexts.

Do not destroy useful context merely because a new topic appeared.

The Brain/context layer decides **meaning and next step**.

Canonical services remain responsible for:

- state mutation;
- authorization;
- payment;
- evidence;
- confirmation;
- connector execution;
- fulfilment;
- persistence.

Do not move those responsibilities into a conversational classifier.

---

# 8. INTENT ROUTING

The current architecture has a canonical intent-routing boundary.

`intentRouter.ts` is the current routing entry and may use semantic interpretation plus compatibility routing.

`legacyIntentRouter.ts` is not automatically disposable simply because it contains "legacy" in its name.

Before modifying or removing compatibility routing:

1. identify all consumers;
2. determine why it remains;
3. understand what the canonical router delegates to it;
4. preserve behaviour where required;
5. remove it only when its replacement is real and all consumers are migrated.

Do not create another routing authority.

Do not make a classifier the product brain.

Do not route based on superficial keyword matching when the canonical semantic/context machinery can make the decision correctly.

---

# 9. AUTHENTICATION AND CONVERSATIONAL ENTRY

Authentication is part of the canonical conversation contract.

Do not bypass authentication merely because a conversational flow is more convenient without authentication.

Conversational onboarding and authentication must remain compatible with the existing authenticated user identity.

When changing auth entry:

- preserve existing entry contracts;
- preserve existing session/auth state;
- preserve conversational onboarding;
- do not create a second identity store;
- do not create a parallel login path unless explicitly required;
- verify authenticated and unauthenticated behaviour separately.

A public conversational entry must never accidentally gain authenticated capabilities.

---

# 10. IDENTITY, MEMORY AND CONTINUITY

Identity and memory are cross-service capabilities.

Use the existing canonical owners.

Do not create:

- Agent memory;
- Chat memory;
- Voice memory;
- Social memory;
- Provider memory;
- household memory

as separate authorities.

Memory may contain:

- approved identity information;
- preferences;
- recurring routines;
- request continuity;
- goals;
- prior relevant context;
- agent continuity;
- approved history.

Memory is **not** current-state evidence for:

- price;
- availability;
- provider verification;
- stock;
- payment;
- fulfilment;
- delivery;
- current provider status.

Current state must come from the authoritative current-state service.

Never convert remembered information into a false current claim.

---

# 11. WORK IS THE EXECUTION/COORDINATION SURFACE

The product term is **Work**.

Do not reintroduce old user-facing names such as Actions or Croon.

Work exists to make ongoing execution understandable and controllable.

A Work item may include:

- request details;
- coordination;
- options;
- provider selection;
- quote;
- approval;
- payment boundary;
- fulfilment;
- evidence;
- outcome;
- recovery.

Work must remain connected to the originating conversation.

The user should be able to move:

```text
Chat → Work → Chat
```

without losing context.

Do not create an independent workflow system beside Work.

---

# 12. ECONOMIC REQUESTS ARE THE CANONICAL COMMERCIAL LIFECYCLE

For economic actions, distinguish:

```text
intent
→ request preparation
→ authorization
→ provider acceptance
→ payment
→ settlement
→ fulfilment
→ confirmation
```

These are different states.

Never infer one from another.

Examples:

- displaying a provider ≠ provider acceptance;
- creating a request ≠ fulfilment;
- selecting an option ≠ booking;
- approving a quote ≠ payment;
- payment initiation ≠ settlement;
- provider completion claim ≠ verified outcome.

The canonical Economic Request lifecycle remains the authority.

Do not create another commercial lifecycle.

---

# 13. PHYSICAL EXECUTION

Physical execution is an extension of the existing Economic Request/provider architecture.

It is not a new delivery platform.

The intended path is:

```text
User
→ Kurukoo Agent
→ canonical capability
→ Economic Request
→ selected existing participant/provider
→ execution connector
→ progress/evidence
→ reviewed outcome
→ existing continuity/memory/notification
```

Physical participants may include:

- human drivers;
- couriers;
- delivery providers;
- robot taxis;
- autonomous vehicles;
- drones;
- robotic delivery systems.

Do not create a fleet manager, robot platform, delivery-order system or autonomous hardware authority merely because a new physical participant is needed.

Reuse:

- provider identity;
- capability declarations;
- availability;
- authorization;
- connector contracts;
- evidence;
- communication;
- Economic Request state.

Physical execution must fail closed when authorization, expiry, destination binding, safety reference, participant membership, availability or connector authorization is invalid.

Never claim physical completion without suitable evidence and canonical review.

---

# 14. QUICK RIDE

Quick Ride is an adapter into the canonical execution/economic path.

It is not a second transportation system.

Ride/taxi/bike/keke requests should use:

```text
Quick Ride input
→ Economic Request
→ economic dispatch coordination
→ existing provider/participant boundary
→ evidence
→ outcome
```

Do not invent:

- drivers;
- ETAs;
- vehicle positions;
- payment success;
- dispatch acceptance;
- ride completion.

unless the backend and external provider actually provide those facts.

---

# 15. LOCAL EXECUTION AND CANADA

Kurukoo now has a generic local execution adapter architecture.

Canada is represented by a local execution adapter with:

- Canada country context;
- CAD;
- 911 emergency number;
- local discovery;
- service-provider coordination;
- local business participation;
- AI-assisted routing;
- providers/businesses/agents/channels as execution resources.

This supports the intended positioning:

> **Kijiji's breadth + Taskrabbit's service coordination + an AI assistant sitting in front of the whole system.**

However:

**configured adapter metadata is not proof that Canadian external providers are live.**

The presence of a Canada adapter means the architecture knows how Canada can be represented.

It does not mean:

- Canadian providers are connected;
- provider availability is live;
- payments are active;
- dispatch is active;
- businesses have accepted requests;
- communications are delivered;
- real-world fulfilment has occurred.

External activation must be separately verified.

Never upgrade `configured` to `live` through UI wording, documentation or registry existence.

---

# 16. PROVIDERS, BUSINESSES AND DISCOVERY

Discovery must remain evidence-bound.

Do not fabricate:

- providers;
- businesses;
- inventory;
- availability;
- prices;
- demand;
- discounts;
- market activity.

If a provider/business is discovered, preserve:

- source;
- identity;
- relevant evidence;
- capability;
- current-state information.

When appropriate, allow the user to bring the discovery into Work.

The transition should preserve context rather than force the user to repeat the request.

---

# 17. NEARBY / PULSE

Nearby/Pulse must use truthful current signals.

Do not hard-code demo providers or anonymous fake people to make the interface look populated.

Pulse may surface:

- live provider signals;
- people/presence projections where privacy permits;
- verified providers;
- Kurukoo/AI agents;
- availability;
- live provider totals.

Do not expose:

- private phone identifiers;
- exact private locations;
- anonymous provider identities;
- inferred presence presented as confirmed presence.

Unified presence is a projection over existing authorities, not a second presence database.

Do not create another presence store.

---

# 18. UNIFIED PRESENCE

Presence should remain a shared projection across:

- people;
- contacts;
- verified providers;
- Kurukoo/software agents;
- Pulse participants.

Use the existing presence authority.

Presence describes availability/visibility.

It does not authorize:

- contact;
- payment;
- dispatch;
- execution;
- access to private information.

Do not turn a green dot into proof that a person/provider will respond.

---

# 19. COMMERCE AND CART

Commerce should remain one canonical flow.

Use the existing Cart and commerce mechanisms.

The relationship is:

```text
Discovery
→ offer/product context
→ Cart
→ checkout/payment boundary
→ external destination or verified payment state
→ confirmation
```

A displayed offer is not a completed purchase.

A cart item is not payment.

A checkout click is not settlement.

An affiliate destination is not Kurukoo fulfilment.

Preserve:

- seller/source;
- provenance;
- external destination;
- commercial state.

Do not create a second commerce or payment authority.

---

# 20. COMMUNICATIONS AND CHANNELS

Web, PWA, native, voice, WhatsApp, Telegram, SMS, email, push and future channels are different delivery surfaces for the same Kurukoo relationship.

They must not become separate product truths.

Reuse canonical:

- identity;
- conversation;
- memory;
- action state;
- request state;
- notification state.

Never claim that a message was delivered unless delivery evidence exists.

Never claim that an external party received or accepted something merely because Kurukoo attempted to send it.

---

# 21. VOICE

Voice is part of Chat, not a separate assistant.

Use the cheapest sufficient voice path:

```text
response text
→ browser/device SpeechSynthesis
→ optional hosted TTS
→ explicit realtime voice when selected
```

Do not establish permanent realtime connections simply because the user is logged in.

Realtime voice is explicit.

Proactive voice requires:

- user permission;
- attention policy;
- privacy policy;
- quiet-hour controls.

Voice presence is lightweight semantic state, not a requirement for an avatar or permanent audio connection.

Never claim that speech was heard by the user unless the relevant runtime evidence exists.

---

# 22. AGENTS

Agents are capabilities inside Kurukoo, not competing products.

The user should experience:

**Kurukoo helping them**

rather than:

**Agent A → Agent B → Agent C → tool → workflow**

unless the technical detail is genuinely useful.

Reuse the canonical Agent Runtime and capability system.

Use agents for genuine value such as:

- ongoing reasoning;
- monitoring;
- diagnosis;
- coordination;
- instruction-following;
- bounded background continuity.

Do not invoke agents merely because an agent abstraction exists.

Never give an agent unrestricted authority.

Autonomous external actions remain bounded by:

- capability;
- authorization;
- policy;
- connector;
- scope;
- expiry;
- evidence;
- user approval where required.

---

# 23. SAFETY AND SECURITY

Never weaken safeguards to make a feature appear complete.

Preserve:

- authentication;
- authorization;
- owner scoping;
- privacy;
- consent;
- safety policy;
- evidence;
- auditability;
- legal constraints;
- secure attachment handling;
- provider verification;
- connector authorization.

Fail closed when a consequential action cannot be safely verified.

Do not expose internal reasoning, secrets, credentials or private identifiers.

Do not place credentials in source code, tests, fixtures, logs or documentation.

---

# 24. EXTERNAL INTEGRATIONS

Treat external systems as activation boundaries.

Examples include:

- payment providers;
- SMS;
- WhatsApp;
- Telegram;
- email;
- FCM;
- WebRTC;
- PSTN;
- MQTT;
- KYC;
- inventory;
- dispatch;
- provider networks;
- vehicles;
- devices.

The repository may contain a complete adapter/contract while the external service remains unactivated.

Represent this honestly.

A correct implementation should degrade gracefully when external activation is unavailable.

Do not replace an unavailable integration with a fake success state.

---

# 25. NEVER INVENT REAL-WORLD OUTCOMES

This is a hard rule.

Never invent:

- a provider;
- a person;
- availability;
- stock;
- price;
- quote;
- booking;
- payment;
- delivery;
- notification delivery;
- driver;
- vehicle;
- ETA;
- device result;
- provider acceptance;
- task completion;
- fulfilment;
- external communication;
- external agent action.

If evidence is missing, show the truthful state.

Examples:

**Good**

> Ready to connect to a provider.

**Good**

> Provider options found; no acceptance yet.

**Good**

> Payment is required to continue.

**Good**

> Canadian local execution is configured, but external provider activation is still required.

**Bad**

> Your provider has accepted the job.

when no provider acceptance exists.

---

# 26. HOUSEHOLD AND EVERYDAY SERVICES

Household/service requests must enter the existing canonical routing and execution architecture.

Do not build a separate household-services workflow.

Examples may include:

- cleaning;
- repairs;
- plumbing;
- electrical work;
- moving;
- delivery;
- local errands;
- home maintenance;
- other everyday services.

The assistant should interpret the user's need and route it through the canonical capability/Economic Request/Work path when execution is required.

Preserve:

- conversation context;
- user identity;
- location/context;
- service intent;
- provider evidence;
- approval;
- commercial state;
- execution evidence.

Do not hard-code household services as a special product.

---

# 27. PAGE AND UI DEVELOPMENT

Before creating or changing a page:

1. identify its user purpose;
2. identify its canonical route;
3. identify its owner;
4. identify its existing shared components;
5. identify how it connects to Chat;
6. identify how it connects to Work when relevant;
7. identify loading/empty/error/offline states;
8. identify backend availability requirements.

Do not create a new page because an existing page can be extended.

Do not create duplicate shells.

Do not create duplicate navigation.

Do not create duplicate state stores.

Do not maintain hidden duplicate markup.

---

# 28. FRONTEND CANONICALITY

For the current Kurukoo frontend:

- `src/` is the active application source.
- The nested/old `frontend/` architecture must not be revived as a parallel frontend.
- The current authenticated shell is the canonical OS shell.
- Shared components should be reused rather than reimplemented per route.

When a frontend change is requested, first determine whether the capability already exists in:

- the canonical route;
- shared Kurukoo components;
- API clients;
- shell/context rails;
- existing Work/Chat/Explore/Perch surfaces.

Do not build a new implementation simply because an old page appears easier to modify.

---

# 29. BACKEND CANONICALITY

The backend already contains mature foundations for:

- canonical conversation;
- authentication;
- memory;
- Economic Requests;
- providers;
- notifications;
- agents;
- execution;
- physical participants;
- Quick Ride;
- external channels;
- commerce;
- presence;
- local execution adapters;
- security;
- evidence;
- audit;
- job queues.

Before introducing any new service, search for the existing owner.

The default sequence is:

**reuse → extend → adapt → consolidate → create only if necessary**

A new abstraction must solve a real ownership problem.

---

# 30. DO NOT CREATE PARALLEL AUTHORITIES

Never create a second:

- conversation engine;
- routing engine;
- auth authority;
- identity store;
- memory store;
- provider directory;
- presence store;
- Economic Request lifecycle;
- payment authority;
- notification system;
- agent runtime;
- execution lifecycle;
- device layer;
- commerce flow;
- UI shell;
- state-management authority.

If two systems appear to perform the same job, investigate which is canonical before changing either.

---

# 31. COMPATIBILITY AND LEGACY CODE

A name containing:

- legacy;
- old;
- compatibility;
- adapter;
- bridge

does not mean the code can be deleted.

Before removal:

1. find consumers;
2. understand the contract;
3. identify migration status;
4. check tests;
5. check native/client/external consumers;
6. confirm the replacement exists;
7. migrate consumers;
8. only then remove safely.

Prefer convergence over deletion theatre.

---

# 32. LOCAL-FIRST DEVELOPMENT

The local workspace is the first source to inspect.

Prefer:

```text
current context
→ local workspace
→ local cache
→ repository checkout
→ configured cache
→ remote source
```

Before downloading, check whether the required artifact already exists.

Reuse:

- dependencies;
- model weights;
- browser binaries;
- test fixtures;
- build outputs;
- datasets;
- downloaded archives;
- generated assets.

Do not make server startup repeatedly download an existing model or package.

---

# 33. MODEL AND AI RESOURCE DISCIPLINE

Use the cheapest sufficient model/provider.

Do not:

- invoke a larger model unnecessarily;
- duplicate inference;
- send the same request through multiple providers without reason;
- repeatedly regenerate known information;
- turn local model startup into a network dependency.

Local models must use persistent cache/model directories.

The model path should:

1. check for local resources;
2. reuse valid resources;
3. avoid network access when cached resources exist;
4. download only when genuinely absent;
5. persist newly downloaded resources;
6. fail clearly if acquisition is impossible.

---

# 34. TASK EXECUTION

The preferred engineering loop is:

```text
inspect
→ identify canonical owner
→ implement
→ validate
→ integrate
→ continue
```

Do not spend most of the task producing plans, audits or reports.

Investigate enough to avoid damage.

Then act.

If a safe, reversible implementation is obvious, implement it.

If the change is high-risk or ownership is unclear, investigate more deeply before changing it.

---

# 35. DO NOT STOP AT THE FILE

After modifying a component/service/route:

1. validate it;
2. inspect the immediate user journey;
3. determine whether the new functionality is actually reachable;
4. fix obvious in-scope broken connections;
5. verify the resulting path;
6. integrate the work.

A feature is not complete merely because the requested file changed.

---

# 36. VALIDATION

Use proportional validation.

For a local change, start with the smallest relevant check:

- targeted unit test;
- targeted contract;
- typecheck;
- lint;
- build;
- targeted runtime test.

For shared or consequential changes, expand validation appropriately.

Do not run every test merely because it exists.

Do not skip validation because the change is small.

Do not use CI as the interactive development loop.

---

# 37. CI POLICY

Remote CI is final repository verification, not the primary development environment.

During development:

- reproduce locally;
- diagnose locally;
- fix locally;
- run targeted tests locally.

Do not repeatedly poll CI while debugging.

Do not create commits merely to make CI green.

When CI fails but local reproduction fails, inspect:

- environment differences;
- commands;
- dependencies;
- secrets/configuration;
- deployment assumptions.

Do not guess.

The current backend repository has staging smoke coverage for execution, presence and external-provider activation contracts. Those tests provide repository/contract evidence, not proof that external providers are actually active in production.

---

# 38. GIT

`main` is the canonical integration branch.

Preferred flow:

```text
latest main
→ short-lived implementation branch
→ targeted validation
→ PR/review
→ merge
→ continue
```

Do not maintain parallel product branches.

Do not leave verified useful work indefinitely isolated from `main`.

Before editing:

```bash
git status --short --branch
```

Inspect existing uncommitted work.

Never overwrite another agent's useful work merely to obtain a clean tree.

Commit only the intended changes.

---

# 39. AGENT HANDOFF DISCIPLINE

When another agent has already worked on the repository:

Do not assume its claims are correct.

Do not assume its claims are false either.

Inspect the actual:

- commit;
- diff;
- changed files;
- tests;
- current branch;
- relationship to `main`.

Classify the change:

- correct;
- incomplete;
- harmless;
- redundant;
- architectural regression;
- fake/mock behaviour;
- unsafe;
- needs migration.

A commit message is not evidence of correctness.

---

# 40. PRESERVE WORKING FUNCTIONALITY

Before changing shared code, identify its consumers.

Protect:

- web;
- PWA;
- native;
- Admin;
- APIs;
- background jobs;
- channels;
- integrations;
- tests;
- deployment;
- security boundaries.

Do not fix one surface by breaking another.

Do not perform broad refactors when a targeted change solves the problem.

---

# 41. USER EXPERIENCE QUALITY

Every meaningful surface needs intentional handling for:

- loading;
- empty;
- active;
- progress;
- needs input;
- waiting;
- success;
- failure;
- offline/reconnect;
- notification;
- returning user;
- desktop;
- tablet;
- mobile.

The interface should answer:

- What can Kurukoo do?
- What is happening?
- What does Kurukoo need from me?
- What happened?
- What can I do next?

Use plain language.

---

# 42. CONTINUITY IS A PRODUCT FEATURE

When a user moves between:

- Chat;
- Work;
- Explore;
- Perch;
- Providers;
- Businesses;
- Cart;
- Activity;
- Voice;
- Agents;
- Contacts;
- Messages;

useful context should remain attached to the relevant canonical object.

The user should not need to repeat their entire request simply because the UI changed.

Evidence, provider state, commerce state and execution state should remain tied to the request where appropriate.

---

# 43. TRUSTED CONTEXT

Contextual rails and supporting UI should provide useful context without becoming a second application.

They may expose:

- recent conversations;
- voice state;
- community/presence;
- related Work;
- relevant providers/businesses;
- contextual information.

Do not turn trusted context into another state authority.

The rail should reflect canonical state, not invent it.

---

# 44. ACCESSIBILITY

Accessibility is part of functionality.

Preserve:

- keyboard operation;
- semantic controls;
- readable contrast;
- sufficient target sizes;
- meaningful labels;
- focus behaviour;
- screen-reader semantics;
- mobile usability.

Do not sacrifice accessibility for visual polish.

---

# 45. PERFORMANCE AND RESOURCE DISCIPLINE

Every agent action has a cost.

Avoid unnecessary:

- remote searches;
- repeated repository reads;
- repeated model calls;
- repeated builds;
- repeated package installation;
- repeated browser sessions;
- downloads;
- generated reports;
- duplicate artifacts.

Batch related work when possible.

Reuse already established information.

Do not perform exhaustive audits when a targeted check answers the question.

---

# 46. DOCUMENTATION

Documentation is valuable when it:

- governs future implementation;
- prevents recurring mistakes;
- defines a critical contract;
- records an important architectural decision;
- allows another agent to continue safely.

Do not create documentation merely to make work appear substantial.

Do not create another product-truth document.

`CURRENT_PRODUCT_TRUTH.md` remains the current-state authority.

Reports, audits, matrices and snapshots are evidence only.

---

# 47. NO ARCHITECTURE THEATRE

Do not confuse architectural description with implementation.

Avoid creating:

- decorative architecture dashboards;
- duplicate readiness systems;
- giant reports;
- redundant matrices;
- duplicate roadmaps;
- fake completion indicators;
- unnecessary abstraction layers.

The product is the priority.

If the user needs a feature, implement the feature.

---

# 48. DECISION RULE

When choosing between approaches, prefer the one that:

1. helps the user sooner;
2. uses an existing canonical owner;
3. preserves working behaviour;
4. maintains truthful state;
5. keeps the user journey coherent;
6. is easy to verify;
7. introduces the least permanent complexity;
8. uses the least unnecessary compute/network/model cost.

Prefer:

**convergence over accumulation**

**reuse over recreation**

**truth over optimistic UI**

**evidence over claims**

**implementation over architecture theatre**

---

# 49. COMPLETION GATE

Before declaring a slice complete, verify:

### Product
Can a real person accomplish something better?

### Reachability
Can the user actually reach the functionality?

### Architecture
Does it use the canonical owner?

### Continuity
Does the relevant context survive navigation/conversation changes?

### Truth
Are claims supported by evidence?

### Safety
Are authorization, privacy and evidence boundaries preserved?

### External dependencies
Are unavailable external systems represented honestly?

### Preservation
Did existing functionality remain intact?

### Validation
Did the changed path receive appropriate tests/checks?

### Integration
Is the work saved and ready for integration?

---

# 50. HARD PROHIBITIONS

Do not:

- invent providers;
- invent availability;
- invent pricing;
- invent stock;
- invent bookings;
- invent payments;
- invent delivery;
- invent notifications;
- invent device results;
- invent provider acceptance;
- invent fulfilment;
- invent external execution;
- bypass authentication;
- bypass authorization;
- bypass evidence requirements;
- create parallel canonical authorities;
- delete compatibility code blindly;
- turn configuration into fake live functionality;
- use UI state as proof of external success;
- create a second conversation system;
- create a second Work/request lifecycle;
- create a second memory authority;
- create a second provider system;
- create a second presence store;
- create a second payment authority;
- create a second execution system.

---

# 51. LOCAL DEVELOPMENT

For the backend repository, prefer:

```bash
npm run dev:start
```

This is the canonical local development startup helper.

It:

1. removes stale `dist/`;
2. preserves tracked `public/`;
3. starts the application in development mode;
4. releases port `3000` if necessary.

Port override:

```bash
PORT=4000 npm run dev:start
```

Useful alternatives:

```bash
npm run dev
npm run dev:fresh
npm run build
npm run build:fresh
npm start
npm start:fresh
npm run clean
```

The local model path must remain cache-aware.

Do not make local development depend on repeated network model downloads.

---

# 52. FINAL OPERATING PRINCIPLE

When in doubt, ask:

> **What is the existing canonical Kurukoo mechanism for this?**

Then:

> **Can I extend it instead of creating another one?**

Then:

> **What evidence proves this actually works?**

Then:

> **Can a real person use the result through the actual Kurukoo journey?**

The ultimate measure is:

> **Does this make Kurukoo better at helping a real person get something done?**

Kurukoo should increasingly feel like:

**one capable assistant that understands, acts, coordinates, remembers, communicates and follows through.**

That is the product.