# Kurukoo Product System Map

**Purpose:** Turn Blueprint v5.62 into one coherent product, UX, engineering and information-architecture reference. This document is an implementation companion to `BLUEPRINT.md`, not a replacement for it.

## 1. Product truth

**Core promise:**

> **Tell Kurukoo what you need. Kurukoo figures out who or what can fulfil it.**

Kurukoo is a **conversational fulfillment network**. It is not a marketplace, directory, chatbot, taxi app, delivery fleet, or collection of disconnected features.

The user experience is deliberately simple:

1. User says what they need.
2. Kurukoo understands the request and relevant memory.
3. Kurukoo either performs the task itself, creates a request, finds a provider/agent, coordinates multiple participants, or hands off through an authorised channel/integration.
4. Kurukoo keeps the user informed in the same conversation.
5. Kurukoo remembers the outcome and can act proactively later.

### The product has four capability classes

**Native assistance** — Kurukoo itself can execute or schedule the action.
Examples: reminders, scheduled follow-ups, saved instructions, emergency-contact/check-in workflows, personal organisation, notifications, information lookup.

**Network fulfillment** — a human, business, software agent or authorised provider fulfils the request.
Examples: repairs, errands, delivery, sourcing, bookings, security staffing, food/product ordering, rides, sports coordination.

**External execution** — Kurukoo coordinates with an authorised third-party service/channel through an explicit connector contract.
Examples: WhatsApp, SMS, UK public APIs, PSPs, approved marketplaces, future mobility/courier integrations.

**Future capability** — represented honestly but not executable yet.
Examples: autonomous vehicle control, MQTT device control until the connector/security boundary is complete, MCP, full multi-party settlement, native apps.

No marketing page may imply that a future capability is live.

## 2. Five architectural laws

Every feature must satisfy the Blueprint's Tight Integration Mandate:

- **One memory profile:** user state belongs in `memory_profiles` plus the approved shared tables.
- **One presence layer:** location/availability uses `provider_presence`.
- **One conversation:** PWA, WhatsApp, USSD, SMS and other channels are doors into the same conversation model.
- **One economic layer:** Points are the shared NG/GH usage/reward mechanism; they are not money.
- **One proactive intelligence layer:** reminders, Daily Picks, deferred requests and opportunities originate from the same memory and conversation system.

A feature that creates a parallel user identity, parallel conversation, parallel wallet, parallel location system or parallel lifecycle is incomplete.

## 3. Frontend hierarchy

### Public website

The public website answers five questions:

1. **What is Kurukoo?**
2. **What can I use it for?**
3. **How does it work?**
4. **Why should I trust it?**
5. **How do I start?**

Primary CTA everywhere:

> **Start chatting**

Secondary CTAs should be contextual: `See how it works`, `Explore what Kurukoo can do`, `Offer your skills`, `For businesses`, `Open the app`.

Avoid legacy CTA language such as `Start a free trial`, `Get started` when it obscures the conversation-first proposition, `Ask anything`, and old channel-first calls that make WhatsApp/USSD appear to be separate products.

### Recommended global navigation

**What Kurukoo does**
- How it works
- What you can ask
- Discover

**Network**
- Providers
- Businesses
- Agents & Contributors
- Partners

**Channels**
- Web / PWA
- WhatsApp
- USSD
- SMS & notifications
- Telegram / other channels where enabled

**Resources**
- Guides
- Help
- Blog / Kuru Media
- Safety & Trust
- API / Developers

**Company**
- About
- Contact
- Advertise
- Careers / future opportunities where implemented

The header should remain compact. Do not expose the 45-category taxonomy as a primary navigation tree.

## 4. Public page responsibilities

| Page | Job | Primary CTA |
|---|---|---|
| `/` | Explain the promise and demonstrate conversation | Start chatting |
| `/how-it-works` | Explain request → match/execute → fulfilment → outcome | Start chatting |
| `/explore` | Show the breadth of things Kurukoo can help with | Try this in chat |
| `/explore/:slug` | Explain a capability and launch a seeded conversation | Start this request |
| `/discover` | Show nearby, events, opportunities and useful local context where permitted | Open in chat |
| `/for-you` | Explain user modes without locking identity: Consumer, Provider, Business, Agent, Contributor | Choose a starting point |
| `/channels` | Explain that all channels connect to one Kurukoo relationship | Start on web |
| `/resources` | Teach users how Kurukoo works and how to get value from it | Read / Start chatting |
| `/help` | Resolve problems, disputes and support issues | Get help |
| `/partners` | Explain partnership models and capture applications | Partner with Kurukoo |
| `/advertise` | Explain sponsored placements and campaign inventory | Advertise with Kurukoo |
| `/about` | Explain mission, trust and market focus | Start chatting |
| `/pricing` | Explain plans and what each unlocks, without making subscription the product | Choose a plan |
| `/blog` | Build authority and explain useful topics | Read / Try it |
| `/legal/*` | Terms, privacy, safety and compliance | — |

Every page must have a clear next action. No orphan pages.

## 5. Conversation-first PWA

The authenticated PWA is not a SaaS admin dashboard. It is a **personal Kurukoo workspace centred on conversation**.

Primary surface:
- Conversation thread.
- Composer with text + voice.
- Contextual quick actions.
- Inline cards for requests, offers, reminders, safety, providers, deliveries, payments, events and outcomes.

Secondary drawer/panel:
- Profile
- Activity
- Saved items
- Reminders / active intentions
- Points (NG/GH only)
- Work toggle
- Tasks (contributors)
- Notifications
- Settings
- Help
- Privacy
- Logout

The dashboard may contain supporting panels, but no panel may compete with the conversation as the product's primary interface.

## 6. Authentication UX

Authentication should feel like joining a conversation, not creating a SaaS account.

Preferred flow:

1. User taps **Start chatting**.
2. They may try a limited anonymous conversation where appropriate.
3. When persistence, reminders, provider actions or protected data are required, Kurukoo asks for a phone number.
4. Verification uses the current secure channel/session model; do not introduce a parallel identity system.
5. User lands directly in their conversation, not a generic dashboard.
6. Logout means ending the current authenticated session; it does not delete the memory profile or conversation.
7. Returning users see the same relationship and continue where they left off.

Email/SSO remains optional secondary authentication/profile data and must resolve to the phone-based identity; it never creates a second user.

## 7. Native assistance capabilities that must remain visible

These are not removed by the conversational-fulfillment positioning. They are expressed through conversation.

### Reminders & scheduled help

Examples:
- `Remind me tomorrow at 8 to call Mum.`
- `Remind me every Sunday to buy bread.`
- `Remind me when my MOT is due.`
- `Check in with me at 10pm.`

The system should persist the reminder/intention, schedule execution, notify through the permitted channel, and write the outcome to the same conversation/profile.

### Safety & emergency contacts

Examples:
- `Add Sarah as my emergency contact.`
- `If I don't check in by 10pm, notify Sarah.`
- `I need emergency help.`

Safety flows must be explicit, consent-based, auditable and fail-safe. Kurukoo is a dispatcher/coordination layer, not an emergency responder. Life-threatening flows must not wait for marketing, Points or normal subscription logic.

### Personal assistance

Examples:
- reminders and routines
- appointment follow-ups
- lost-item/pet alerts
- checklists
- travel and event reminders
- saved preferences
- recurring errands
- information lookups

These should be implemented as generic capabilities on the shared conversation/intent infrastructure rather than dozens of mini-apps.

## 8. Network fulfillment capabilities

The same conversation can transition from native assistance to network fulfillment.

Example:

`I need groceries tomorrow.`

→ Kurukoo asks what is needed.
→ Finds a verified seller.
→ Presents offer.
→ User confirms.
→ Delivery is needed.
→ Finds eligible delivery provider.
→ Records the request and evidence.
→ Uses the canonical payment/escrow path where eligible.
→ Confirms completion.

Seller, delivery provider, agent and external platform roles are coordination participants; they do not automatically become escrow recipients or gain lifecycle authority.

## 9. Explore architecture

Explore is a **capability discovery layer**, not a directory.

Cards should be grouped around user outcomes rather than technical categories:

- Get something done
- Find someone
- Get somewhere
- Buy / source something
- Keep life on track
- Stay safe
- Make money
- Run a business
- Discover nearby
- Join a community
- Learn / get information

Category pages can map to the authoritative ECOSYSTEM taxonomy underneath.

Every Explore card should have a direct `Try it in chat` action with a seeded natural-language prompt.

## 10. Discover architecture

Discover is the spatial/proactive layer, not the main request interface.

Potential surfaces:
- Nearby providers (privacy-fuzzed)
- Kuru Pulse activity
- Events
- Opportunities
- Community alerts
- Emergency services
- Sponsored placements

Users should always be able to convert a discovery into a conversation/request.

## 11. Advertising architecture

Advertising is a monetisation layer, not the navigation structure.

Approved placements:

1. Sponsored Explore card — every 6th card maximum.
2. Sponsored Daily Pick — clearly labelled.
3. Sponsored Nearby/Discover pin — visually distinct from organic providers.
4. Category sponsorship — category header or limited takeover.
5. City/LGA sponsorship — controlled campaign surface.
6. Provider spotlight — verified/eligible providers only.
7. Blog/content sponsorship — clearly labelled.
8. PWA Discover sponsored card.
9. Future chat-native sponsored recommendation — only where contextually useful and clearly marked.

Rules:
- Never disguise ads as organic results.
- Never put ads beside emergency actions in a way that creates confusion.
- Never interrupt a critical safety, payment or dispute flow with an advertisement.
- Cap frequency per user.
- Use the same Kurukoo card/icon language as the rest of the product.
- Ads must be approved through the admin system before serving.

## 12. Iconography

Kurukoo should have a small, consistent semantic icon vocabulary.

Core icons:
- Home / Kurukoo: rooster/combed geometric mark
- Chat: speech bubble
- Discover / Nearby: radar wave
- Request: open hand
- Work: briefcase/hand
- Delivery: package/route
- Ride: vehicle
- Food: plate/bowl
- Reminder: clock/bell
- Safety: shield
- Emergency: SOS / alert
- Provider: person
- Business: storefront
- Agent: connected node/person
- Contributor: star/hand
- Points: Kurukoo Points mark
- Saved: heart
- Notification: bell
- Settings: sliders/gear
- Help: question mark
- Advertise: megaphone
- Partners: connected nodes

Icons must come from one shared icon set/asset layer. Do not mix arbitrary emoji, Font Awesome, Lucide, inline SVG fragments and one-off Unicode symbols across pages. WhatsApp/USSD can use emoji where the channel requires it, but the PWA/public site should use the Kurukoo icon system.

Every icon-only control requires an accessible label.

## 13. Visual language

African Modernism remains the system:
- Cream `#FFF8F0`
- Terracotta `#D97A5C`
- Electric blue `#1E88E5`
- Charcoal `#2E2E2E`
- Deep green for success
- Deep red for emergency/error
- Space Grotesk headings
- Inter body

Use motion sparingly and purposefully. The user should understand state changes even without animation.

## 14. Channel representation

The public site should represent channels as **doors into Kurukoo**, not separate products:

- Web/PWA — richest Kurukoo experience.
- WhatsApp — familiar conversational door.
- USSD — resilient feature-phone door.
- SMS — notification fallback.
- Telegram / other channels — secondary doors where enabled.

Do not repeatedly advertise old-plan `Chat on WhatsApp`, `*7000#`, `Ask Anything`, or `Start a Free Trial` CTAs on every page. Instead, use `Start chatting` as the universal CTA, with a channel chooser when useful.

## 15. Resources vs Help

**Resources = learn.**
- Getting started
- What Kurukoo can do
- Reminders and routines
- Staying safe
- How fulfillment works
- Provider guides
- Business guides
- Contributor guides
- Channel guides
- Points and plans
- How to use Explore/Discover
- Diaspora guides
- API/developer docs
- Blog / Kuru Media

**Help = resolve.**
- Account/login problems
- Message/channel issues
- Payment/Points issues
- Request/fulfillment issues
- Disputes
- Safety reports
- Report a problem
- Contact support

## 16. Engineering layers

### Identity
`memory_profiles` is the canonical user identity.

### Conversation
`messages` is the canonical interaction history.

### Intent
`intentRouter` + FastText/rules/Groq classify requests.

### Capability
`skills` + `skill_flows` define capability and workflow configuration.

### Discovery
`find_worker` + `provider_presence` provide network matching.

### Orchestration
Economic Requests are the canonical work lifecycle.

### Native scheduling
Reminders/open intentions/scheduled jobs belong to the shared memory + background-worker layer.

### External execution
Connectors require explicit provider authorization, idempotency, audit records and evidence.

### Trust/safety
Verification, compliance filters, ratings, disputes and emergency rules apply across the system.

### Economy
Points, subscriptions, lead charges and approved payment rails are configuration-driven and market-aware.

### Presentation
Storefront/chat cards use safe DOM rendering and declarative configuration where possible.

## 17. Definition of a complete user journey

A journey is not complete when a card renders. It is complete when:

- intent is understood;
- required information is collected with consent;
- the action is actually persisted/executed or honestly deferred;
- the user can resume it later;
- the conversation reflects the current state;
- notifications work where required;
- failure/retry/cancellation are defined;
- audit/evidence exists for sensitive actions;
- the profile learns only what it is allowed to learn;
- the same journey works across the appropriate channels;
- the public wording does not claim more than the backend can perform.

## 18. Build priority derived from the Blueprint

**P0 — make the core trustworthy:**
- authentication/session UX
- reminders/scheduling
- emergency contact/check-in foundations
- canonical request lifecycle
- offer/delivery coordination
- execution connector boundary
- escrow/dispute correctness
- feature flags
- memory profile schema

**P1 — make the product feel complete:**
- PWA conversation workspace
- Explore capability hub
- Discover
- Resources/Help split
- Channels page
- consistent iconography
- advertising placements
- onboarding and logout UX
- notifications and deferred requests

**P2 — deepen the network:**
- provider/business onboarding
- catalog enrichment
- universal product ordering
- sports/community flows
- security staffing
- car parts
- contributor tasks
- events/calendar

**P3 — scale/integrate:**
- Living Memory Engine
- WebRTC production implementation
- Redis/PostgreSQL migration
- UK external APIs
- diaspora payment rail
- SEO control plane
- MCP/workflow patterns
- IoT/remote integrations

## 19. Non-negotiable product language

Use:
- `Start chatting`
- `Tell Kurukoo what you need`
- `Kurukoo figures out who or what can fulfil it`
- `Find someone`
- `Get something done`
- `Offer your skills`
- `Run your business`
- `Discover nearby`
- `Keep life on track`
- `Stay connected`

Avoid unless specifically contextual:
- `Start a free trial`
- `Get started` as the primary proposition
- `Ask anything`
- `Chat on WhatsApp` as the universal product CTA
- `Marketplace` as the description of Kurukoo
- `Directory`
- `Bot`
- `Gig board`
- `Wallet` when describing Points
- `Points = money`
- `Guaranteed inventory`
- `Live tracking` unless an authorised tracking source is actually active

## 20. Build rule

Before adding another feature, first answer:

> **Where does this live in the conversation, what memory does it use, what capability executes it, what happens if it fails, how does the user resume it, and which public page teaches the user about it?**

If those answers do not exist, the feature is not ready to build.
